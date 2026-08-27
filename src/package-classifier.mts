import path from "node:path";
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import { logger } from "./logger.mts";
import { sdkModFolder, sdkModName, sdkPackageClassifierFolder } from "./mod-meta-paths.mts";

/** Only Unreal packages are classified. .cfg patches are handled by the pipeline, not these lists. */
const packageExtensions = new Set([".uasset", ".umap"]);

/**
 * The editor's cached asset registry, which lists every vanilla package by its long name.
 * It is our stand-in for the registry ModPackageClassifier itself queries.
 */
const assetRegistryCaches = () => {
  const dir = path.join(
    process.env.WINEPREFIX ?? "",
    "drive_c/users/steamuser/AppData/Local/Stalker2/Intermediate",
  );
  if (!process.env.WINEPREFIX || !existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^CachedAssetRegistry_\d+\.bin$/.test(f))
    .map((f) => path.join(dir, f));
};

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/**
 * Which of the mod's packages already exist in the vanilla game, as `/Game/<path>` entries.
 * One grep pass per registry file over a fixed pattern list - a few seconds against 1.4 GB,
 * versus a 25-minute cook that produces the wrong container.
 */
function findVanillaPackages(relativePaths: string[]): Set<string> {
  const found = new Set<string>();
  const caches = assetRegistryCaches();
  if (!caches.length) return found;

  const patterns = relativePaths.map((p) => `/Game/${p}`).join("\n");
  for (const cache of caches) {
    const { stdout } = spawnSync("grep", ["-aoFf", "-", cache], {
      input: patterns,
      encoding: "utf8",
      maxBuffer: 1 << 28,
    });
    stdout?.split("\n").forEach((line) => line && found.add(line.slice("/Game/".length)));
  }
  return found;
}

/**
 * The lists GSCCookMod steers its two halves with. ModPackageClassifier normally writes them
 * when the mod is packaged from the Mod Editor; driving the cook from the CLI skips that, and
 * the cook then dies with `LogGSCAssetManager: Error: AssetsToNeverCookWithDLCList file not found`.
 *
 * A package is Override Content when the vanilla game already has a package at the same path
 * (it is remapped onto Stalker2/Content at mount time) and New Content otherwise - including
 * the plugin's own `<mod>.uasset` root and anything under ExternalActors/ContentBundle.
 */
export async function writePackageClassifierLists() {
  const name = await sdkModName;
  const contentDir = path.join(await sdkModFolder, "Content");
  const outDir = await sdkPackageClassifierFolder;

  // Path below Content with the extension dropped: the tail shared by the mod's package name
  // (/<mod>/<tail>) and the vanilla one it would override (/Game/<tail>).
  const tails = walk(contentDir)
    .filter((f) => packageExtensions.has(path.extname(f).toLowerCase()))
    .map((f) =>
      path
        .relative(contentDir, f)
        .replaceAll(path.sep, "/")
        .replace(/\.[^.]+$/, ""),
    )
    .sort();

  const vanilla = findVanillaPackages(tails);
  if (!vanilla.size && tails.length) {
    logger.warn(
      "Could not read the cached asset registry (WINEPREFIX unset, or the Mod Editor has never run). " +
        "Treating every package as new content - check the lists before trusting the cook.",
    );
  }
  const overridePackages = tails.filter((t) => vanilla.has(t)).map((t) => `/${name}/${t}`);
  const newPackages = tails.filter((t) => !vanilla.has(t)).map((t) => `/${name}/${t}`);

  // CRLF, matching what the Mod Editor writes - the cook reads these through Wine.
  const serialize = (lines: string[]) => lines.map((p) => p + "\r\n").join("");

  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "NewPackages.txt"), serialize(newPackages));
  writeFileSync(path.join(outDir, "OverridePackages.txt"), serialize(overridePackages));

  logger.log(
    `Wrote PackageClassifier lists to ${outDir}: ` +
      `${newPackages.length} new, ${overridePackages.length} override package(s).`,
  );
  newPackages.forEach((p) => logger.debug(`  new:      ${p}`));
  overridePackages.forEach((p) => logger.debug(`  override: ${p}`));
}
