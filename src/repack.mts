import path from "node:path";
import childProcess from "node:child_process";
import { execFileSync } from "node:child_process";
import os from "node:os";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import dotEnv from "dotenv";
import { logger } from "./logger.mts";
import { projectRoot, sdkModsFolder, sdkStagedFolder } from "./base-paths.mts";
import { cookVariants } from "./cook-variants.mts";
import { sdkModName, sdkStagedPakFolderFor } from "./mod-meta-paths.mts";
import { withSdkMutationLock } from "./sdk-mutation-lock.mts";
import { getNTPath } from "./cook.mts";

dotEnv.config({ path: path.join(import.meta.dirname, "..", ".env") });

/**
 * Replay only the packaging tail of the SDK cook.
 *
 * A GSCCookMod pass costs ~21 minutes per variant, and ~21 of those minutes are the editor
 * booting through Wine and refreshing the 151k loose .cfg files of the base GameData tree.
 * The part that actually produces the shipped containers is two UnrealPak.exe invocations
 * that take ~1.1s each. Whenever the cooked .uasset/.uexp are already current - a cfg-only
 * edit, a re-publish, a recompress - replaying just those two commands is a 40min -> ~2s win.
 *
 * `node src/repack.mts --verify-lists` is the cheap gate and needs neither Wine nor a cook: it
 * regenerates the response files for every cooked mod and byte-compares them against the ones
 * the last real cook left in $WINEPREFIX/.../AutomationTool/Logs/<project>/GSCCookMod<Variant>/
 * and $SDK/Engine/Programs/AutomationTool/Saved/ResponseFiles. `--verify` is the full gate:
 * it repacks into a scratch dir and byte-compares the containers themselves against the staged
 * ones. Both were derived from the cooked trees of AnomaliesHitAllMutants, FasterLootAnimation2x,
 * FasterLootAnimation4x and NPCAttachments.
 *
 * The two commands, captured verbatim from a real UAT log:
 *
 *   1) loose-file pak:
 *      UnrealPak.exe <uproject> -cryptokeys=<Crypto.json> -patchpaddingalign=1048576
 *        -blocksize=1048576 -compressionformats=Oodle -compresslevel=4 -compressmethod=Kraken
 *        -platform=Windows -compressionblocksize=256KB -CreateMultiple=<PakCommands.txt>
 *   2) IoStore container:
 *      UnrealPak.exe <uproject> -CreateDLCContainer=<mod.uplugin> [-RemapPluginContentToGame]
 *        -PackageStoreManifest=<packagestore.manifest> -CookedDirectory=<COOKED>
 *        -Commands=<IoStoreCommands.txt> -ScriptObjects=<scriptobjects.bin>
 *        -patchpaddingalign=1048576 -blocksize=1048576 -compressionformats=Oodle
 *        -compresslevel=4 -compressmethod=Kraken -compressionblocksize=256KB
 *        -cryptokeys=<Crypto.json> -compressionMinBytesSaved=1024 -compressionMinPercentSaved=5
 *        -WriteBackMetadataToAssetRegistry=Disabled -BasedOnReleaseVersionPath=<Releases/Latest/Windows>
 *
 * -RemapPluginContentToGame is the only difference between the variants: present for
 * OverrideContent (the half that replaces base-game files, so its content is remapped from
 * the plugin mount to /Game), absent for NewContent.
 *
 * Entry-list derivation (each rule verified against the real PakList/PakListIoStore and
 * PrePak_Windows_UFSFiles.txt of four cooked mods):
 *  - candidates = every file under COOKED, minus the Metadata/ directories and minus anything
 *    that is not below Stalker2/Mods/<Mod>/. That last clause is what drops the cooked
 *    Stalker2/Content/.../WorldMap_WP.umap|.uexp stub, which UAT rejects with
 *    "Excluding ... from pak files" via its PakFileRules.
 *  - NewContent additionally ships the mod's .uplugin (dest Stalker2/Mods/<Mod>/<Mod>.uplugin).
 *    OverrideContent does not ship it - with the content remapped to /Game there is no plugin
 *    mount to describe.
 *  - OverrideContent additionally ships the mod's loose cfgs from
 *    $SDK/Stalker2/Mods/<Mod>/Content/GameLite/GameData/** -> Stalker2/Content/GameLite/GameData/**.
 *    Only GameData: Config/Custom/ModCook{New,Override}Content/DefaultGame.ini strips every
 *    DirectoriesToAlwaysStageAsUFS entry except GameLite/GameData for OverrideContent, and
 *    strips GameLite/GameData too for NewContent. DLCGameData cfgs are deliberately not packed
 *    by the SDK cook, so this does not pack them either.
 *  - dest for OverrideContent remaps Stalker2/Mods/<Mod>/Content/X -> Stalker2/Content/X;
 *    for NewContent dest is simply the path relative to COOKED.
 *  - .uasset/.umap are primary packages -> PakListIoStore.txt.
 *    .uexp/.ubulk/.uptnl are listed nowhere - IoStore picks the segments up from the primary
 *    package. Everything else (.cfg, .uplugin, AssetRegistry.bin) -> PakList.txt.
 *  - emission order is a walk that yields a directory's own files before its subdirectories,
 *    alphabetically within each level. That is not a plain sort of the dest strings, and the
 *    difference is observable: FasterLootAnimation4x's real list has Content/__ModKit....uasset
 *    (a direct file) before Content/_STALKER2/.../MG_fp_....uasset (a subdirectory), while a
 *    string sort would swap them. Order decides the byte layout inside the container.
 *
 * packagestore.manifest vs the extension rule: the manifest is NOT the authority for what
 * gets packed. AnomaliesHitAllMutants' NewContent manifest lists WorldMap_WP.umap, yet the
 * real PakListIoStore.txt of that very pass does not - the exclusion happens later, in UAT's
 * staging rules. So this module classifies by extension + the "must live under the plugin"
 * rule, and uses the manifest only as a cross-check: every package it emits must appear in
 * the manifest (a package the container writer does not know about is a hard error), while a
 * manifest entry it drops is only logged.
 *
 * The four generated .txt files are UTF-8 with a BOM and CRLF line endings, including a
 * trailing CRLF on the last line - byte-for-byte what UAT writes, because UnrealPak's parser
 * is the one thing here that was never designed to be fed by anything else. Absolute paths
 * inside them are Wine NT paths with backslashes; dest paths are forward-slashed and prefixed
 * with "../../../" (the pak's internal root).
 *
 * They are written into a snapshot dir this module owns (Staged/<mod>/.repack/<variant>/)
 * rather than the SDK's shared Engine/Programs/AutomationTool/Saved/ResponseFiles: the real
 * cook names those files after the container only, so the two variants of one mod collide on
 * the same filename and overwrite each other.
 */

