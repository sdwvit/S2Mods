import { Struct } from "s2cfgtojson";
import type { ObjPrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";

/**
 * THROWAWAY TEST MOD — not for publishing.
 *
 * Question: is Amok (Object68) killable by shooting only his body, never the back modules?
 *
 * Nothing in the data marks any part of him invulnerable, and both his quest spawn nodes use
 * `IgnoreDamageType = EIgnoreDamageType::None`. The suspicion is that his body takes damage
 * normally and 24000 HP just makes it invisible. The one thing that could still gate it is the
 * `InputDamageModifierComponent` on BP_AI_Object68 (a single float, `DamageModifier`, whose
 * constructor default is 1.0 and which the Blueprint never writes — but native DLC1_AI code
 * could still set it).
 *
 * The test isolates that: drop MaxHP to Flesh tier and change NOTHING else, so the damage
 * pipeline stays vanilla. Then shoot him in the chest/legs only.
 *   - he dies  -> body damage registers; he was only ever a bullet sponge.
 *   - he does not die, health bar frozen -> body damage really is nulled, and the modules
 *     are the only damage path.
 */
export const meta: MetaType<ObjPrototype> = {
  structTransformers: [amokTestTransformer],
  description: "Test mod: Amok MaxHP 24000 -> 300. Not for release.",
  changenote: "test",
};

function amokTestTransformer(struct: ObjPrototype) {
  if (struct.SID !== "Object68") return null;
  const fork = struct.fork();
  fork.VitalParams = new Struct() as ObjPrototype["VitalParams"];
  fork.VitalParams.__internal__.bpatch = true;
  fork.VitalParams.MaxHP = 300;
  return fork;
}

amokTestTransformer.files = ["MutantBaseDLC.cfg"];
amokTestTransformer.contains = true;
amokTestTransformer.dlc = true;
