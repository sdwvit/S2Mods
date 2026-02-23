import { EItemType, QuestItemPrototype, Struct } from "s2cfgtojson";
import { StructTransformer } from "../../src/meta-type.mts";

export const XP_COUNTER_ITEM_SID = "DecoupledRanksXP";

let once = false;

const XP_COUNTER_ICON = "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Consumable/T_dev_SDCard_Y.T_dev_SDCard_Y'";

export const addXpCounterItem: StructTransformer<QuestItemPrototype> = () => {
  if (once) return;
  once = true;

  return [
    new Struct({
      __internal__: { refurl: "../ItemPrototypes.cfg", refkey: "[0]", rawName: XP_COUNTER_ITEM_SID, isRoot: true },
      SID: XP_COUNTER_ITEM_SID,
      Name: "Rank XP",
      LocalizationSID: "Rank XP",
      Icon: XP_COUNTER_ICON,
      MeshPrototypeSID: "Icon",
      Weight: 0,
      Cost: 0,
      Type: "EItemType::Other" as EItemType,
      MaxStackCount: 300000,
      IsQuestItem: true,
      ItemGridWidth: 1,
      ItemGridHeight: 1,
    }) as QuestItemPrototype,
  ];
};

addXpCounterItem.files = ["/KeyItemPrototypes.cfg"];
