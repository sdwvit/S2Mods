import type { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType = {
  description: `
[h1]Deprecated in 2.0[/h1]
[h1][/h1]
With the new game on the new Unreal Engine, mod structure changes — some mods are now part of the base game. Replacements will be released as separate mods.
[hr][/hr]
Vova Vist icon for Master difficulty.
`,
  changenote: "Initial release",
  structTransformers: [structTransformer],
};

function structTransformer() {
  return null;
}

structTransformer.files = [];
