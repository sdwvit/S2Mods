import path from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { modFolder, modFolderRaw, modName, sdkModsFolder, sdkStagedFolder } from "./base-paths.mts";
import type { MetaType } from "./meta-type.mts";
import { cookVariants } from "./cook-variants.mts";
import {
  classifyRawContent,
  sdkModNameForKind,
  type ModClassification,
  type ModContentKind,
} from "./mod-kinds.mts";

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

/**
 * One SDK mod. A mod whose raw/ holds both .cfg patches and cooked assets is driven as TWO of
 * these, because the two kinds have nothing in common in the pipeline: the cfg half never needs
 * the cooker for its own sake and can be rebuilt in ~9s by src/repack.mts, while a mixed SDK mod
 * pays the full ~22 min cook (~21 of which is editor startup) whenever any of its .cfgs move.
 *
 * A single-kind mod has exactly one target, carrying the mod's existing SDK name - so nothing
 * about it changes. Published mods still ship as ONE mod: both targets' staged trees are merged
 * into the single steamworkshop/ payload (they differ in their `Stalker2/Mods/<name>` subfolder,
 * so the merge is a plain overlay and the game loads both containers).
 */
export type SdkModTarget = {
  kind: ModContentKind;
  name: string;
  /** $SDK/Stalker2/Mods/<name> */
  modFolder: string;
  /** Staged/<name>/Windows - one folder per cook variant below it. */
  stagedModFolder: string;
  /** SavedMods/PackageClassifier/<name> */
  packageClassifierFolder: string;
  /** Stalker2/Mods/<name>/Content/Paks/Windows */
  stagedFolderStruct: string;
  stagedPakFolderFor(variant: string): string;
};

/** Same derivation as the top-level exports, for an arbitrary SDK mod name. */
export function sdkModTargetOf(kind: ModContentKind, name: string): SdkModTarget {
  const folderStruct = path.join("Stalker2", "Mods", name, "Content", "Paks", "Windows");
  const stagedModFolder = path.join(sdkStagedFolder, name, "Windows");
  return {
    kind,
    name,
    modFolder: path.join(sdkModsFolder, name),
    stagedModFolder,
    packageClassifierFolder: path.join(
      process.env.SDK_PATH,
      "Stalker2",
      "SavedMods",
      "PackageClassifier",
      name,
    ),
    stagedFolderStruct: folderStruct,
    stagedPakFolderFor: (variant: string) =>
      path.join(stagedModFolder, variant, "Windows", folderStruct),
  };
}

/** How this mod's raw/ splits by content kind. Cheap, synchronous, re-derived per process. */
export const modClassification: ModClassification = classifyRawContent(modFolderRaw);

/**
 * The SDK mods this repo mod is built as: one per content kind present, assets first. An empty
 * raw/ still yields one target (the mod's own name), so nothing that assumes "there is an SDK
 * mod" has to special-case it.
 */
export const sdkModTargets: Promise<SdkModTarget[]> = sdkModName.then((base) => {
  const kinds = modClassification.kinds.length ? modClassification.kinds : (["assets"] as const);
  return kinds.map((kind) =>
    sdkModTargetOf(kind, sdkModNameForKind(base, kind, modClassification.isSplit)),
  );
});

export const sdkModTargetFor = (kind: ModContentKind): Promise<SdkModTarget> =>
  sdkModTargets.then((targets) => {
    const target = targets.find((t) => t.kind === kind);
    if (!target) throw new Error(`Mod has no ${kind} content, so it has no ${kind} SDK mod.`);
    return target;
  });

/**
 * The target that owns the mod's original SDK name - the assets half of a split mod, the only
 * target otherwise. This is what the legacy single-value exports above resolve to, so every
 * untouched caller keeps addressing exactly the folder it addressed before.
 */
export const primarySdkModTarget: Promise<SdkModTarget> = sdkModTargets.then(
  (targets) => targets[0],
);