const PACKAGE_EXTENSIONS = new Set([".uasset", ".umap"]);
/** Segments of a primary package. IoStore finds them itself; listing them corrupts the container. */
const SEGMENT_EXTENSIONS = new Set([".uexp", ".ubulk", ".uptnl"]);
const CONTAINER_SUFFIX = "Stalker2-Windows";
const PAK_INTERNAL_ROOT = "../../../";

/** UnrealPak wants NT paths with backslashes in its response files, unlike the -arg form. */
const getNTWinPath = (p: string) => getNTPath(p).replaceAll("/", "\\");

export type RepackEntry = { src: string; dest: string };

/**
 * Files of a directory before its subdirectories, alphabetical within each level - the order
 * UAT's staging manifest comes out in, which the container layout depends on.
 */
function walkFilesBeforeDirs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir).sort();
  const files = entries.filter((entry) => !statSync(path.join(dir, entry)).isDirectory());
  const dirs = entries.filter((entry) => statSync(path.join(dir, entry)).isDirectory());
  return [
    ...files.map((entry) => path.join(dir, entry)),
    ...dirs.flatMap((entry) => walkFilesBeforeDirs(path.join(dir, entry))),
  ];
}

export type VariantPlan = {
  variant: string;
  isOverride: boolean;
  cookedDir: string;
  metadataDir: string;
  stagedPakDir: string;
  snapshotDir: string;
  upluginPath: string;
  /** Name UnrealPak writes and stamps into the container - never the on-disk suffixed name. */
  containerName: string;
  /** What the staged tree actually holds: <Mod>Stalker2-Windows-<Variant>.{pak,utoc,ucas}. */
  stagedBaseName: string;
  looseEntries: RepackEntry[];
  packageEntries: RepackEntry[];
};

/**
 * Everything needed to repack one cook variant, or null when that variant was never cooked
 * (cook.mts skips the NewContent pass for mods with no new packages).
 */
