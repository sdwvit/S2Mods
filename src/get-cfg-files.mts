import fs, { lstatSync } from "node:fs";
import path from "node:path";
import { baseCfgDir, dlcCfgDir } from "./base-paths.mts";
import { L3Cache, L3CacheState } from "./cache/l3-cache.mts";
import { logger } from "./logger.mts";

let allCfgs;
export async function getCfgFiles(suffix = "", contains = false): Promise<string[]> {
  if (L3Cache[suffix]?.length) {
    logger.log(`Using cached .cfg files for suffix "${suffix}" (${L3Cache[suffix].length} files)`);
    return L3Cache[suffix];
  }
  L3CacheState.needsUpdate = true;
  const cfgFiles: string[] = allCfgs ?? [];

  if (!cfgFiles.length) {
    logger.log("Scanning all .cfg files in " + baseCfgDir);
    getScanner(cfgFiles, ".cfg")(baseCfgDir);
  }
  allCfgs = cfgFiles;
  if (suffix) {
    if (contains) {
      L3Cache[suffix] = cfgFiles.filter((f: string) => f.includes(suffix));
    } else {
      L3Cache[suffix] = cfgFiles.filter((f) => f.endsWith(suffix));
    }
  }

  return L3Cache[suffix];
}

let allDlcCfgs: string[];
/**
 * DLC .cfg files are flat: every DLC item (weapon, armor, attach, ...) sits in a single
 * DLCGameData/<DLC>/ItemPrototypes.cfg instead of the per-type files GameData has.
 * A DLC struct declares its origin via `refurl` pointing back at the GameData file it
 * derives from, so a transformer targeting e.g. "/WeaponPrototypes.cfg" is matched against
 * those refurls. Structs inside the matched file are filtered per-struct later, see
 * `filterDlcStructsForTransformer` in get-cfg-file-processor.mts.
 */
export async function getDlcCfgFiles(suffix: string, contains = false): Promise<string[]> {
  const cacheKey = `dlc:${contains ? "contains:" : ""}${suffix}`;
  if (L3Cache[cacheKey]) {
    logger.log(`Using cached DLC .cfg files for suffix "${suffix}" (${L3Cache[cacheKey].length} files)`);
    return L3Cache[cacheKey];
  }
  L3CacheState.needsUpdate = true;

  if (!allDlcCfgs) {
    if (!fs.existsSync(dlcCfgDir)) {
      logger.warn(`No DLC game data found in ${dlcCfgDir}, skipping DLC .cfg files.`);
      allDlcCfgs = [];
    } else {
      logger.log("Scanning all DLC .cfg files in " + dlcCfgDir);
      allDlcCfgs = [];
      getScanner(allDlcCfgs, ".cfg")(dlcCfgDir);
    }
  }

  L3Cache[cacheKey] = allDlcCfgs.filter((f) =>
    getRefUrls(f).some((refurl) => (contains ? refurl.includes(suffix) : refurl.endsWith(suffix))),
  );
  return L3Cache[cacheKey];
}

const refUrlsPerFile: Record<string, string[]> = {};
/**
 * All distinct `refurl` targets declared in a .cfg, normalized to a GameLite-relative-ish
 * path (leading `../` segments dropped), e.g. "GameData/ItemPrototypes/WeaponPrototypes.cfg".
 */
export function getRefUrls(filePath: string): string[] {
  refUrlsPerFile[filePath] ??= [
    ...new Set(
      Array.from(
        fs.readFileSync(filePath, "utf-8").matchAll(/refurl\s*=\s*([^;}\s]+)/g),
        (m) => "/" + m[1].replace(/^(?:\.\.\/)+/, ""),
      ),
    ),
  ];
  return refUrlsPerFile[filePath];
}

/**
 * scan all local .cfg files
 */
export const getScanner = (cfgFilesArr: string[], suffix = ".cfg") =>
  function scanAllDirs(start: string): void {
    const files = fs.readdirSync(start);
    for (const file of files) {
      if (lstatSync(path.join(start, file)).isDirectory() && !file.includes("DLCGameData")) {
        scanAllDirs(path.join(start, file));
      } else if (file.endsWith(suffix)) {
        cfgFilesArr.push(path.join(start, file));
      }
    }
  };
