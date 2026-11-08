import { Struct, type DifficultyPrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { DIFFICULTY_FACTOR } from "../GlassCannon/meta.mts";

const PLAYER_WEAPON_DAMAGE = 1.2;

/**
 * Increases cost of everything and damage on Hard and Stalker difficulty.
 */
export const transformDifficultyPrototypes: StructTransformer<DifficultyPrototype> = async (
  struct,
  context,
) => {
  if (struct.SID !== "Hard" && struct.SID !== "Stalker" && struct.SID !== "Custom") {
    return null;
  }

  // The game reads these only inside their sub-structs; top-level keys are ignored.
  const fork = Object.assign(struct.fork(), {
    EconomyDifficulty: patchStruct({ Repair_Cost: DIFFICULTY_FACTOR, Upgrade_Cost: DIFFICULTY_FACTOR }),
    EnvironmentDifficulty: patchStruct({ Effect_Satiety: 1 }),
  }) as DifficultyPrototype;

  // STA-36: a Chimera dies to 14-18 .45 hydroshock body shots from the Integral-A (17 with the .45 conversion,
  // 15 with the AP barrel too). Player damage goes from 0.75 to 1.2; human NPC HP scales by the same factor
  // so gunfights against people keep their vanilla time-to-kill. Custom keeps the player's own settings.
  if (struct.SID === "Hard" || struct.SID === "Stalker") {
    const vanillaPlayerDamage = struct.EnvironmentDifficulty.Weapon_BaseDamage; // 0.75
    const factor = PLAYER_WEAPON_DAMAGE / vanillaPlayerDamage;
    const vanillaNpcHp = struct.NPCCombatDifficulty?.NPC_HP ?? 1; // Hard inherits 1.0 from Empty, Stalker 1.5
    fork.EnvironmentDifficulty.Weapon_BaseDamage = PLAYER_WEAPON_DAMAGE;
    fork.NPCCombatDifficulty = patchStruct({ NPC_HP: +(vanillaNpcHp * factor).toFixed(3) });
  }
  return fork;
};
function patchStruct(values: Record<string, number>) {
  const s = Object.assign(new Struct({}), values);
  s.__internal__.bpatch = true;
  return s as any;
}

transformDifficultyPrototypes.files = ["/DifficultyPrototypes.cfg"];