export function planVariant(variant: string, modName: string): VariantPlan | null {
  const sdkModFolder = path.join(sdkModsFolder, modName);
  const cookedDir = path.join(
    process.env.SDK_PATH,
    "Stalker2",
    "SavedMods",
    "Cooked",
    modName,
    "Windows",
    variant,
    "Windows",
  );
  if (!existsSync(cookedDir)) return null;
  // An empty variant directory is a leftover skeleton, not a cook: cook.mts drops
  // Cooked/<mod>/Windows/NewContent when it takes the override-only shortcut, and that can
  // leave the empty dirs behind. Planning from it yields a container with no packages, which
  // UnrealPak rejects with exit code 3 - so treat "no cooked files" as "no such variant".
  if (walkFilesBeforeDirs(cookedDir).length === 0) return null;

  const isOverride = variant === "OverrideContent";
  const pluginRel = path.join("Stalker2", "Mods", modName);
  const pluginCookedDir = path.join(cookedDir, pluginRel);
  const metadataDir = path.join(pluginCookedDir, "Metadata");

  const looseEntries: RepackEntry[] = [];
  const packageEntries: RepackEntry[] = [];
  const push = (entry: RepackEntry) => {
    const extension = path.extname(entry.src).toLowerCase();
    if (SEGMENT_EXTENSIONS.has(extension)) return;
    (PACKAGE_EXTENSIONS.has(extension) ? packageEntries : looseEntries).push(entry);
  };

  // OverrideContent's loose cfgs come first, exactly as the staging manifest orders them.
  if (isOverride) {
    const gameDataDir = path.join(sdkModFolder, "Content", "GameLite", "GameData");
    for (const src of walkFilesBeforeDirs(gameDataDir)) {
      const rest = path.relative(path.join(sdkModFolder, "Content"), src);
      push({ src, dest: path.posix.join("Stalker2", "Content", rest.split(path.sep).join("/")) });
    }
  } else {
    push({
      src: path.join(sdkModFolder, `${modName}.uplugin`),
      dest: path.posix.join("Stalker2", "Mods", modName, `${modName}.uplugin`),
    });
  }

  for (const src of walkFilesBeforeDirs(pluginCookedDir)) {
    if (src.startsWith(metadataDir + path.sep)) continue;
    const rel = path.relative(cookedDir, src).split(path.sep).join("/");
    // With the content remapped to /Game the plugin mount disappears from the dest paths.
    const dest = isOverride
      ? rel.replace(`Stalker2/Mods/${modName}/Content/`, "Stalker2/Content/")
      : rel;
    push({ src, dest });
  }

  // Anything the cook left outside the plugin folder (the WorldMap_WP stub) is not shipped.
  for (const src of walkFilesBeforeDirs(cookedDir)) {
    if (src.startsWith(pluginCookedDir + path.sep)) continue;
    if (SEGMENT_EXTENSIONS.has(path.extname(src).toLowerCase())) continue;
    logger.debug(`[repack] ${variant}: not below ${pluginRel}, excluded from pak files: ${src}`);
  }

  crossCheckAgainstManifest(variant, cookedDir, metadataDir, packageEntries);

  return {
    variant,
    isOverride,
    cookedDir,
    metadataDir,
    // Same string as sdkStagedPakFolderFor(variant), spelled out because planVariant has to
    // work for an arbitrary mod name (the list self-check runs over every cooked reference
    // mod, not just the one S2_MOD selects). repackMod asserts the two agree.
    stagedPakDir: path.join(
      sdkStagedFolder,
      modName,
      "Windows",
      variant,
      "Windows",
      "Stalker2",
      "Mods",
      modName,
      "Content",
      "Paks",
      "Windows",
    ),
    snapshotDir: path.join(sdkStagedFolder, modName, ".repack", variant),
    upluginPath: path.join(sdkModFolder, `${modName}.uplugin`),
    containerName: `${modName}${CONTAINER_SUFFIX}`,
    stagedBaseName: `${modName}${CONTAINER_SUFFIX}-${variant}`,
    looseEntries,
    packageEntries,
  };
}

/**
 * packagestore.manifest is the oplog the container writer reads ("Fetched N oplog items from
 * Manifest"). It is a UE compact-binary blob, but the only field needed here is each entry's
 * "filename", which is a plain mount-relative path - so scrape those rather than implementing
 * a CbObject reader for one string field.
 */
