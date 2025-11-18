import { MetaType } from "../../src/metaType.mjs";

export const meta: MetaType = {
  description: `
Vova Vist icon for Master difficulty.
`,
  changenote: "Initial release",
  structTransformers: [structTransformer],
};

function structTransformer() {
  return null;
}

structTransformer._name = "VovaVist";
structTransformer.files = [];
