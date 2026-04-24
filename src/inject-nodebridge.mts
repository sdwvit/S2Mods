import "./ensure-env.mts";
import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import crypto from "node:crypto";
import { gameRootFolder, modFolder, modName, projectRoot } from "./base-paths.mts";
import { logger } from "./logger.mts";
import { withSdkMutationLock } from "./sdk-mutation-lock.mts";

const gameWin64 = path.join(gameRootFolder, "Stalker2", "Binaries", "Win64");
const gameBridgeRoot = path.join(gameWin64, "NodeBridge");
const modNodeBridgePayload = path.join(modFolder, "nodebridge");
const distDir = path.join(projectRoot, "src", "nodebridge", "dist");
const distDll = path.join(distDir, "dwmapi.dll");
const distNode = path.join(distDir, "node");
const srcRuntime = path.join(projectRoot, "src", "nodebridge", "runtime");

async function hashFile(p: string): Promise<string | null> {
  try {
    const h = crypto.createHash("sha256");
    h.update(await fsp.readFile(p));
    return h.digest("hex");
  } catch {
    return null;
  }
}

async function copyIfChanged(src: string, dst: string): Promise<boolean> {
  const [s, d] = await Promise.all([hashFile(src), hashFile(dst)]);
  if (s === null) return false;
  if (s === d) return false;
  await fsp.mkdir(path.dirname(dst), { recursive: true });
  await fsp.copyFile(src, dst);
  return true;
}

async function copyTreeIfChanged(src: string, dst: string): Promise<number> {
  if (!fs.existsSync(src)) return 0;
  let changed = 0;
  for (const entry of await fsp.readdir(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) changed += await copyTreeIfChanged(s, d);
    else if (entry.isFile() && (await copyIfChanged(s, d))) changed++;
  }
  return changed;
}

async function readEnabled(): Promise<Record<string, boolean>> {
  const f = path.join(gameBridgeRoot, "mods", "enabled.json");
  if (!fs.existsSync(f)) return {};
  try {
    const parsed = JSON.parse(await fsp.readFile(f, "utf8"));
    if (Array.isArray(parsed)) return Object.fromEntries(parsed.map((n) => [n, true]));
    if (parsed && typeof parsed === "object") return parsed;
  } catch {}
  return {};
}

async function writeEnabled(map: Record<string, boolean>): Promise<void> {
  const f = path.join(gameBridgeRoot, "mods", "enabled.json");
  await fsp.mkdir(path.dirname(f), { recursive: true });
  await fsp.writeFile(f, JSON.stringify(map, null, 2));
}

async function main(): Promise<void> {
  await withSdkMutationLock(`inject-nodebridge:${modName}`, async () => {
    if (!fs.existsSync(modNodeBridgePayload)) {
      logger.log(`[inject-nodebridge] ${modName} has no nodebridge/ folder; skipping`);
      return;
    }
    if (!fs.existsSync(distDll)) {
      throw new Error(`missing ${distDll} — run "npm run pull-nodebridge" first`);
    }
    if (!fs.existsSync(distNode)) {
      throw new Error(`missing ${distNode} — run "npm run pull-node-runtime" first`);
    }

    let changed = 0;
    // DLL goes in Win64 itself, next to Stalker2-Win64-Shipping.exe
    if (await copyIfChanged(distDll, path.join(gameWin64, "dwmapi.dll"))) {
      changed++;
      logger.log("[inject-nodebridge] dwmapi.dll updated");
    }
    const distPdb = path.join(distDir, "dwmapi.pdb");
    if (fs.existsSync(distPdb) && (await copyIfChanged(distPdb, path.join(gameWin64, "dwmapi.pdb")))) {
      changed++;
    }
    // Bundled Node + runtime live under <Win64>/NodeBridge/
    changed += await copyTreeIfChanged(distNode, path.join(gameBridgeRoot, "node"));
    changed += await copyTreeIfChanged(srcRuntime, path.join(gameBridgeRoot, "runtime"));
    // Per-mod JS payload
    const modDst = path.join(gameBridgeRoot, "mods", modName);
    changed += await copyTreeIfChanged(modNodeBridgePayload, modDst);
    // Register this mod in enabled.json without clobbering siblings
    const enabled = await readEnabled();
    if (enabled[modName] !== true) {
      enabled[modName] = true;
      await writeEnabled(enabled);
    }
    logger.log(`[inject-nodebridge] ${changed} file(s) updated; mod "${modName}" enabled`);
  });
}

await main();