function manifestPackagePaths(metadataDir: string): string[] {
  const manifest = path.join(metadataDir, "packagestore.manifest");
  if (!existsSync(manifest)) return [];
  const matches = readFileSync(manifest)
    .toString("latin1")
    .match(/Stalker2\/[\w/.\-]+\.(?:uasset|umap)/g);
  return [...new Set(matches ?? [])];
}

function crossCheckAgainstManifest(
  variant: string,
  cookedDir: string,
  metadataDir: string,
  packageEntries: RepackEntry[],
) {
  const manifestPaths = manifestPackagePaths(metadataDir);
  if (manifestPaths.length === 0) return;

  // Compare on the pre-remap path: the manifest records where the cook wrote the package,
  // which is always below the plugin mount regardless of the remap applied to the dest.
  const preRemap = new Set(
    packageEntries.map(({ src }) => path.relative(cookedDir, src).split(path.sep).join("/")),
  );

  for (const missing of [...preRemap].filter((entry) => !manifestPaths.includes(entry))) {
    throw new Error(
      `[repack] ${variant}: ${missing} would be written to the IoStore container but is absent ` +
        `from packagestore.manifest. The cooked tree and its manifest disagree - re-cook.`,
    );
  }
  for (const dropped of manifestPaths.filter((entry) => !preRemap.has(entry))) {
    // Expected for the WorldMap_WP stub; anything else is worth a look.
    logger.debug(
      `[repack] ${variant}: in manifest but not shipped (matching the real cook): ${dropped}`,
    );
  }
}

/** UTF-8 BOM + CRLF, and a trailing CRLF on the last line. UnrealPak's parser expects both. */
function writeResponseFile(file: string, lines: string[]) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, "﻿" + lines.map((line) => `${line}\r\n`).join(""), "utf8");
  return file;
}

const listLine = ({ src, dest }: RepackEntry) =>
  `"${getNTWinPath(src)}" "${PAK_INTERNAL_ROOT}${dest}" -compress`;

export type ResponseFiles = {
  pakCommands: string;
  ioStoreCommands: string;
  pakList: string;
  pakListIoStore: string;
};

/**
 * Write the four response files for one variant. `outputDir` is where the containers should
 * land - the staged pak folder normally, a scratch dir when verifying.
 */
export function writeResponseFiles(
  plan: VariantPlan,
  { snapshotDir = plan.snapshotDir, outputDir = plan.stagedPakDir } = {},
): ResponseFiles {
  const pakList = writeResponseFile(
    path.join(snapshotDir, `PakList_${plan.containerName}.txt`),
    plan.looseEntries.map(listLine),
  );
  const pakListIoStore = writeResponseFile(
    path.join(snapshotDir, `PakListIoStore_${plan.containerName}.txt`),
    plan.packageEntries.map(listLine),
  );
  const pakCommands = writeResponseFile(path.join(snapshotDir, "PakCommands.txt"), [
    `"${getNTWinPath(path.join(outputDir, `${plan.containerName}.pak`))}" -create="${getNTWinPath(pakList)}"`,
  ]);
  const ioStoreCommands = writeResponseFile(path.join(snapshotDir, "IoStoreCommands.txt"), [
    `-Output="${getNTWinPath(path.join(outputDir, `${plan.containerName}.utoc`))}" ` +
      `-ContainerName=${plan.containerName} -ResponseFile="${getNTWinPath(pakListIoStore)}"`,
  ]);
  return { pakCommands, ioStoreCommands, pakList, pakListIoStore };
}

/** Shared by both passes, in the order the real cook emits them. */
const UNREAL_PAK_COMPRESSION = [
  "-patchpaddingalign=1048576",
  "-blocksize=1048576",
  "-compressionformats=Oodle",
  "-compresslevel=4",
  "-compressmethod=Kraken",
];

