import type { AbilityPrototype, ObjPrototype, Struct } from "s2cfgtojson";
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
[h1]Deprecated in 2.0[/h1]
[h1][/h1]
With the new game on the new Unreal Engine, mod structure changes — some mods are now part of the base game. Replacements will be released as separate mods.
[hr][/hr]
This mod removes damage from pseudodog psy clones (combat summons).[h1][/h1]
[hr][/hr]
[list]
[*] Pseudodog clones will still spawn and chase you, but they deal no damage and cause no bleeding.
[*] The real pseudodog is unaffected — only its summoned copies are nerfed.
[/list] 
  
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Fix: also disable damage on left/right run attack variants",
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
  return fork;
}

transformSummonAbilities.files = ["/PseudoDogAbilities.cfg"];
