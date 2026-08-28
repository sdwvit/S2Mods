import { Struct } from "s2cfgtojson";
import type {
  AbilityPrototype,
  AbilityPrototypeEffects,
  AbilityPrototypeEffectsItem,
} from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";

const targetSIDs = new Set([
  "PseudoDogSummon_RunAttack_Base",
  "PseudoDogSummon_RunAttack_Left",
  "PseudoDogSummon_RunAttack_Right",
  "PseudoDogSummon_BiteAttack",
  "PseudoDogSummon_TurnAttack",
]);

export const meta: MetaType<Struct> = {
  description: `
This mod removes damage from pseudodog psy clones (combat summons).[h1][/h1]
[hr][/hr]
[list]
[*] Pseudodog clones no longer deal physical damage and cause no bleeding.
[*] Instead, their hits build up psy points, which fits their nature as psy phantoms.
[*] The real pseudodog is unaffected — only its summoned copies are changed.
[/list] 
  
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote:
    "Clone hits now build up psy instead of dealing physical damage: damage and bleeding stay at 0, and each hit applies 3 points of Psy Damage.",
  structTransformers: [transformSummonAbilities],
};

function transformSummonAbilities(struct: AbilityPrototype) {
  if (!targetSIDs.has(struct.SID as string)) {
    return null;
  }
  const fork = struct.fork();
  fork.Damage = 0;
  fork.Bleeding = 0;
  fork.BleedingChanceIncrement = 0;

  // Append (rather than replace) a psy-points effect to the ability's Effects list.
  const effects = new Struct() as AbilityPrototypeEffects;
  const entry = new Struct() as AbilityPrototypeEffectsItem;
  entry.EffectPrototypeSID = "PSYDamage3InstaEffect";
  entry.Chance = 1;
  effects.addNode(entry);
  fork.Effects = effects;

  return fork;
}

transformSummonAbilities.files = ["/PseudoDogAbilities.cfg"];