function unrealPakCommands(plan: VariantPlan, files: ResponseFiles) {
  const unrealPak = getNTPath(
    path.join(process.env.SDK_PATH, "Engine", "Binaries", "Win64", "UnrealPak.exe"),
  );
  const uproject = getNTPath(path.join(process.env.SDK_PATH, "Stalker2", "Stalker2.uproject"));
  const cryptoKeys = getNTPath(path.join(plan.metadataDir, "Crypto.json"));

  return [
    [
      process.env.WINE,
      `"${unrealPak}"`,
      `"${uproject}"`,
      `"-cryptokeys=${cryptoKeys}"`,
      ...UNREAL_PAK_COMPRESSION,
      "-platform=Windows",
      "-compressionblocksize=256KB",
      `"-CreateMultiple=${getNTPath(files.pakCommands)}"`,
    ].join(" "),
    [
      process.env.WINE,
      `"${unrealPak}"`,
      `"${uproject}"`,
      `"-CreateDLCContainer=${getNTPath(plan.upluginPath)}"`,
      ...(plan.isOverride ? ["-RemapPluginContentToGame"] : []),
      `"-PackageStoreManifest=${getNTPath(path.join(plan.metadataDir, "packagestore.manifest"))}"`,
      `"-CookedDirectory=${getNTPath(plan.cookedDir)}"`,
      `"-Commands=${getNTPath(files.ioStoreCommands)}"`,
      `"-ScriptObjects=${getNTPath(path.join(plan.metadataDir, "scriptobjects.bin"))}"`,
      ...UNREAL_PAK_COMPRESSION,
      "-compressionblocksize=256KB",
      `"-cryptokeys=${cryptoKeys}"`,
      "-compressionMinBytesSaved=1024",
      "-compressionMinPercentSaved=5",
      "-WriteBackMetadataToAssetRegistry=Disabled",
      `"-BasedOnReleaseVersionPath=${getNTPath(
        path.join(process.env.SDK_PATH, "Stalker2", "Releases", "Latest", "Windows"),
      )}"`,
    ].join(" "),
  ];
}

const CONTAINER_EXTENSIONS = [".pak", ".utoc", ".ucas"] as const;

/**
 * Run both UnrealPak passes for one variant, then rename the containers to the suffixed names
 * the staged tree carries. The suffix has to be applied afterwards rather than passed in:
 * -ContainerName is stamped inside the .utoc, and the real cook always stamps the
 * un-suffixed <Mod>Stalker2-Windows there.
 */
function runVariant(plan: VariantPlan, outputDir: string) {
  const files = writeResponseFiles(plan, { outputDir });
  mkdirSync(outputDir, { recursive: true });

  for (const command of unrealPakCommands(plan, files)) {
    logger.log(command + "\n");
    if (process.env.DRY) continue;
    childProcess.execSync(command, { stdio: "inherit", cwd: projectRoot, shell: "/usr/bin/bash" });
  }
  if (process.env.DRY) {
    logger.log(
      `DRY: would rename ${plan.containerName}.* to ${plan.stagedBaseName}.* in ${outputDir}`,
    );
    return;
  }

  for (const extension of CONTAINER_EXTENSIONS) {
    const produced = path.join(outputDir, `${plan.containerName}${extension}`);
    if (!existsSync(produced)) {
      throw new Error(`[repack] ${plan.variant}: UnrealPak produced no ${produced}`);
    }
    const target = path.join(outputDir, `${plan.stagedBaseName}${extension}`);
    rmSync(target, { force: true });
    childProcess.execSync(`mv -f "${produced}" "${target}"`, { shell: "/usr/bin/bash" });
  }
  logger.log(
    `[repack] ${plan.variant}: wrote ${plan.stagedBaseName}.{pak,utoc,ucas} to ${outputDir}`,
  );
}

/**
 * Rebuild the shipped containers of the current mod from the already-cooked tree, for every
 * cook variant that has one. Does not touch the cooked assets, so it is only correct when the
 * cooked .uasset/.uexp are current - it is the tail of a cook, not a replacement for one.
 */
export async function repackMod(): Promise<void> {
  const modName = await sdkModName;
  return withSdkMutationLock(`repackMod:${modName}`, async () => {
    const plans = cookVariants
      .map((variant) => planVariant(variant, modName))
      .filter((plan): plan is VariantPlan => plan !== null);
    if (plans.length === 0) {
      throw new Error(
        `[repack] no cooked tree for ${modName} under SavedMods/Cooked - cook it once first.`,
      );
    }
    for (const plan of plans) {
      const expected = await sdkStagedPakFolderFor(plan.variant);
      if (plan.stagedPakDir !== expected) {
        throw new Error(`[repack] staged pak folder drifted: ${plan.stagedPakDir} != ${expected}`);
      }
      logger.log(
        `[repack] ${plan.variant}: ${plan.looseEntries.length} loose + ` +
          `${plan.packageEntries.length} package entries`,
      );
      runVariant(plan, plan.stagedPakDir);
    }
  });
}

