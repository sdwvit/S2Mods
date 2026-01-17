import { DifficultyPrototype } from "s2cfgtojson";
import { StructTransformer } from "../../src/meta-type.mts";
import { DIFFICULTY_FACTOR } from "../GlassCannon/meta.mts";

/**
 * Increases cost of everything and damage on Hard and Stalker difficulty.
 */
export const transformDifficultyPrototypes: StructTransformer<DifficultyPrototype> = async (struct, context) => {
  if (struct.SID !== "Hard" && struct.SID !== "Stalker") {
    return null;
  }

  return Object.assign(struct.fork(), {
    Repair_Cost: DIFFICULTY_FACTOR,
    Upgrade_Cost: DIFFICULTY_FACTOR,
    Effect_Satiety: 1,

    // Reward_MainLine_Money: DIFFICULTY_FACTOR,
    // Reward_SideLine_Money: DIFFICULTY_FACTOR,
  } as DifficultyPrototype);
};
transformDifficultyPrototypes.files = ["/DifficultyPrototypes.cfg"];
