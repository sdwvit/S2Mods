import { EItemGenerationCategory, ItemGeneratorPrototype, Struct } from "s2cfgtojson";
import { StructTransformer } from "../../src/meta-type.mts";
import { allDefaultGeneralNPCObjPrototypesRecordByItemGeneratorPrototypeSID, Factions } from "../../src/consts.mts";
import { logger } from "../../src/logger.mts";
import { FactionPatch, patchDefsRecord } from "./addFactionPatchItems.mts";

/**
 * Add faction patches to drops
 */
export const addFactionPatchesToItemGenerators: StructTransformer<ItemGeneratorPrototype> = (struct) => {
  if (struct.SID.includes("Trade") || !struct.ItemGenerator) {
    return;
  }

  const fork = struct.fork();

  fork.ItemGenerator = new Struct() as ItemGeneratorPrototype["ItemGenerator"];
  const generalNPCObjPrototype = allDefaultGeneralNPCObjPrototypesRecordByItemGeneratorPrototypeSID[struct.SID];
  if (!generalNPCObjPrototype) {
    return;
  }
  const coreFaction = Factions[generalNPCObjPrototype.Faction];
  if (!coreFaction) {
    logger.warn(`Unknown faction '${generalNPCObjPrototype.Faction}'`);
    return;
  }
  const patch = patchDefsRecord[`${FactionPatch}${coreFaction}`];

  if (!patch) {
    logger.warn(`Unknown faction '${coreFaction}'`);
    return;
  }
  fork.ItemGenerator.addNode(
    new Struct({
      bAllowSameCategoryGeneration: true,
      Category: "EItemGenerationCategory::Junk" satisfies EItemGenerationCategory,
      RefreshTime: "365d",
      PossibleItems: {
        Chance: 1,
        ItemPrototypeSID: patch.SID,
      },
    }),
    "FactionPatch",
  );

  return fork;
};
addFactionPatchesToItemGenerators.files = ["/DynamicItemGenerator.cfg", "QuestItemGeneratorPrototypes.cfg"];