/**
 * Unpack two .paks with repak and compare the extracted trees. Used instead of a byte compare
 * because of the per-run path hash seed - see the call site.
 */
function pakContentsEqual(expected: string, actual: string): boolean {
  const repak = process.env.REPAK_PATH;
  if (!repak || !existsSync(repak)) {
    logger.log("[repack] REPAK_PATH is unset or missing - cannot compare .pak entries.");
    return false;
  }
  const root = path.join(os.tmpdir(), `s2mods-pak-compare-${process.pid}`);
  try {
    const trees = [expected, actual].map((pak, index) => {
      const out = path.join(root, String(index));
      rmSync(out, { recursive: true, force: true });
      mkdirSync(out, { recursive: true });
      execFileSync(repak, ["unpack", "-o", out, pak], { stdio: "pipe" });
      return out;
    });
    const listing = (tree: string): Map<string, Buffer> =>
      new Map(
        walkFilesBeforeDirs(tree).map(
          (file) => [path.relative(tree, file), readFileSync(file)] as const,
        ),
      );
    const [a, b] = trees.map(listing);
    if (a.size !== b.size) return false;
    return [...a].every(([rel, bytes]) => b.get(rel)?.equals(bytes) ?? false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/**
 * The correctness gate: repack into a scratch dir and compare against the containers the real
 * cook left in the staged tree. Returns the number of mismatching files.
 */
export async function verifyRepack(): Promise<number> {
  const modName = await sdkModName;
  return withSdkMutationLock(`verifyRepack:${modName}`, async () => {
    const rows: { file: string; status: string }[] = [];
    for (const variant of cookVariants) {
      const plan = planVariant(variant, modName);
      if (!plan) continue;
      const scratch = path.join(sdkStagedFolder, modName, ".repack", `${variant}-verify`);
      rmSync(scratch, { recursive: true, force: true });
      runVariant(plan, scratch);
      if (process.env.DRY) continue;

      const expectedDir = await sdkStagedPakFolderFor(variant);
      for (const extension of CONTAINER_EXTENSIONS) {
        const name = `${plan.stagedBaseName}${extension}`;
        const expected = path.join(expectedDir, name);
        const actual = path.join(scratch, name);
        if (!existsSync(expected)) {
          rows.push({ file: name, status: "MISSING BASELINE" });
          continue;
        }
        if (readFileSync(expected).equals(readFileSync(actual))) {
          rows.push({ file: name, status: "match" });
          continue;
        }
        // A .pak is not byte-reproducible, not even by the cook itself: UnrealPak stamps a
        // per-run `path hash seed` into the index and salts every entry's path hash with it.
        // Measured: the two variants of one mod, cooked minutes apart, carry different seeds
        // (223EAFB2 / 64F442FA), and a repack of identical inputs produced a third. So compare
        // what the game actually consumes - the entries - and treat a seed-only diff as a match.
        if (extension === ".pak") {
          const entriesMatch = pakContentsEqual(expected, actual);
          rows.push({
            file: name,
            status: entriesMatch ? "match (entries; seed differs)" : "MISMATCH (entries differ)",
          });
          continue;
        }
        rows.push({
          file: name,
          status: `MISMATCH (${statSync(expected).size} baseline vs ${statSync(actual).size} bytes)`,
        });
      }
    }

    const width = Math.max(0, ...rows.map(({ file }) => file.length));
    for (const { file, status } of rows) logger.log(`  ${file.padEnd(width)}  ${status}`);
    // "match (entries; seed differs)" is a pass - see the .pak note above.
    const failures = rows.filter(({ status }) => !status.startsWith("match")).length;
    logger.log(
      failures === 0
        ? `[repack] verify OK - ${rows.length} files match the cook's output.`
        : `[repack] verify FAILED - ${failures}/${rows.length} files differ.`,
    );
    return failures;
  });
}

/**
 * UAT's own copy of the response files, left behind by the last cook: the per-pass copies in
 * the Wine-side AutomationTool log folder, and the shared ResponseFiles dir. The log folder is
 * named after the NT project root with the colon dropped and the slashes turned into '+'.
 */
function capturedResponseFiles(modName: string, variant: string) {
  const logRoot = path.join(
    process.env.WINEPREFIX ?? "",
    "drive_c/users/steamuser/AppData/Roaming/Unreal Engine/AutomationTool/Logs",
    getNTPath(process.env.SDK_PATH).replace(":", "").replace(/\/$/, "").replaceAll("/", "+"),
    `GSCCookMod${variant}`,
  );
  const shared = path.join(
    process.env.SDK_PATH,
    "Engine/Programs/AutomationTool/Saved/ResponseFiles",
  );
  return {
    pakCommands: path.join(logRoot, "PakCommands.txt"),
    ioStoreCommands: path.join(logRoot, "IoStoreCommands.txt"),
    // Named after the container only, so the second pass of a mod overwrites the first: for
    // any given mod only the last variant that ran is still on disk here.
    pakList: path.join(shared, `PakList_${modName}${CONTAINER_SUFFIX}.txt`),
    pakListIoStore: path.join(shared, `PakListIoStore_${modName}${CONTAINER_SUFFIX}.txt`),
  };
}

/**
 * Both reference locations are single-slot: the log folder is keyed by the project root, not by
 * the mod, and the shared ResponseFiles are named after the container, not the variant. So
 * whichever pass ran last owns the file, and a reference that names another mod, another
 * variant, or the SDK's previous drive letter proves nothing either way.
 */
function referenceBelongsTo(capturedText: string, modName: string, variant: string) {
  if (capturedText.replace("﻿", "").trim() === "") return false;
  if (!capturedText.includes(getNTWinPath(path.join(process.env.SDK_PATH, "Stalker2"))))
    return false;
  if (!capturedText.includes(`\\${modName}\\`)) return false;
  // Cooked/staged paths carry the variant; a pure loose-cfg list does not, but only the
  // OverrideContent pass ever produces one.
  return capturedText.includes("SavedMods") ? capturedText.includes(`\\${variant}\\`) : true;
}

/**
 * The free correctness check: no Wine, no cook. Regenerate the four response files for every
 * cooked mod and byte-compare them against the ones the real cook left behind. If these match,
 * UnrealPak is being fed exactly what the SDK fed it.
 *
 * The two *Commands.txt files legitimately differ in one place - they name the PakList to read,
 * and this module keeps its own snapshot copy instead of the SDK's collision-prone shared dir -
 * so their response-file argument is normalized away before comparing.
 */
export function verifyResponseFileLists(): number {
  const cookedRoot = path.join(process.env.SDK_PATH, "Stalker2", "SavedMods", "Cooked");
  const mods = existsSync(cookedRoot) ? readdirSync(cookedRoot).sort() : [];
  const rows: { label: string; status: string }[] = [];

  for (const modName of mods) {
    for (const variant of cookVariants) {
      const plan = planVariant(variant, modName);
      if (!plan) continue;
      const scratch = path.join(sdkStagedFolder, modName, ".repack", `${variant}-lists`);
      rmSync(scratch, { recursive: true, force: true });
      const generated = writeResponseFiles(plan, { snapshotDir: scratch });
      const captured = capturedResponseFiles(modName, variant);

      for (const key of Object.keys(generated) as (keyof ResponseFiles)[]) {
        const label = `${modName}/${variant}/${path.basename(generated[key])}`;
        if (!existsSync(captured[key])) {
          rows.push({ label, status: "no captured reference" });
          continue;
        }
        const capturedText = readFileSync(captured[key], "utf8");
        if (!referenceBelongsTo(capturedText, modName, variant)) {
          rows.push({ label, status: "stale reference (another mod or pass wrote it last)" });
          continue;
        }
        // The response-file argument is the one path that is ours by design.
        const strip = (text: string) => text.replace(/-(?:create|ResponseFile)="[^"]*"/, "");
        const same = strip(readFileSync(generated[key], "utf8")) === strip(capturedText);
        rows.push({ label, status: same ? "match" : "MISMATCH" });
      }
    }
  }

  const width = Math.max(0, ...rows.map(({ label }) => label.length));
  for (const { label, status } of rows) logger.log(`  ${label.padEnd(width)}  ${status}`);
  const failures = rows.filter(({ status }) => status === "MISMATCH").length;
  logger.log(
    failures === 0
      ? `[repack] response files OK (${rows.filter((row) => row.status === "match").length} compared).`
      : `[repack] response files FAILED - ${failures} mismatching.`,
  );
  return failures;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  if (process.argv.includes("--verify-lists")) {
    process.exitCode = verifyResponseFileLists() === 0 ? 0 : 1;
  } else if (process.argv.includes("--verify")) {
    process.exitCode = (await verifyRepack()) === 0 ? 0 : 1;
  } else {
    await repackMod();
  }
}
