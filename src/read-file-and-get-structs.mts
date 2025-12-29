import path from "node:path";
import { baseCfgDir } from "./base-paths.mjs";
import { existsSync } from "node:fs";
import { getCfgFiles } from "./get-cfg-files.mjs";
import { Struct } from "s2cfgtojson";
import { getOrUpdateFromL1GlobalCache } from "./l1global-cache.mts";
import { logger } from "./logger.mts";

export const readFileAndGetStructs = async <T extends Struct>(filePath: string, filePreprocess?: (fileContents: string) => string): Promise<T[]> => {
  let fullPath = path.join(baseCfgDir, "GameData", filePath);

  if (!existsSync(fullPath)) {
    fullPath = (await getCfgFiles(filePath, true))[0];
    if (!fullPath) {
      logger.error(`File not found: ${filePath}`);
      return [];
    }
  }

  const parsed = await getOrUpdateFromL1GlobalCache<T>(fullPath);

  if (filePreprocess) {
    return Struct.fromString<T>(filePreprocess(parsed.map((s) => s.toString()).join("\n")));
  } else {
    logger.log(`Using L1 cache for file: ${fullPath}`);
    return parsed;
  }
};
