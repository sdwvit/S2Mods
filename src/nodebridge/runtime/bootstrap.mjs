import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { createRpc } from "./rpc.mjs";
import { createBridge } from "./bridge.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ""), true];
  }),
);

const pipePath = args.pipe;
const modsRoot = args["mods-root"];
if (!pipePath) exitFatal("missing --pipe=<path>");
if (!modsRoot) exitFatal("missing --mods-root=<path>");

function exitFatal(msg) {
  process.stderr.write(`[bootstrap] FATAL: ${msg}\n`);
  process.exit(2);
}

const rpc = createRpc(pipePath);
rpc.setOnClose((err) => {
  process.stderr.write(`[bootstrap] pipe closed${err ? `: ${err.message}` : ""}\n`);
  process.exit(err ? 3 : 0);
});

try {
  await rpc.connect();
} catch (err) {
  exitFatal(`pipe connect failed: ${err.message}`);
}

const loaded = [];
const modList = readEnabled();

rpc.handle("bootstrap.shutdown", async () => {
  rpc.close();
  setTimeout(() => process.exit(0), 50);
});

rpc.handle("bootstrap.ping", async () => ({ pid: process.pid, node: process.version }));

for (const modName of modList) {
  const entry = path.join(modsRoot, modName, "main.mjs");
  if (!fs.existsSync(entry)) {
    rpc.emit("log", { level: "warn", mod: "bootstrap", msg: `skip ${modName}: missing ${entry}` });
    continue;
  }
  try {
    const mod = await import(pathToFileURL(entry).href);
    const bridge = createBridge(rpc, modName);
    const init = typeof mod.default === "function" ? mod.default : typeof mod.init === "function" ? mod.init : null;
    if (init) await init(bridge);
    loaded.push(modName);
    rpc.emit("log", { level: "info", mod: "bootstrap", msg: `loaded ${modName}` });
  } catch (err) {
    rpc.emit("log", { level: "error", mod: "bootstrap", msg: `load ${modName} failed: ${err?.stack || err}` });
  }
}

rpc.emit("bootstrap.ready", { loaded, node: process.version, pid: process.pid });

function readEnabled() {
  const f = path.join(modsRoot, "enabled.json");
  if (!fs.existsSync(f)) {
    try {
      return fs
        .readdirSync(modsRoot)
        .filter((d) => fs.statSync(path.join(modsRoot, d)).isDirectory() && fs.existsSync(path.join(modsRoot, d, "main.mjs")));
    } catch {
      return [];
    }
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(f, "utf8"));
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") return Object.entries(parsed).filter(([, v]) => v).map(([k]) => k);
  } catch {}
  return [];
}

process.on("uncaughtException", (e) => {
  rpc.emit("log", { level: "error", mod: "bootstrap", msg: `uncaught: ${e?.stack || e}` });
});
process.on("unhandledRejection", (e) => {
  rpc.emit("log", { level: "error", mod: "bootstrap", msg: `unhandledRejection: ${e?.stack || e}` });
});
