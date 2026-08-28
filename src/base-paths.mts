import path from "node:path";
import { projectRoot as projectRootPath } from "./ensure-env.mts";
export { projectRoot } from "./ensure-env.mts";
import { modsFolder, resolveModName } from "./mod-context.mts";

export const rawCfgEnclosingFolder = path.join("Stalker2", "Content", "GameLite");
export const baseCfgDir = path.join(process.env.SDK_PATH, rawCfgEnclosingFolder);

/**
 * DLC .cfg data (Deluxe/Ultimate/PreOrder/DLC1) lives in the game paks under
 * Stalker2/Content/GameLite/DLCGameData, but is absent from the SDK. It is extracted
 * into <projectRoot>/DLCGameData, mirroring the in-game layout below GameLite.
 */
export const dlcCfgFolderName = "DLCGameData";
export const dlcCfgDir = path.join(projectRootPath, dlcCfgFolderName);

/**
 * Path of a scanned .cfg relative to GameLite, e.g. "GameData/ItemPrototypes/WeaponPrototypes.cfg"
 * or "DLCGameData/Deluxe/ItemPrototypes.cfg".
 */
export const toGameLiteRelativePath = (filePath: string): string =>
  filePath.startsWith(dlcCfgDir)
    ? path.join(dlcCfgFolderName, filePath.slice(dlcCfgDir.length + 1))
    : filePath.slice(baseCfgDir.length + 1);

export const isDlcCfg = (filePath: string): boolean => filePath.startsWith(dlcCfgDir);

export const modName = resolveModName();
export const modFolder = path.join(modsFolder, modName);

export const modFolderSteam = path.join(modFolder, "steamworkshop");
export const modFolderRaw = path.join(modFolder, "raw");
export const modFolderSdkLink = path.join(modFolder, "sdk");

export const sdkStagedFolder = path.join(process.env.SDK_PATH, "Stalker2", "SavedMods", "Staged");
export const sdkModsFolder = path.join(process.env.SDK_PATH, "Stalker2", "Mods");

export const gameRootFolder = process.env.STALKER2_FOLDER;
export const gameModsFolder = path.join(gameRootFolder, "Stalker2", "Content", "Paks", "notmods");
/**
 * Loose .cfg overlay the game reads directly - takes precedence over the packed data. Both
 * `GameData` and `DLCGameData/<DLC>` live below it; a mod with `dlc = true` patches only the latter.
 */
export const gameGameLiteFolder = path.join(gameRootFolder, "Stalker2", "Content", "GameLite");
export const gameGameDataFolder = path.join(gameGameLiteFolder, "GameData");
/** The overlay subtrees a mod may inject into, as paths relative to GameLite. */
export const injectableCfgTrees = ["GameData", dlcCfgFolderName] as const;
export const gameUE4SSModsFolder = path.join(
  gameRootFolder,
  "Stalker2",
  "Binaries",
  "Win64",
  "ue4ss",
  "Mods",
);
