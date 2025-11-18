import { Struct } from "s2cfgtojson";
import fs from "node:fs";
import path from "node:path";
import { logger } from "./logger.mjs";
import { writeFile } from "node:fs/promises";
import { baseCfgDir, modFolder } from "./base-paths.mjs";

const L1CacheFileName = path.join(modFolder, ".l1.cache.json");
export const L1CacheState = {
  needsUpdate: false,
};
export const L1Cache: Record<string, Struct[]> = fs.existsSync(L1CacheFileName)
  ? Object.fromEntries(
      JSON.parse(fs.readFileSync(L1CacheFileName).toString()).map(([k, v]: [string, any]) => [
        path.join(baseCfgDir, k),
        v.map((e: any) => Struct.fromJson(e, true)),
      ]),
    )
  : {};

export const onL1Finish = () => {
  if (!L1CacheState.needsUpdate) return;
  logger.log("Writing L1 cache to " + L1CacheFileName);
  return writeFile(
    L1CacheFileName,
    JSON.stringify(
      Object.entries(L1Cache).map(([k, v]) => [k.slice(baseCfgDir.length + 1), v.map((e) => e.toJson(true))]),
    ),
  );
};
