import path from "node:path";
import { existsSync, readdirSync, statSync } from "node:fs";

/**
 * Only these need the cooker. Everything else in raw/ - the .cfg patches, the .uplugin - is a
 * loose file that UnrealPak stages directly, so a change to it can be shipped by repacking the
 * existing cooked tree instead of paying a ~43 min cook for a ~1.1s packaging step.
 *
 * Lives here rather than in ensure-cooked.mts because both the fingerprint split and the
 * content classification below have to agree on it; one list, one meaning.
 */
export const COOKABLE_EXTENSIONS = new Set([".uasset", ".uexp", ".umap", ".ubulk", ".uptnl"]);

/**
 * Everything the engine cannot read as a loose file. A superset of COOKABLE_EXTENSIONS: sound
 * banks, UE4SS scripts and native dlls are not cooked, but they still have to travel inside a
 * pak, so for the purposes of "which SDK mod owns this file" they belong to the assets half.
 */
export const ASSET_EXTENSIONS = new Set([...COOKABLE_EXTENSIONS, ".bnk", ".wem", ".dll", ".lua"]);

/**
 * The two kinds of content a mod can ship, and the reason this module exists: they need
 * completely different pipelines. `cfgs` are loose staged files that never reach the cooker;
 * `assets` are packages that only the cooker can produce. A mod holding both used to pay a
 * ~22 min cook (~21 of which is editor startup) for a one-line .cfg edit.
 */
export type ModContentKind = "assets" | "cfgs";

export type ModClassification = {
  /** "both" is the case that needs two SDK mods; the rest keep the single SDK mod they have. */
  kind: "empty" | "cfgs" | "assets" | "both";
  /** The kinds actually present, assets first - the order the SDK mods are driven in. */
  kinds: ModContentKind[];
  cfgFiles: string[];
  assetFiles: string[];
  /** Files that are neither (icons, the .uplugin): they travel with the assets half. */
  otherFiles: string[];
  /** True only for `both` - i.e. "this mod is driven as two SDK mods". */
  isSplit: boolean;
};

/** Files of a mod's raw/ tree, sorted, or [] when there is no raw/ at all. */
export function walkRaw(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .flatMap((entry) => {
      const full = path.join(dir, entry);
      return statSync(full).isDirectory() ? walkRaw(full) : [full];
    })
    .sort();
}

/**
 * A .cfg patch, including the extension-less `CoreVariables.cfg_patch_<Mod>` form some mods use
 * (the engine keys on the `.cfg_patch_` infix, not on a trailing extension).
 */
export function isCfgFile(filePath: string): boolean {
  const base = path.basename(filePath).toLowerCase();
  return base.endsWith(".cfg") || base.includes(".cfg_patch_");
}

export function isAssetFile(filePath: string): boolean {
  return ASSET_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/**
 * Classify a mod's raw/ tree by content kind. This is the single source of truth for "does this
 * mod need one SDK mod or two" and for routing each file to the right one; every caller
 * (push-to-sdk, cook, ensure-cooked, inject, pull-staged, the report) goes through it.
 *
 * Takes the mod's raw/ folder explicitly rather than importing base-paths: this module is the
 * bottom of the dependency graph, and the report mode has to classify every mod in Mods/ without
 * a mod being selected at all.
 *
 * Only raw/Stalker2/Content is looked at: everything outside it (Resources/Icon128.png, the
 * .uplugin) is SDK scaffolding rather than shipped content.
 */
export function classifyRawContent(rawFolder: string): ModClassification {
  const content = path.join(rawFolder, "Stalker2", "Content");
  const cfgFiles: string[] = [];
  const assetFiles: string[] = [];
  const otherFiles: string[] = [];
  for (const file of walkRaw(content)) {
    (isCfgFile(file) ? cfgFiles : isAssetFile(file) ? assetFiles : otherFiles).push(file);
  }

  const kinds: ModContentKind[] = [
    ...(assetFiles.length ? (["assets"] as const) : []),
    ...(cfgFiles.length ? (["cfgs"] as const) : []),
  ];
  const kind = kinds.length === 2 ? "both" : (kinds[0] ?? "empty");
  return { kind, kinds, cfgFiles, assetFiles, otherFiles, isSplit: kind === "both" };
}

/**
 * Suffix of the cfg half's SDK mod name.
 *
 * Which half keeps the original name is not a free choice: a cooked package embeds its own
 * path as `/<SdkModName>/<rest>` (a cooked uasset's header literally contains
 * `/FasterLootAnimation4x/_STALKER2/...`), and the PackageClassifier lists address packages the
 * same way, so renaming the assets half would invalidate every cooked package it has and force
 * a full re-cook. Loose .cfg files carry no baked path and their pak is just a file list, so the
 * cfg half is the one that can safely be renamed.
 */
export const CFG_SDK_MOD_SUFFIX = "Cfg";

/**
 * Assets keep the mod's existing SDK name; cfgs get the suffixed one, but only when the mod
 * really is split - a cfg-only mod must keep behaving exactly as it does today.
 */
export function sdkModNameForKind(
  baseSdkModName: string,
  kind: ModContentKind,
  isSplit: boolean,
): string {
  return kind === "cfgs" && isSplit ? `${baseSdkModName}${CFG_SDK_MOD_SUFFIX}` : baseSdkModName;
}
