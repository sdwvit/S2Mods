import path from "node:path";

import type { ModContentKind } from "./mod-kinds.mts";

export type { ModContentKind };

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

/**
 * Pure path derivation for one SDK mod, with the SDK root passed in. Lives in its own module -
 * free of import-time side effects - so it can be reused (and tested) without pulling in
 * mod-meta-paths, which resolves S2_MOD and imports the selected mod's meta.mts on import.
 */
export function sdkModTargetShape(
  kind: ModContentKind,
  name: string,
  sdkPath: string,
): SdkModTarget {
  const folderStruct = path.join("Stalker2", "Mods", name, "Content", "Paks", "Windows");
  const stagedModFolder = path.join(sdkPath, "Stalker2", "SavedMods", "Staged", name, "Windows");
  return {
    kind,
    name,
    modFolder: path.join(sdkPath, "Stalker2", "Mods", name),
    stagedModFolder,
    packageClassifierFolder: path.join(sdkPath, "Stalker2", "SavedMods", "PackageClassifier", name),
    stagedFolderStruct: folderStruct,
    stagedPakFolderFor: (variant: string) =>
      path.join(stagedModFolder, variant, "Windows", folderStruct),
  };
}
