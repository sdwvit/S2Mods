import { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType = {
  description: `
Title
[hr][/hr]
Description 1[h1][/h1]
Description 2[h1][/h1]
[hr][/hr]
Footer
`,
  changenote: "Initial release",
  structTransformers: [structTransformer],
};

function structTransformer() {}

structTransformer.files = [];
