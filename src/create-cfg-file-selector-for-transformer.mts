import { EntriesTransformer } from "./metaType.mjs";
import { logger } from "./logger.mjs";
import { getCfgFiles } from "./get-cfg-files.mjs";
import { getL2CacheKey, L2Cache, L2CacheState } from "./l2-cache.mjs";

export async function getFilesForTransformer<T>(transformer: EntriesTransformer<T>): Promise<string[]> {
  if (!transformer?.files?.length) {
    logger.warn(`Transformer ${transformer.name} has no files specified.`);
    return [];
  }
  const cacheKey = getL2CacheKey(transformer);
  if (L2Cache[cacheKey]?.length) {
    return L2Cache[cacheKey];
  }
  L2CacheState.needsUpdate = true;
  logger.log(`Getting files for transformer ${transformer.name}...`);
  L2Cache[cacheKey] = (
    await Promise.all(transformer.files.map((suffix) => getCfgFiles(suffix, transformer.contains)))
  ).flat();
  return L2Cache[cacheKey];
}
