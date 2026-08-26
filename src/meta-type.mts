import { Struct } from "s2cfgtojson";

export type MetaContext<T> = {
  fileIndex: number;
  index: number;
  array: T[];
  extraStructs: T[];
  filePath: string;
  fileName: string;
  structsById: Record<string, T>;
};
export type StructTransformer<T> = ((
  entries: T,
  context: MetaContext<T>,
) => Struct | Struct[] | null | void | Promise<void | Struct | Struct[] | null>) & {
  contains?: boolean;
  /**
   * Also process the matching prototypes inside DLCGameData (Deluxe/Ultimate/PreOrder/DLC1).
   * DLC items live in one flat ItemPrototypes.cfg per DLC; only structs whose `refurl` chain
   * leads to one of `files` are passed to the transformer.
   */
  dlc?: boolean;
  contents?: string[];
  files: string[];
  extraStructs?: Struct[]; // optional place for transformer to populate, so that other transformers can await for this information
};
export type MetaType<T = Struct> = {
  nameOverride?: string;
  sdkModNameOverride?: string;
  originalAuthor?: string;
  changenote: string;
  description: string;
  structTransformers: StructTransformer<T>[];
  onFinish?(): void | Promise<void>;
  onTransformerFinish?(transformer: StructTransformer<T>): void;
};
