import type { Struct } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType<Struct> = {
  description: `
Makes the razor anomaly easier to spot from a distance.
`,
  changenote: "Initial release.",
  structTransformers: [] as MetaType<Struct>["structTransformers"],
};
