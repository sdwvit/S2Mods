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
const modList = discoverMods();

rpc.handle("bootstrap.shutdown", async () => {
  rpc.close();
  setTimeout(() => process.exit(0), 50);
});

rpc.handle("bootstrap.ping", async () => ({ pid: process.pid, node: process.version }));

// Extensions tried in order — first one found wins. Node 25 supports native
// type-stripping for .ts/.mts/.cts, so mod authors can write TypeScript and
// import it directly (no bundler).
const entryExtensions = ["main.ts", "main.mts", "main.cts", "main.mjs", "main.cjs", "main.js"];

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
    if (init) await init(bridge);
    loaded.push(modName);
    rpc.emit("log", { level: "info", mod: "bootstrap", msg: `loaded ${modName} (${path.basename(entry)})` });
  } catch (err) {
    rpc.emit("log", { level: "error", mod: "bootstrap", msg: `load ${modName} failed: ${err?.stack || err}` });
  }
}

rpc.emit("bootstrap.ready", { loaded, node: process.version, pid: process.pid });

// Hot reload: poll every loaded mod's tree for mtime changes and exit
// cleanly when one fires. The DLL's node_host supervisor then respawns
// node.exe with fresh imports (ESM's module cache can't be cleared for
// just one mod without a lot of care — a full process restart is
// simpler and always works).
//
// Why polling instead of fs.watch: under Wine/Proton, fs.watch maps to
// ReadDirectoryChangesW, which doesn't reliably fire when the underlying
// Linux host writes to the watched directory (as inject-nodebridge
// does). A 1s mtime poll is immune to that — slightly less efficient
// but always works.
let reloading = false;
const reloadTriggers = /\.(ts|mts|cts|mjs|cjs|js|json)$/;

function snapshotMtimes(rootDir) {
  const out = new Map();
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { continue; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile() && reloadTriggers.test(e.name)) {
        try { out.set(p, fs.statSync(p).mtimeMs); } catch {}
      }
    }
  }
  return out;
}

function findChange(prev, cur) {
  for (const [p, mt] of cur) if (prev.get(p) !== mt) return p;
  for (const [p] of prev) if (!cur.has(p)) return p;
  return null;
}

const snapshots = new Map();
for (const modName of loaded) {
  snapshots.set(modName, snapshotMtimes(path.join(modsRoot, modName)));
}

setInterval(() => {
  if (reloading) return;
  for (const modName of loaded) {
    const dir = path.join(modsRoot, modName);
    const prev = snapshots.get(modName);
    const cur = snapshotMtimes(dir);
    const changed = findChange(prev, cur);
    if (changed) {
      reloading = true;
      const rel = path.relative(dir, changed);
      rpc.emit("log", { level: "info", mod: "bootstrap", msg: `reload: ${modName}/${rel}` });
      // Give the log a moment to flush over the pipe + the editor to
      // finish multi-part atomic-save bursts (rename+create+delete).
      setTimeout(() => process.exit(0), 200);
      return;
    }
    snapshots.set(modName, cur);
  }
}, 1000).unref();

function discoverMods() {
  try {
    return fs
      .readdirSync(modsRoot)
      .filter((d) => fs.statSync(path.join(modsRoot, d)).isDirectory() && fs.existsSync(path.join(modsRoot, d, "main.mjs")));
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
