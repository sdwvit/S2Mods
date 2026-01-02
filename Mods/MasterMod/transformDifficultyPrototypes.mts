import { DifficultyPrototype, Struct } from "s2cfgtojson";
import { EntriesTransformer } from "../../src/meta-type.mts";
import { DIFFICULTY_FACTOR } from "../GlassCannon/meta.mts";

/**
 * Increases cost of everything and damage on Hard and Stalker difficulty.
 */
export const transformDifficultyPrototypes: EntriesTransformer<DifficultyPrototype> = async (struct, context) => {
  if (struct.SID !== "Hard" && struct.SID !== "Stalker") {
    return null;
  }
  const fork = Object.assign(struct.fork(), {
    Ammo_Cost: DIFFICULTY_FACTOR,
    Repair_Cost: DIFFICULTY_FACTOR,
    Upgrade_Cost: DIFFICULTY_FACTOR,
    Consumable_Cost: DIFFICULTY_FACTOR,
    Armor_Cost: DIFFICULTY_FACTOR,
    Weapon_Cost: DIFFICULTY_FACTOR,
    Artifact_Cost: DIFFICULTY_FACTOR,
    Effect_Satiety: 1,

    Reward_MainLine_Money: DIFFICULTY_FACTOR,
    //    Reward_SideLine_Money: DIFFICULTY_FACTOR,
  } as DifficultyPrototype);
  fork.AllowedSaveTypes = context.structsById.Hard.AllowedSaveTypes;
  fork.TotalSaveLimits = new Struct() as any;
  fork.bShouldDisableCompass = false;
  fork.BlockSettings = false;
  return fork;
};
transformDifficultyPrototypes.files = ["/DifficultyPrototypes.cfg"];
