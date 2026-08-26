import path from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { modFolder, modName, sdkModsFolder, sdkStagedFolder } from "./base-paths.mts";
import type { MetaType } from "./meta-type.mts";
import { cookVariants } from "./cook-variants.mts";

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
export const stagedFolderStruct = sdkModName.then((name) =>
  path.join("Stalker2", "Mods", name, "Content", "Paks", "Windows"),
);
export const sdkModFolder = sdkModName.then((name) => path.join(sdkModsFolder, name));
/** SavedMods/PackageClassifier/<mod> - the override/new package lists that steer the cook. */
export const sdkPackageClassifierFolder = sdkModName.then((name) =>
  path.join(process.env.SDK_PATH, "Stalker2", "SavedMods", "PackageClassifier", name),
);
/** Staged/<mod>/Windows - holds one folder per cook variant (NewContent, OverrideContent). */
export const sdkStagedModFolder = sdkModName.then((name) =>
  path.join(sdkStagedFolder, name, "Windows"),
);
/** The pak folder of a single cook variant: .../<variant>/Windows/Stalker2/Mods/<mod>/Content/Paks/Windows. */
export const sdkStagedPakFolderFor = (variant: string) =>
  Promise.all([sdkStagedModFolder, stagedFolderStruct]).then(([staged, folder]) =>
    path.join(staged, variant, "Windows", folder),
  );
export const sdkStagedPakFolders = Promise.all(cookVariants.map(sdkStagedPakFolderFor));
