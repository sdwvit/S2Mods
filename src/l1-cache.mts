import { Struct } from "s2cfgtojson";
import fs from "node:fs";
import { logger } from "./logger.mjs";
import { readWithUnzip, writeWithZip } from "./zip.mjs";
import path from "node:path";
import { modFolder } from "./base-paths.mts";
import { EntriesTransformer } from "./meta-type.mts";
import { readFile } from "node:fs/promises";
import { getOrUpdateFromL1GlobalCache, L1GlobalCache, L1GlobalCacheState } from "./l1global-cache.mts";

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
      JSON.parse(await readWithUnzip(L1CacheFileName)).map(([k, v]: [string, any]) => [k, v.map((e: any) => Struct.fromJson(e, true))]),
    )
  : {};

export async function getOrUpdateFromL1Cache<T extends Struct>(filePath: string, transformer: EntriesTransformer<T>) {
  const key = getL1Key(filePath, transformer);
  if (L1Cache[key]) {
    return L1Cache[key] as T[];
  }
  L1CacheState.needsUpdate = true;
  L1Cache[key] = await getOrUpdateFromL1GlobalCache(filePath);

  if (transformer.contents?.length) {
    L1Cache[key] = L1Cache[key].filter((s) => {
      const sStr = s.toString();
      return transformer.contents.some((e) => sStr.includes(e));
    });
  }
  return L1Cache[key] as T[];
}

export function getFromL1Cache<T extends Struct>(filePath: string, transformer: EntriesTransformer<T>) {
  return L1Cache[getL1Key(filePath, transformer)];
}

export const getL1Key = (filePath: string, transformer: EntriesTransformer<any>) =>
  `${filePath}${transformer.contents ? `:${transformer.contents.sort().join()}` : ""}`;

export const onL1Finish = () => {
  if (!L1CacheState.needsUpdate) return;
  logger.log("Writing L1 cache to " + L1CacheFileName);
  return writeWithZip(L1CacheFileName, JSON.stringify(Object.entries(L1Cache).map(([k, v]) => [k, v.map((e) => e.toJson(true))])));
};
