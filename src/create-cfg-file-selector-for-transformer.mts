import type { StructTransformer } from "./meta-type.mts";
import { logger } from "./logger.mts";
import { getCfgFiles, getDlcCfgFiles } from "./get-cfg-files.mts";
import { getL2CacheKey, L2Cache, L2CacheState } from "./cache/l2-cache.mts";

export async function getFilesForTransformer<T>(transformer: StructTransformer<T>): Promise<string[]> {
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
  const suffixes = transformer.files;
  L2Cache[cacheKey] = (
    await Promise.all(
      // `dlc` is exclusive: a DLC-only transformer never touches base GameData, so the mod it
      // produces can be shipped separately from its non-DLC twin (patching base data would make
      // the DLC half a hard requirement for everyone).
      transformer.dlc
        ? suffixes.map((suffix) => getDlcCfgFiles(suffix, transformer.contains))
        : suffixes.map((suffix) => getCfgFiles(suffix, transformer.contains)),
    )
  ).flat();
  return L2Cache[cacheKey];
}
