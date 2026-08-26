import path from "node:path";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { logger } from "./logger.mts";
import {
  gameGameDataFolder,
  gameModsFolder,
  modFolder,
  modFolderRaw,
  modName,
} from "./base-paths.mts";
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

/** Records which files this mod put into the shared GameData overlay, so a re-install can
 * remove exactly its own leftovers without touching files owned by other mods. */
const injectedManifest = path.join(modFolder, ".injected-gamedata-files.json");

function readManifest(): string[] {
  if (!existsSync(injectedManifest)) return [];
  try {
    const parsed = JSON.parse(readFileSync(injectedManifest, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Drop directories that the removal of our files just emptied out. */
function pruneEmptyDirs(dir: string) {
  while (dir.startsWith(gameGameDataFolder) && dir !== gameGameDataFolder) {
    if (!existsSync(dir) || readdirSync(dir).length) return;
    rmSync(dir, { recursive: true, force: true });
    dir = path.dirname(dir);
  }
}

function removePreviouslyInjectedFiles() {
  const previous = readManifest();
  if (!previous.length) return;
  for (const relative of previous) {
    const full = path.join(gameGameDataFolder, relative);
    if (existsSync(full)) rmSync(full, { force: true });
    pruneEmptyDirs(path.dirname(full));
  }
  logger.log(`Removed ${previous.length} config(s) from the previous install.`);
}

/**
 * Copy raw/Stalker2/Content/GameLite/GameData straight into the game's own GameData folder, where
 * the engine reads loose .cfg files as an overlay on the packed data. Cooking is pointless for
 * cfg-only mods, and so is a pak.
 */
export async function injectRawIntoGame() {
  await withSdkMutationLock(`inject-raw:${modName}`, async () => {
    const source = path.join(modFolderRaw, "Stalker2", "Content", "GameLite", "GameData");
    if (!existsSync(source)) throw new Error(`Nothing to inject: ${source} does not exist`);

    await purgePaksForMod();
    purgeNotmodsFolderForMod();
    removePreviouslyInjectedFiles();

    const files = walk(source).map((f) => path.relative(source, f));
    logger.log(`Injecting ${files.length} loose config(s) into ${gameGameDataFolder}...`);
    for (const relative of files) {
      const destination = path.join(gameGameDataFolder, relative);
      mkdirSync(path.dirname(destination), { recursive: true });
      cpSync(path.join(source, relative), destination);
    }
    writeFileSync(injectedManifest, JSON.stringify(files, null, 2));
    logger.log("Done.");
  });
}

/** Earlier versions installed loose configs under Paks/notmods/<ModName>; they would still load. */
function purgeNotmodsFolderForMod() {
  const legacy = path.join(gameModsFolder, modName);
  if (!existsSync(legacy)) return;
  logger.log(`Removing legacy loose-config folder ${legacy}`);
  rmSync(legacy, { recursive: true, force: true });
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
