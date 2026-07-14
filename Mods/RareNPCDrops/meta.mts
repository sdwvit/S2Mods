import type { ItemGeneratorPrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";
import { transformItemGenerators } from "./transformItemGenerators.mts";

export const meta: MetaType<ItemGeneratorPrototype> = {
  description: `
[h1]Deprecated in 2.0[/h1]
Each NPC corpse has a 1% chance to drop a detector and a separate 1% chance to drop an artifact. Drops are tiered by NPC rank:
    [h2][/h2]
    [list]
    [*] Newbie NPCs: Echo detector + cheapest artifacts
    [*] Experienced NPCs: up to Gilka detector + low-mid artifacts
    [*] Veteran NPCs: up to Bear detector + low-high artifacts
    [*] Master NPCs: up to Veles detector + all artifacts
    [/list]
    [h2][/h2]
    When a detector drops, it's chosen by weight — Echo is most common, rarer detectors are progressively less likely:
    [h2][/h2]
    [list]
    [*] Echo: weight 1 (~90% of detector drops)
    [*] Gilka: weight 0.1 (~9%)
    [*] Bear: weight 0.01 (~0.9%)
    [*] Veles: weight 0.001 (~0.09%)
    [/list]
    [h2][/h2]
    Artifacts are also weighted by cost tier — cheaper artifacts drop more often than expensive ones.
  
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Increased drop trigger chance from 0.1% to 1%; reworked item selection to use weighted pools (Echo most common, rarer detectors/pricier artifacts less likely)",
  structTransformers: [transformItemGenerators],
};
