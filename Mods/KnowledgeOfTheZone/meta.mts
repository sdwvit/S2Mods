
import { MetaType } from "../../src/meta-type.mts";
import { Struct } from "s2cfgtojson";

export const meta: MetaType = {
  description: `
Title
[hr][/hr]
Description[h1][/h1]
`,
  changenote: "Initial release",
  structTransformers: [structTransformer],
};

function structTransformer(struct: Struct) {

}
 
structTransformer.files = [ todo ];
