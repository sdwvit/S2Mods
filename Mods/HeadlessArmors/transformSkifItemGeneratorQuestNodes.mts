import { Struct } from "s2cfgtojson";
import type { QuestNodePrototype, QuestNodePrototypeSetItemGenerator } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";

const SKIF_QUEST_GUID = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
let once = false;

function sanitizeSID(raw: string) {
  return raw.replace(/[^A-Za-z0-9_]/g, "_").replace(/(GeneralNPC_|_ItemGenerator)/g, '');
}

async function getNewHeadlessGeneratorSIDs() {
  return [
    "GeneralNPC_Neutral_CloseCombat_ItemGenerator",
    "GeneralNPC_Neutral_Recon_ItemGenerator",
    "GeneralNPC_Neutral_Sniper_ItemGenerator",
    "GeneralNPC_Neutral_Stormtrooper_ItemGenerator",
    "GeneralNPC_Mercenaries_Armor",
    "GeneralNPC_Mercenaries_CloseCombat_ItemGenerator",
    "GeneralNPC_Mercenaries_Recon_ItemGenerator",
    "GeneralNPC_Mercenaries_Stormtrooper_ItemGenerator",
    "GeneralNPC_Mercenaries_Sniper_ItemGenerator",
    "GeneralNPC_Militaries_Armor",
    "GeneralNPC_Militaries_CloseCombat_ItemGenerator",
    "GeneralNPC_Militaries_Recon_ItemGenerator",
    "GeneralNPC_Militaries_Stormtrooper_ItemGenerator",
    "GeneralNPC_Militaries_Sniper_ItemGenerator",
    "GeneralNPC_Militaries_Heavy_ItemGenerator",
    "GeneralNPC_Monolith_Armor",
    "GeneralNPC_Monolith_CloseCombat_ItemGenerator",
    "GeneralNPC_Monolith_Recon_ItemGenerator",
    "GeneralNPC_Monolith_Stormtrooper_ItemGenerator",
    "GeneralNPC_Monolith_Sniper_ItemGenerator",
    "GeneralNPC_Duty_Armor_Experienced_var1",
    "GeneralNPC_Duty_Armor_Experienced_var2",
    "GeneralNPC_Duty_Armor",
    "GeneralNPC_Duty_CloseCombat_ItemGenerator",
    "GeneralNPC_Duty_Recon_ItemGenerator",
    "GeneralNPC_Duty_Stormtrooper_ItemGenerator",
    "GeneralNPC_Duty_Sniper_ItemGenerator",
    "GeneralNPC_Duty_Heavy_ItemGenerator",
    "GeneralNPC_Freedom_Armor",
    "GeneralNPC_Freedom_CloseCombat_ItemGenerator",
    "GeneralNPC_Freedom_Recon_ItemGenerator",
    "GeneralNPC_Freedom_Stormtrooper_ItemGenerator",
    "GeneralNPC_Freedom_Sniper_ItemGenerator",
    "GeneralNPC_Varta_Armor",
    "GeneralNPC_Varta_CloseCombat_ItemGenerator",
    "GeneralNPC_Varta_Recon_ItemGenerator",
    "GeneralNPC_Varta_Stormtrooper_ItemGenerator",
    "GeneralNPC_Varta_Sniper_ItemGenerator",
    "GeneralNPC_Varta_Heavy_ItemGenerator",
    "GeneralNPC_Spark_Armor",
    "GeneralNPC_Spark_CloseCombat_ItemGenerator",
    "GeneralNPC_Spark_Recon_ItemGenerator",
    "GeneralNPC_Spark_Stormtrooper_ItemGenerator",
    "GeneralNPC_Spark_Sniper_ItemGenerator",
  ];
}

/**
 * Adds debug quest nodes that apply only NEW HeadlessArmors item generators to Skif.
 * Use with console: XStartQuestNodeBySID <GeneratedNodeSID>
 */
export const transformSkifItemGeneratorQuestNodes: StructTransformer<QuestNodePrototype> = async (s) => {
  if (once) {
    return;
  }
  once = true;

  const sids = await getNewHeadlessGeneratorSIDs();
  return sids.map((itemGeneratorSID) => {
    const nodeSID = `Skif_${sanitizeSID(itemGeneratorSID)}`;
    const node = new Struct() as QuestNodePrototypeSetItemGenerator;
    node.SID = nodeSID;
    node.QuestSID = s.QuestSID;
    node.NodeType = "EQuestNodeType::SetItemGenerator";
    node.TargetQuestGuid = SKIF_QUEST_GUID;
    node.ReplaceInventory = false;
    node.EquipItems = false;
    node.ItemGeneratorSID = itemGeneratorSID;
    node.__internal__.isRoot = true;
    node.__internal__.rawName = nodeSID;
    return node;
  });
};

transformSkifItemGeneratorQuestNodes.files = ["/QuestNodePrototypes/A-life_interrupts.cfg"];
