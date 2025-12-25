import { DifficultyPrototype, MutantBase } from "s2cfgtojson";
import { MetaType } from "../../src/meta-type.mts";
import { getTransformMobs } from "../MasterMod/transformMobs.mts";

export const DIFFICULTY_FACTOR = 4;
export const meta: MetaType<DifficultyPrototype | MutantBase> = {
  description: `
This mode does only one thing: increases weapons damage quite a bit on Hard/Master difficulty.
[hr][/hr]
🤠 Here’s the deal, kiddo - this mod makes you a glass cannon, so you’re basically one-shotting everything, at the same time you’ll get wrecked by every bullet, every mutant, every *thing* that’s not you.[h1][/h1]
It’s brutal as hell… but *so* much more satisfying when you pull through.[h1][/h1]
It’s not for the weak. If you’re struggling? Just switch to Normal mode for that one fight - no shame in that. This thing’s all about fun, not suffering.[h1][/h1]
Hard mission, but you’ve got this. Now go prove it. 🤠[h1][/h1]
[h1][/h1]
Increases damage given and damage taken to 400%
[hr][/hr]
Mod is meant to be used in other collections of mods. Does not conflict with anything.
`,
  changenote: "Now big mobs have 2x HP points",
  structTransformers: [structTransformer, getTransformMobs(2, false)],
};

function structTransformer(struct: DifficultyPrototype) {
  if (struct.SID !== "Hard" && struct.SID !== "Stalker") {
    return null;
  }
  return Object.assign(struct.fork(), {
    Weapon_BaseDamage: DIFFICULTY_FACTOR,
    NPC_Weapon_BaseDamage: DIFFICULTY_FACTOR,
    Mutant_BaseDamage: DIFFICULTY_FACTOR,
  } as Partial<DifficultyPrototype>);
}

structTransformer.files = ["/DifficultyPrototypes.cfg"];
