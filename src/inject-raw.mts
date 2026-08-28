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
  gameGameLiteFolder,
  gameModsFolder,
  injectableCfgTrees,
  modFolder,
  modFolderRaw,
  modName,
} from "./base-paths.mts";
import { modClassification, sdkModTargets } from "./mod-meta-paths.mts";
import { withSdkMutationLock } from "./sdk-mutation-lock.mts";

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/**
 * A mod is cfg-only when its raw/Stalker2/Content tree holds nothing that has to travel inside a
 * pak. The extension list lives in src/mod-kinds.mts, which is also what decides how many SDK
 * mods this mod is built as - the two answers must not be allowed to disagree. An empty raw/
 * counts as cfg-only, as it always has (those mods have their own injectors).
 */
export function isCfgOnlyMod(): boolean {
  return modClassification.assetFiles.length === 0;
}

/** Records which files this mod put into the shared GameLite overlay, so a re-install can
 * remove exactly its own leftovers without touching files owned by other mods. Entries are
 * relative to GameLite (`GameData/...`, `DLCGameData/...`). */
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

/**
 * A manifest entry as an absolute path. Manifests written before DLC support stored paths
 * relative to GameData; anything not naming one of the overlay subtrees is one of those.
 */
function resolveManifestEntry(relative: string): string {
  const tree = relative.split(/[\\/]/)[0];
  return injectableCfgTrees.includes(tree as (typeof injectableCfgTrees)[number])
    ? path.join(gameGameLiteFolder, relative)
    : path.join(gameGameDataFolder, relative);
}

/** Drop directories that the removal of our files just emptied out. */
function pruneEmptyDirs(dir: string) {
  while (dir.startsWith(gameGameLiteFolder) && dir !== gameGameLiteFolder) {
    if (!existsSync(dir) || readdirSync(dir).length) return;
    rmSync(dir, { recursive: true, force: true });
    dir = path.dirname(dir);
  }
}

function removePreviouslyInjectedFiles() {
  const previous = readManifest();
  if (!previous.length) return;
  for (const relative of previous) {
    const full = resolveManifestEntry(relative);
    if (existsSync(full)) rmSync(full, { force: true });
    pruneEmptyDirs(path.dirname(full));
  }
  logger.log(`Removed ${previous.length} config(s) from the previous install.`);
}

/**
 * Does this file in the game's GameData overlay belong to this mod? Two naming conventions are in
 * use: the usual `<Prototypes>_patch_<ModName>.cfg`, and the extension-less
 * `CoreVariables.cfg_patch_<ModName>` form, so match `_patch_<ModName>` anywhere in the basename
 * as well as a plain `_<ModName>.cfg` suffix.
 */
function isOwnedByMod(filePath: string): boolean {
  const base = path.basename(filePath).toLowerCase();
  const mod = modName.toLowerCase();
  // Anchor on end-of-name or an extension dot, so e.g. NoAP does not claim NoAPForMobs' files.
  return (
    base.endsWith(`_patch_${mod}`) ||
    base.endsWith(`_${mod}.cfg`) ||
    base.includes(`_patch_${mod}.`)
  );
}

/**
 * Remove this mod's loose .cfg patches from the game's GameData overlay. A cooked pak carries the
 * same patches, and the loose overlay takes precedence over packed data, so leftovers from an
 * earlier loose install would silently shadow the pak.
 */
export function purgeLooseCfgsForMod() {
  removePreviouslyInjectedFiles();
  if (existsSync(injectedManifest)) rmSync(injectedManifest, { force: true });

  const strays = injectableCfgTrees
    .flatMap((tree) => walk(path.join(gameGameLiteFolder, tree)))
    .filter(isOwnedByMod);
  if (!strays.length) return;
  logger.log(`Removing ${strays.length} loose config(s) of ${modName} from ${gameGameLiteFolder}`);
  for (const full of strays) {
    rmSync(full, { force: true });
    pruneEmptyDirs(path.dirname(full));
  }
}

/**
 * Copy raw/Stalker2/Content/GameLite straight into the game's own GameLite folder, where the
 * engine reads loose .cfg files as an overlay on the packed data. Cooking is pointless for
 * cfg-only mods, and so is a pak.
 *
 * Both GameData and DLCGameData are copied: a `dlc = true` mod writes its patches under
 * `DLCGameData/<DLC>/` only, and injecting just GameData silently dropped the whole mod.
 */
export async function injectRawIntoGame() {
  await withSdkMutationLock(`inject-raw:${modName}`, async () => {
    const source = path.join(modFolderRaw, "Stalker2", "Content", "GameLite");
    const files = injectableCfgTrees.flatMap((tree) =>
      walk(path.join(source, tree)).map((f) => path.relative(source, f)),
    );
    if (!files.length) throw new Error(`Nothing to inject: no .cfg trees under ${source}`);

    await purgePaksForMod();
    purgeNotmodsFolderForMod();
    removePreviouslyInjectedFiles();

    logger.log(`Injecting ${files.length} loose config(s) into ${gameGameLiteFolder}...`);
    for (const relative of files) {
      const destination = path.join(gameGameLiteFolder, relative);
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
  // Both halves of a split mod, so the assets pak and the cfg pak of an earlier install are
  // both removed - and so is the single mixed pak a pre-split install left behind, since the
  // assets half kept that name.
  const prefixes = new Set([modName, ...(await sdkModTargets).map(({ name }) => name)]);
  for (const entry of readdirSync(gameModsFolder)) {
    const isPak = /\.(pak|ucas|utoc)$/i.test(entry);
    if (!isPak) continue;
    if (![...prefixes].some((p) => p && entry.startsWith(`${p}Stalker2-Windows`))) continue;
    logger.log(`Removing stale pak ${entry}`);
    rmSync(path.join(gameModsFolder, entry));
  }
}
