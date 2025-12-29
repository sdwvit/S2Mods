import { Struct } from "s2cfgtojson";
import fs from "node:fs";
import { logger } from "./logger.mjs";
import { readWithUnzip, writeWithZip } from "./zip.mjs";
import path from "node:path";
import { projectRoot } from "./base-paths.mts";
import { readFile } from "node:fs/promises";

const L1GlobalCacheFileName = path.join(projectRoot, ".l1.cache.zlib");
export const L1GlobalCacheState = {
  needsUpdate: false,
};
/**
 * L1Global Cache for storing parsed Structs.
 * Key: absolute file path of .cfg file
 * Value: array of parsed Struct objects
 */
export const L1GlobalCache: Record<string, Struct[]> = fs.existsSync(L1GlobalCacheFileName)
  ? Object.fromEntries(
      JSON.parse(await readWithUnzip(L1GlobalCacheFileName)).map(([k, v]: [string, any]) => [k, v.map((e: any) => Struct.fromJson(e, true))]),
    )
  : {};

export async function getOrUpdateFromL1GlobalCache<T extends Struct>(filePath: string) {
  const key = getL1GlobalKey(filePath);
  if (L1GlobalCache[key]) {
    return L1GlobalCache[key] as T[];
  }

  L1GlobalCacheState.needsUpdate = true;
  const rawContent = await readFile(filePath, "utf8");
  L1GlobalCache[key] = Struct.fromString(rawContent);
  return L1GlobalCache[key] as T[];
}

export function getFromL1GlobalCache(filePath: string) {
  return L1GlobalCache[getL1GlobalKey(filePath)];
}

export const getL1GlobalKey = (filePath: string) => filePath;

export const onL1GlobalFinish = () => {
  if (!L1GlobalCacheState.needsUpdate) return;
  logger.log("Writing L1Global cache to " + L1GlobalCacheFileName);
  return writeWithZip(L1GlobalCacheFileName, JSON.stringify(Object.entries(L1GlobalCache).map(([k, v]) => [k, v.map((e) => e.toJson(true))])));
};
