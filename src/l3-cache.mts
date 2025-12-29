import fs from "node:fs";
import path from "node:path";
import { logger } from "./logger.mjs";
import { readWithUnzip, writeWithZip } from "./zip.mjs";
import { modFolder } from "./base-paths.mjs";

const L3CacheFileName = path.join(modFolder, ".l3.cache.zlib");
export const L3CacheState = {
  needsUpdate: false,
};
/**
 * L3 Cache for storing .cfg file lists
 * Key: file suffix
 * Value: array of absolute .cfg file paths
 */
export const L3Cache: Record<string, string[]> = fs.existsSync(L3CacheFileName)
  ? Object.fromEntries(JSON.parse(await readWithUnzip(L3CacheFileName)))
  : {};

export const onL3Finish = () => {
  if (!L3CacheState.needsUpdate) return;
  logger.log("Writing L3 cache to " + L3CacheFileName);
  const L3Entries = Object.entries(L3Cache);

  return writeWithZip(L3CacheFileName, JSON.stringify(L3Entries));
};
