import fs from "node:fs";
import path from "node:path";
import { baseCfgDir, modFolder } from "./base-paths.mjs";
import { writeFile } from "node:fs/promises";
import { logger } from "./logger.mjs";

const L3CacheFileName = path.join(modFolder, ".l3.cache.json");
export const L3CacheState = {
  needsUpdate: false,
};
export const L3Cache: Record<string, string[]> = fs.existsSync(L3CacheFileName)
  ? Object.fromEntries(
      JSON.parse(fs.readFileSync(L3CacheFileName).toString()).map((e) => [
        e[0],
        e[1].map((f: string) => path.join(baseCfgDir, f)),
      ]),
    )
  : {};

export const onL3Finish = () => {
  if (!L3CacheState.needsUpdate) return;
  logger.log("Writing L3 cache to " + L3CacheFileName);
  const L3Entries = Object.entries(L3Cache).map(
    (f) => [f[0], f[1].map((e) => e.slice(baseCfgDir.length + 1))] as const,
  );

  return writeFile(L3CacheFileName, JSON.stringify(L3Entries));
};
