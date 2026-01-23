import { Struct } from "s2cfgtojson";
import fs from "node:fs";
import { logger } from "./logger.mjs";
import { readWithUnzip, writeWithZip } from "./zip.mjs";
import path from "node:path";
import { projectRoot } from "./base-paths.mts";
import { readFile } from "node:fs/promises";

const L1GlobalTypeGenCacheFileName = path.join(projectRoot, ".l1.type-gen.cache.zlib");
export const L1GlobalTypeGenCacheState = {
  needsUpdate: false,
};
/**
 * L1GlobalTypeGen Cache for storing parsed Structs.
 * Key: absolute file path of .cfg file
 * Value: array of parsed Struct objects
 */
export const L1GlobalTypeGenCache: Record<string, Struct[]> = fs.existsSync(L1GlobalTypeGenCacheFileName)
  ? Object.fromEntries(
      JSON.parse(await readWithUnzip(L1GlobalTypeGenCacheFileName)).map(([k, v]: [string, any]) => [k, v.map((e: any) => Struct.fromJson(e, true))]),
    )
  : {};

export async function getOrUpdateFromL1GlobalTypeGenCache<T extends Struct>(filePath: string) {
  const key = getL1GlobalTypeGenKey(filePath);
  if (L1GlobalTypeGenCache[key]) {
    return L1GlobalTypeGenCache[key] as T[];
  }

  L1GlobalTypeGenCacheState.needsUpdate = true;
  const rawContent = await readFile(filePath, "utf8");
  L1GlobalTypeGenCache[key] = Struct.fromString(rawContent);
  return L1GlobalTypeGenCache[key] as T[];
}

export function getFromL1GlobalTypeGenCache(filePath: string) {
  return L1GlobalTypeGenCache[getL1GlobalTypeGenKey(filePath)];
}

export const getL1GlobalTypeGenKey = (filePath: string) => filePath;

export const onL1GlobalTypeGenFinish = () => {
  if (!L1GlobalTypeGenCacheState.needsUpdate) return;
  logger.log("Writing L1GlobalTypeGen cache to " + L1GlobalTypeGenCacheFileName);
  return writeWithZip(L1GlobalTypeGenCacheFileName, JSON.stringify(Object.entries(L1GlobalTypeGenCache).map(([k, v]) => [k, v.map((e) => e.toJson(true))])));
};
