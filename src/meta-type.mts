import { Struct } from "s2cfgtojson";

export type MetaContext<T> = {
  fileIndex: number;
  index: number;
  array: T[];
  extraStructs: T[];
  filePath: string;
  structsById: Record<string, T>;
};
export type StructTransformer<T> = ((
  entries: T,
  context: MetaContext<T>,
) => Struct | Struct[] | null | void | Promise<void | Struct | Struct[] | null>) & {
  contains?: boolean;
  contents?: string[];
  files: string[];
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
