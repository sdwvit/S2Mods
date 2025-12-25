import { MetaType } from "../../src/meta-type.mts";
import { Struct } from "s2cfgtojson";

export const meta: MetaType<Struct> = {
  description: "This mod does only one thing: removes all enemy markers from the compas for a more immersive experience.",
  changenote: "Update for 1.7.1",
  structTransformers: [],
};
