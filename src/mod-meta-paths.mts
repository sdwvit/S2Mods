import path from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { modFolder, modFolderSteam, modName, sdkModsFolder, sdkStagedFolder } from "./base-paths.mts";
import type { MetaType } from "./meta-type.mts";

const metaPath = path.join(modFolder, "meta.mts");

if (!existsSync(metaPath)) {
  mkdirSync(modFolder, { recursive: true });
  writeFileSync(
    metaPath,
    `
import { Struct } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";

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
export const stagedFolderStruct = sdkModName.then((name) => path.join("Stalker2", "Mods", name, "Content", "Paks", "Windows"));
export const sdkModFolder = sdkModName.then((name) => path.join(sdkModsFolder, name));
export const modFolderSteamStruct = stagedFolderStruct.then((folder) => path.join(modFolderSteam, folder));
export const sdkStagedPakFolder = Promise.all([sdkModName, stagedFolderStruct]).then(([name, folder]) =>
  path.join(sdkStagedFolder, name, "Windows", folder),
);
