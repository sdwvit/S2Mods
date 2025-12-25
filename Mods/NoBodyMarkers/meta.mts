import { MetaType } from "../../src/meta-type.mts";
import { Struct } from "s2cfgtojson";

export const meta: MetaType<Struct> = {
  structTransformers: [],
  description: "This mod does only one thing: it removes dead body markers from the compass.",
  changenote: "Update for 1.7.1",
};
