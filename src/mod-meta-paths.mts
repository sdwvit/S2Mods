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
import { sdkModTargetShape, type SdkModTarget } from "./sdk-target-shape.mts";

export type { SdkModTarget };

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

/** Same derivation as the top-level exports, for an arbitrary SDK mod name. */
export function sdkModTargetOf(kind: ModContentKind, name: string): SdkModTarget {
  return sdkModTargetShape(kind, name, process.env.SDK_PATH);
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
