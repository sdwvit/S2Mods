import path from "node:path";
import { baseCfgDir } from "./base-paths.mjs";
import { existsSync } from "node:fs";
import { getCfgFiles } from "./get-cfg-files.mjs";
import { Struct } from "s2cfgtojson";
import { L1Cache, L1CacheState } from "./l1-cache.mjs";
import { logger } from "./logger.mjs";
import { readFile } from "node:fs/promises";

export const readFileAndGetStructs = async <T extends Struct>(
  filePath: string,
  filePreprocess?: (fileContents: string) => string,
): Promise<T[]> => {
  let fullPath = path.join(baseCfgDir, "GameData", filePath);

  if (!existsSync(fullPath)) {
    fullPath = (await getCfgFiles(filePath, true))[0];
    if (!fullPath) {
      console.error(`File not found: ${filePath}`);
      return [];
    }
  }

  if (L1Cache[fullPath] && !filePreprocess) {
    logger.log(`Using L1 cache for file: ${fullPath}`);
    return L1Cache[fullPath] as T[];
  } else {
    const fileContents = await readFile(fullPath, "utf8");
    const processed = filePreprocess ? filePreprocess(fileContents) : fileContents;
    const parsed = Struct.fromString<T>(processed);
    if (!filePreprocess) {
      L1Cache[fullPath] = parsed;
      L1CacheState.needsUpdate = true;
    }
    return parsed;
  }
};
