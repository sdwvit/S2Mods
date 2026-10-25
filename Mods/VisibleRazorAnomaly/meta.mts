import type { Struct } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType<Struct> = {
  description: `
Makes the razor anomaly easier to spot from a distance.[h1][/h1]
[hr][/hr]
[list]
[*] TODO
[/list]
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Initial release.",
  structTransformers: [] as MetaType<Struct>["structTransformers"],
};
