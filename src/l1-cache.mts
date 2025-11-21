import { Struct } from "s2cfgtojson";
import fs from "node:fs";
import { logger } from "./logger.mjs";
import { readWithUnzip, writeWithZip } from "./zip.mjs";
import { modFolder } from "./base-paths.mjs";
import path from "node:path";

const L1CacheFileName = path.join(modFolder, ".l1.cache.zlib");
export const L1CacheState = {
  needsUpdate: false,
};
/**
 * L1 Cache for storing parsed Structs.
 * Key: absolute file path of .cfg file
 * Value: array of parsed Struct objects
 */
export const L1Cache: Record<string, Struct[]> = fs.existsSync(L1CacheFileName)
  ? Object.fromEntries(
      JSON.parse(await readWithUnzip(L1CacheFileName)).map(([k, v]: [string, any]) => [
        k,
        v.map((e: any) => Struct.fromJson(e, true)),
      ]),
    )
  : {};

export const onL1Finish = () => {
  if (!L1CacheState.needsUpdate) return;
  logger.log("Writing L1 cache to " + L1CacheFileName);
  return writeWithZip(
    L1CacheFileName,
    JSON.stringify(Object.entries(L1Cache).map(([k, v]) => [k, v.map((e) => e.toJson(true))])),
  );
};
