import { Struct } from "s2cfgtojson";

export type MetaContext<T> = {
  fileIndex: number;
  index: number;
  array: T[];
  extraStructs: T[];
  filePath: string;
  structsById: Record<string, T>;
};
export type EntriesTransformer<T> = ((
  entries: T,
  context: MetaContext<T>,
) => Struct | Struct[] | null | void | Promise<void | Struct | Struct[] | null>) & {
  contains?: boolean;
  contents?: string[];
  files: string[];
};
export type MetaType<T = Struct> = {
  changenote: string;
  description: string;
  structTransformers: EntriesTransformer<T>[];
  onFinish?(): void | Promise<void>;
  onTransformerFinish?(transformer: EntriesTransformer<T>): void;
};
