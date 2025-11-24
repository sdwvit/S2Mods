import { Struct } from "s2cfgtojson";

export type MetaContext<T> = {
  fileIndex: number;
  index: number;
  array: T[];
  extraStructs: T[];
  filePath: string;
  structsById: Record<string, T>;
};
export type EntriesTransformer<T> = ((entries: T, context: MetaContext<T>) => Struct | null) & {
  contains?: boolean;
  contents?: string[];
  files: string[];
};
export type MetaType<T> = {
  changenote: string;
  description: string;
  structTransformers: EntriesTransformer<T>[];
  onFinish?(): void;
  onTransformerFinish?(transformer: EntriesTransformer<T>): void;
};
