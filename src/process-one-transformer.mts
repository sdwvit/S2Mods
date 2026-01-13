import { getFilesForTransformer } from "./create-cfg-file-selector-for-transformer.mjs";
import { getCfgFileProcessor } from "./get-cfg-file-processor.mjs";
import { StructTransformer } from "./meta-type.mts";
import { Struct } from "s2cfgtojson";

export async function processOneTransformer<T extends Struct>(transformer: StructTransformer<T>): Promise<(T | Struct)[][]> {
  const [files, processor] = await Promise.all([getFilesForTransformer(transformer), getCfgFileProcessor(transformer)] as const);

  return await Promise.all(files.map(processor));
}
