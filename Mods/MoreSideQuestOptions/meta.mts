import type { MetaType } from "../../src/meta-type.mts";
import { transformDialogPrototypes } from "./transformDialogPrototypes.mts";
import { transformQuestNodePrototypes } from "./transformQuestNodePrototypes.mts";

export const meta: MetaType = {
  description: `
This mod expands the dialogue options offered by NPCs when requesting side quests.[h2][/h2]
Every repeatable side quest is offered at once instead of a random rotation, using the
vanilla dialog and quest flow. Also shows all mutant-parts hand-in options at Malachite (EQ197), gated on actually having the parts.

[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote:
    "Ships the vanilla-flow rework earlier uploads were missing: every side quest is offered at once with the game's own option labels, which fixes raw text keys in the job list.",
  structTransformers: [transformDialogPrototypes, transformQuestNodePrototypes],
};
