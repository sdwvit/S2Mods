import { Struct } from "s2cfgtojson";
import type { QuestNodePrototypeSetItemGenerator } from "s2cfgtojson";
import { SKIF_ITEM_GENERATOR_SID } from "./transformItemGeneratorPrototypes.mts";

const SKIF_QUEST_GUID = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const SKIF_QUEST_NODE_SID = "Skif_ScopedDrahunka";

let once = false;

/**
 * Debug quest node that gives Skif everything from the generator.
 * Use with console: XStartQuestNodeBySID Skif_ScopedDrahunka
 */
export function transformAlifeinterrupts(struct: QuestNodePrototypeSetItemGenerator) {
  if (once) {
    return null;
  }
  once = true;
  const node = new Struct() as QuestNodePrototypeSetItemGenerator;
  node.SID = SKIF_QUEST_NODE_SID;
  node.QuestSID = struct.QuestSID;
  node.NodeType = "EQuestNodeType::SetItemGenerator";
  node.TargetQuestGuid = SKIF_QUEST_GUID;
  node.ReplaceInventory = false;
  node.EquipItems = false;
  node.Repeatable = true;
  node.ItemGeneratorSID = SKIF_ITEM_GENERATOR_SID;
  node.__internal__.isRoot = true;
  node.__internal__.rawName = SKIF_QUEST_NODE_SID;
  return node;
}

transformAlifeinterrupts.files = ["/QuestNodePrototypes/A-life_interrupts.cfg"];
