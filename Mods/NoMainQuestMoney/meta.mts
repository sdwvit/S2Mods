import type { DifficultyPrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType<DifficultyPrototype> = {
  description: `
This mod does only one thing: removes coupon rewards from the main quest.
[hr][/hr]
It patches DifficultyPrototypes and sets Reward_MainLine_Money to 0 for all playable difficulties.[h1][/h1]
Item rewards from main quests are left intact.[h1][/h1]

[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Initial release",
  structTransformers: [structTransformer],
};

function structTransformer(struct: DifficultyPrototype) {
  if (struct.SID !== "Empty" && struct.SID !== "Easy" && struct.SID !== "Hard" && struct.SID !== "Stalker") {
    return null;
  }

  return Object.assign(struct.fork(), {
    Reward_MainLine_Money: 0,
  } as Partial<DifficultyPrototype>);
}

structTransformer.files = ["/DifficultyPrototypes.cfg"];
