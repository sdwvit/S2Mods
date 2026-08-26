import path from "node:path";
import { cpSync, existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { logger } from "./logger.mts";
import { gameModsFolder, modFolderRaw, modName } from "./base-paths.mts";
import { sdkModName } from "./mod-meta-paths.mts";
import { withSdkMutationLock } from "./sdk-mutation-lock.mts";

/** Anything the engine has to cook. Loose .cfg files are read straight from disk, these are not. */
const cookedExtensions = new Set([
  ".uasset",
  ".umap",
  ".ubulk",
  ".uexp",
  ".uptnl",
  ".bnk",
  ".wem",
  ".dll",
  ".lua",
]);

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** A mod is cfg-only when its raw/Stalker2/Content tree holds no assets that need cooking. */
export function isCfgOnlyMod(): boolean {
  const content = path.join(modFolderRaw, "Stalker2", "Content");
  return !walk(content).some((f) => cookedExtensions.has(path.extname(f).toLowerCase()));
}

/**
 * Copy raw/Stalker2/Content straight into the game's mods folder, under a folder named after the
 * mod. Cooking is pointless for cfg-only mods - the game reads loose .cfg files as-is.
 */
export async function injectRawIntoGame() {
  await withSdkMutationLock(`inject-raw:${modName}`, async () => {
    const source = path.join(modFolderRaw, "Stalker2", "Content");
    if (!existsSync(source)) throw new Error(`Nothing to inject: ${source} does not exist`);

    const destination = path.join(gameModsFolder, modName);
    await purgePaksForMod();

    logger.log(`Injecting loose configs into ${destination}...`);
    rmSync(destination, { recursive: true, force: true });
    cpSync(source, path.join(destination, "Stalker2", "Content"), { recursive: true });
    logger.log("Done.");
  });
}

/** Loose configs and a cooked pak of the same mod would both load, so keep only one of them. */
export async function purgePaksForMod() {
  if (!existsSync(gameModsFolder)) return;
  const prefixes = new Set([modName, await sdkModName]);
  for (const entry of readdirSync(gameModsFolder)) {
    const isPak = /\.(pak|ucas|utoc)$/i.test(entry);
    if (!isPak) continue;
    if (![...prefixes].some((p) => p && entry.startsWith(`${p}Stalker2-Windows`))) continue;
    logger.log(`Removing stale pak ${entry}`);
    rmSync(path.join(gameModsFolder, entry));
  }
}
