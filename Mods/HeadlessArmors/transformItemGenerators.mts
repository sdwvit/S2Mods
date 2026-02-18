import { ItemGeneratorPrototype, ItemGeneratorPrototypeItemGeneratorItem, Struct } from "s2cfgtojson";
import { StructTransformer } from "../../src/meta-type.mts";
import {
  allDefaultGeneralNPCObjPrototypesRecordByItemGeneratorPrototypeSID,
  allDefaultItemGeneratorsRecord,
  allDefaultQuestObjPrototypesRecordByItemGeneratorPrototypeSID,
} from "../../src/consts.mts";

function shouldProcessStruct(struct: ItemGeneratorPrototype) {
  if (!struct?.ItemGenerator) {
    return false;
  }
  if (struct.SID === "empty" || struct.SID === "EmptyQuest") {
    return false;
  }
  if (/^all/i.test(struct.SID) || /^msdemo/i.test(struct.SID)) {
    return false;
  }
  if (/(trade|trader|bartender|medic|technician)/i.test(struct.SID)) {
    return false;
  }
  // Keep dedicated NVG generators untouched.
  if (/_NVG$/i.test(struct.SID)) {
    return false;
  }
  // Keep stash/body/utility generators untouched.
  if (/(stash|body|corpse|reward|queststash|stashbody)/i.test(struct.SID)) {
    return false;
  }

  if (
    !allDefaultGeneralNPCObjPrototypesRecordByItemGeneratorPrototypeSID[struct.SID] &&
    !allDefaultQuestObjPrototypesRecordByItemGeneratorPrototypeSID[struct.SID]
  ) {
    return false;
  }

  return true;
}

function* getCoreItemGeneratorPrototypeForEdit(
  struct: ItemGeneratorPrototype,
): Generator<[string, ItemGeneratorPrototypeItemGeneratorItem], void, unknown> {
  for (const [_, ig] of struct.ItemGenerator.entries()) {
    switch (ig.Category) {
      case "EItemGenerationCategory::SubItemGenerator": {
        for (const [_2, pi] of ig.PossibleItems.entries()) {
          if (allDefaultItemGeneratorsRecord[pi.ItemGeneratorPrototypeSID]) {
            yield* getCoreItemGeneratorPrototypeForEdit(allDefaultItemGeneratorsRecord[pi.ItemGeneratorPrototypeSID]);
          }
        }
        break;
      }
      case "EItemGenerationCategory::BodyArmor":
      case "EItemGenerationCategory::Head":
        yield [_, ig] as [string, ItemGeneratorPrototypeItemGeneratorItem];
        break;
    }
  }
}

/**
 * Removes existing armor/helmet generation buckets and injects armor sub-item selectors by faction+rank.
 */
export const transformItemGenerators: StructTransformer<ItemGeneratorPrototype> = async (struct) => {
  if (!shouldProcessStruct(struct)) {
    return;
  }
  const fork = struct.fork();
  fork.ItemGenerator = new Struct().fork() as any;
  [...getCoreItemGeneratorPrototypeForEdit(struct)].forEach(([key, ig]) => {
    const igFork = ig.fork();
    igFork.bAllowSameCategoryGeneration = true;
    igFork.PossibleItems = new Struct() as any;
    igFork.removeNode("PossibleItems");
    fork.ItemGenerator.addNode(igFork, key);
  });
  if (fork.ItemGenerator.entries().length) {
    return fork;
  }
};

transformItemGenerators.files = ["/DynamicItemGenerator.cfg", "/QuestItemGeneratorPrototypes.cfg", "/ItemGeneratorPrototypes.cfg"];
