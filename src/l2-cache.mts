import fs from "node:fs";
import path from "node:path";
import { logger } from "./logger.mjs";
import { readWithUnzip, writeWithZip } from "./zip.mjs";
import { EntriesTransformer } from "./meta-type.mts";
import { modFolder } from "./base-paths.mts";

export const L2CacheFileName = path.join(modFolder, ".l2.cache.zlib");
export const L2CacheState = {
  needsUpdate: false,
};

/**
 * L2 Cache for storing transformer file lists
 * Key: see getL2CacheKey()
 * Value: List of .cfg files to be processed by that transformer
 */
export const L2Cache = fs.existsSync(L2CacheFileName) ? JSON.parse(await readWithUnzip(L2CacheFileName)) : {};
export const getL2CacheKey = (transformer: EntriesTransformer<any>) =>
  `${transformer.files.sort().join()}:${transformer.contains}:${transformer.contents ? transformer.contents.sort().join() : ""}`;

export const onL2Finish = () => {
  if (!L2CacheState.needsUpdate) return;
  logger.log("Writing L2 cache to " + L2CacheFileName);
  return writeWithZip(L2CacheFileName, JSON.stringify(L2Cache));
};
