import { EItemGenerationCategory, ItemGeneratorPrototype, Struct } from "s2cfgtojson";
import { StructTransformer } from "../../src/meta-type.mts";
import {
  allDefaultGeneralNPCObjPrototypesRecord,
  allDefaultGeneralNPCObjPrototypesRecordByItemGeneratorPrototypeSID,
  Factions,
} from "../../src/consts.mts";
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

  let generalNPCObjPrototype = allDefaultGeneralNPCObjPrototypesRecordByItemGeneratorPrototypeSID[struct.SID];
  if (!generalNPCObjPrototype) {
    return;
  }
  while (!!allDefaultGeneralNPCObjPrototypesRecord[generalNPCObjPrototype.__internal__.refkey] && !generalNPCObjPrototype.Faction) {
    generalNPCObjPrototype = allDefaultGeneralNPCObjPrototypesRecord[generalNPCObjPrototype.__internal__.refkey];
  }

  const coreFaction = Factions[generalNPCObjPrototype.Faction];
  if (!coreFaction) {
    logger.warn(`Unknown generalNPCObjPrototype.Faction '${generalNPCObjPrototype.Faction}'`);
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
