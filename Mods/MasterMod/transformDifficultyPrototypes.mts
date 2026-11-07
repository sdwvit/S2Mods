import { Struct, type DifficultyPrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { DIFFICULTY_FACTOR } from "../GlassCannon/meta.mts";

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
  return Object.assign(struct.fork(), {
    EconomyDifficulty: patchStruct({ Repair_Cost: DIFFICULTY_FACTOR, Upgrade_Cost: DIFFICULTY_FACTOR }),
    EnvironmentDifficulty: patchStruct({ Effect_Satiety: 1 }),
  }) as DifficultyPrototype;
};
function patchStruct(values: Record<string, number>) {
  const s = Object.assign(new Struct({}), values);
  s.__internal__.bpatch = true;
  return s as any;
}

transformDifficultyPrototypes.files = ["/DifficultyPrototypes.cfg"];
