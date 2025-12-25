import path from "node:path";
import "./ensure-dot-env.mts";
import fs from "node:fs";

export const rawCfgEnclosingFolder = path.join("Stalker2", "Content", "GameLite");
export const baseCfgDir = path.join(process.env.SDK_PATH, rawCfgEnclosingFolder);

export const modName = process.env.MOD_NAME;
export const stagedFolderStruct = path.join("Stalker2", "Mods", modName, "Content", "Paks", "Windows");

export const projectRoot = path.join(import.meta.dirname, "..");

export const modsFolder = path.join(projectRoot, "Mods");
export const modFolder = path.join(modsFolder, modName);
export const modFolderSteam = path.join(modFolder, "steamworkshop");
export const modFolderSteamStruct = path.join(modFolderSteam, stagedFolderStruct);
export const modFolderRaw = path.join(modFolder, "raw");
export const modFolderSdkSrc = path.join(modFolder, "sdk");

export const sdkStagedFolder = path.join(process.env.SDK_PATH, "Stalker2", "SavedMods", "Staged");
export const sdkModsFolder = path.join(process.env.SDK_PATH, "Stalker2", "Mods");
export const sdkModFolder = path.join(sdkModsFolder, modName);
export const validMods = fs.readdirSync(modsFolder).filter((file) => fs.statSync(path.join(modsFolder, file)).isDirectory());
