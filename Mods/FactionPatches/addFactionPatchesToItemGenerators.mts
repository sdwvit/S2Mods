import { EItemGenerationCategory, ItemGeneratorPrototype, Struct } from "s2cfgtojson";
import { StructTransformer } from "../../src/meta-type.mts";
import { logger } from "../../src/logger.mts";
import { FactionPatch, patchDefsRecord } from "./addFactionPatchItems.mts";
import { getFactionFromItemGeneratorSID } from "../../src/consts.mts";

/**
 * Add faction patches to drops
 */
export const addFactionPatchesToItemGenerators: StructTransformer<ItemGeneratorPrototype> = (struct) => {
  if (struct.SID.includes("Trade") || !struct.ItemGenerator) {
    return;
  }

  const fork = struct.fork();

  const coreFaction = getFactionFromItemGeneratorSID(struct.SID);

  if (!coreFaction) {
    logger.warn(`Unknown coreFaction from '${struct.SID}'`);
    return;
  }

  const patch = patchDefsRecord[`${FactionPatch}${coreFaction}`];

  if (!patch) {
    logger.warn(`Unknown coreFaction '${coreFaction}'`);
    return;
  }

  fork.ItemGenerator = new Struct() as ItemGeneratorPrototype["ItemGenerator"];
  fork.ItemGenerator.__internal__.bpatch = true;
  fork.ItemGenerator.addNode(
    new Struct({
      bAllowSameCategoryGeneration: true,
      Category: "EItemGenerationCategory::Artifact" satisfies EItemGenerationCategory,
      RefreshTime: "1h",
      PossibleItems: {
        FactionPatch: {
          Chance: 1,
          Weight: 1,
          ItemPrototypeSID: patch.SID,
          MaxCount: 1,
          MinCount: 1,
        },
      },
    }),
    "FactionPatch",
  );

  return fork;
};
addFactionPatchesToItemGenerators.files = ["/DynamicItemGenerator.cfg", "QuestItemGeneratorPrototypes.cfg"];
