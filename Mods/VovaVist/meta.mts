import type { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType = {
  description: `
[h1]Deprecated in 2.0[/h1]
Vova Vist icon for Master difficulty.

[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Initial release",
  structTransformers: [structTransformer],
};

function structTransformer() {
  return null;
}

structTransformer.files = [];
