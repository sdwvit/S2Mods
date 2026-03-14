import path from "node:path";
import type { projectRoot } from "./ensure-env.mts";
export { projectRoot } from "./ensure-env.mts";
import { modsFolder, resolveModName } from "./mod-context.mts";

export const rawCfgEnclosingFolder = path.join("Stalker2", "Content", "GameLite");
export const baseCfgDir = path.join(process.env.SDK_PATH, rawCfgEnclosingFolder);

export const modName = resolveModName();
export const modFolder = path.join(modsFolder, modName);

export const modFolderSteam = path.join(modFolder, "steamworkshop");
export const modFolderRaw = path.join(modFolder, "raw");
export const modFolderSdkLink = path.join(modFolder, "sdk");

export const sdkStagedFolder = path.join(process.env.SDK_PATH, "Stalker2", "SavedMods", "Staged");
export const sdkModsFolder = path.join(process.env.SDK_PATH, "Stalker2", "Mods");

export const gameRootFolder = process.env.STALKER2_FOLDER;
export const gameModsFolder = path.join(gameRootFolder, "Stalker2", "Content", "Paks", "~mods");
export const gameUE4SSModsFolder = path.join(gameRootFolder, "Stalker2", "Binaries", "Win64", "ue4ss", "Mods");
