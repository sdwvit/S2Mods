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

// Extensions tried in order — first one found wins. Node 25 supports native
// type-stripping for .ts/.mts/.cts, so mod authors can write TypeScript and
// import it directly (no bundler).
const entryExtensions = ["main.ts", "main.mts", "main.cts", "main.mjs", "main.cjs", "main.js"];

const loaded = [];
const modList = discoverMods();

rpc.handle("bootstrap.shutdown", async () => {
  rpc.close();
  setTimeout(() => process.exit(0), 50);
});

rpc.handle("bootstrap.ping", async () => ({ pid: process.pid, node: process.version }));

for (const modName of modList) {
  const modDir = path.join(modsRoot, modName);
  let entry = null;
  for (const name of entryExtensions) {
    const candidate = path.join(modDir, name);
    if (fs.existsSync(candidate)) { entry = candidate; break; }
  }
  if (!entry) {
    rpc.emit("log", {
      level: "warn",
      mod: "bootstrap",
      msg: `skip ${modName}: no main.{ts,mts,cts,mjs,cjs,js} in ${modDir}`,
    });
    continue;
  }
  try {
    const mod = await import(pathToFileURL(entry).href);
    const bridge = createBridge(rpc, modName);
    const init = typeof mod.default === "function" ? mod.default : typeof mod.init === "function" ? mod.init : null;
    loaded.push(modName);
    rpc.emit("log", { level: "info", mod: "bootstrap", msg: `loaded ${modName} (${path.basename(entry)})` });
    // Run init concurrently — DON'T await. Mods often run forever (poll
    // loops, watchers, teleport ticks), and awaiting their promise here
    // would block the rest of bootstrap (notably the hot-reload poller
    // setup below) until the mod returned, which it never does.
    if (init) Promise.resolve(init(bridge)).catch((err) => {
      rpc.emit("log", { level: "error", mod: "bootstrap", msg: `init ${modName} threw: ${err?.stack || err}` });
    });
  } catch (err) {
    rpc.emit("log", { level: "error", mod: "bootstrap", msg: `load ${modName} failed: ${err?.stack || err}` });
  }
}

rpc.emit("bootstrap.ready", { loaded, node: process.version, pid: process.pid });

// Hot reload: watch every loaded mod's tree and exit cleanly on JS change.
// The DLL's node_host supervisor then respawns node.exe with fresh imports
// (ESM's module cache can't be cleared for just one mod without a lot of
// care — a full process restart is simpler and always works).
let reloading = false;
const reloadTriggers = /\.(ts|mts|cts|mjs|cjs|js|json)$/;
for (const modName of loaded) {
  const watchDir = path.join(modsRoot, modName);
  try {
    fs.watch(watchDir, { recursive: true }, (_event, filename) => {
      if (reloading || !filename || !reloadTriggers.test(filename)) return;
      reloading = true;
      rpc.emit("log", { level: "info", mod: "bootstrap", msg: `reload: ${modName}/${filename}` });
      // Give the log a moment to flush over the pipe + the editor to finish
      // whatever multi-part save it's doing (atomic-write patterns generate
      // rename+create+delete bursts).
      setTimeout(() => process.exit(0), 200);
    });
  } catch (err) {
    rpc.emit("log", { level: "warn", mod: "bootstrap", msg: `watch ${modName} failed: ${err?.message || err}` });
  }
}

function discoverMods() {
  try {
    return fs
      .readdirSync(modsRoot)
      .filter((d) => {
        const dir = path.join(modsRoot, d);
        if (!fs.statSync(dir).isDirectory()) return false;
        // Any of the entry extensions counts as a mod marker. Was
        // hard-coded to main.mjs; that broke discovery on TypeScript-only
        // mods (main.mts/main.ts) which Node 25 loads natively.
        return entryExtensions.some((ext) => fs.existsSync(path.join(dir, ext)));
      });
  } catch {
    return [];
  }
}

process.on("uncaughtException", (e) => {
  rpc.emit("log", { level: "error", mod: "bootstrap", msg: `uncaught: ${e?.stack || e}` });
});
process.on("unhandledRejection", (e) => {
  rpc.emit("log", { level: "error", mod: "bootstrap", msg: `unhandledRejection: ${e?.stack || e}` });
});
