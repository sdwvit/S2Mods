import { getFilesForTransformer } from "./create-cfg-file-selector-for-transformer.mjs";
import { getCfgFileProcessor } from "./get-cfg-file-processor.mjs";
import { EntriesTransformer } from "./metaType.mjs";
import { Struct } from "s2cfgtojson";

export async function processOneTransformer<T extends Struct>(transformer: EntriesTransformer<T>): Promise<(T | Struct)[][]> {
  const [files, processor] = await Promise.all([getFilesForTransformer(transformer), getCfgFileProcessor(transformer)] as const);

  return await Promise.all(files.map(processor));
}
