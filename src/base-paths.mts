import path from "node:path";
import fs, { existsSync, writeFileSync } from "node:fs";
import { projectRoot } from "./ensure-dot-env.mts";
export { projectRoot } from "./ensure-dot-env.mts";
import { execSync } from "node:child_process";
import { MetaType } from "./meta-type.mts";
import { mkdirSync } from "fs";

export const rawCfgEnclosingFolder = path.join("Stalker2", "Content", "GameLite");
export const baseCfgDir = path.join(process.env.SDK_PATH, rawCfgEnclosingFolder);

const branchName = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();

export const modName = branchName === "master" ? "MasterMod" : branchName;

export const modsFolder = path.join(projectRoot, "Mods");
export const modFolder = path.join(modsFolder, modName);

export const modFolderSteam = path.join(modFolder, "steamworkshop");
export const modFolderRaw = path.join(modFolder, "raw");
export const modFolderSdkLink = path.join(modFolder, "sdk");

export const sdkStagedFolder = path.join(process.env.SDK_PATH, "Stalker2", "SavedMods", "Staged");
export const sdkModsFolder = path.join(process.env.SDK_PATH, "Stalker2", "Mods");
export const allValidMods = fs.readdirSync(modsFolder).filter((file) => fs.statSync(path.join(modsFolder, file)).isDirectory());

export const gameRootFolder = process.env.STALKER2_FOLDER;
export const gameModsFolder = path.join(gameRootFolder, "Stalker2", "Content", "Paks", "~mods");
export const gameUE4SSModsFolder = path.join(gameRootFolder, "Stalker2", "Binaries", "Win64", "ue4ss", "Mods");
const metaPath = path.join(modFolder, "meta.mts");
if (!existsSync(metaPath)) {
  mkdirSync(modFolder, { recursive: true });
  writeFileSync(
    metaPath,
    `
import { Struct } from "s2cfgtojson";
import { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType = {
  description: \`
Title
[hr][/hr]
Description[h1][/h1]
\`,
  changenote: "Initial release",
  structTransformers: [structTransformer],
};

function structTransformer(struct: Struct) {

}
 
structTransformer.files = [ todo ];`,
  );
}
const metaPromise = import(path.join(modFolder, "meta.mts")) as Promise<{ meta: MetaType }>;

export const modMeta = metaPromise.then(({ meta }) => meta);
export const sdkModName = modMeta.then(({ sdkModNameOverride }) => sdkModNameOverride || modName);
export const stagedFolderStruct = sdkModName.then((sdkModName) => path.join("Stalker2", "Mods", sdkModName, "Content", "Paks", "Windows"));
export const sdkModFolder = sdkModName.then((sdkModName) => path.join(sdkModsFolder, sdkModName));
export const modFolderSteamStruct = stagedFolderStruct.then((stagedFolderStruct) => path.join(modFolderSteam, stagedFolderStruct));
export const sdkStagedPakFolder = Promise.all([sdkModName, stagedFolderStruct]).then(([sdkModName, stagedFolderStruct]) =>
  path.join(sdkStagedFolder, sdkModName, "Windows", stagedFolderStruct),
);
