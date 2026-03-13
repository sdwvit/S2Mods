import { Struct } from "s2cfgtojson";
import type { EItemType, ERank } from "s2cfgtojson";
import type { QuestItemPrototype } from "s2cfgtojson";
import { addFactionPatchItems } from "../FactionPatches/addFactionPatchItems.mts";

const NON_QUEST_SUFFIX = "_NonQuest";

export const getNonQuestFactionPatchSID = (sid: string) => `${sid}${NON_QUEST_SUFFIX}`;

export const XP_COUNTER_ITEM_SID = "DecoupledRanksXP";
export const RANK_INDICATOR_ITEM_SIDS = {
  "ERank::Newbie": "DecoupledRanksRankNewbie",
  "ERank::Experienced": "DecoupledRanksRankExperienced",
  "ERank::Veteran": "DecoupledRanksRankVeteran",
  "ERank::Master": "DecoupledRanksRankMaster",
} as Record<ERank, string>;

let once = false;

const XP_COUNTER_ICON = "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Quest/IIT_QuestItem_USB_Stalker_Big.IIT_QuestItem_USB_Stalker_Big'";
const RANK_INDICATOR_ICONS = {
  "ERank::Newbie": "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Consumable/T_dev_SDCard_G.T_dev_SDCard_G'",
  "ERank::Experienced": "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Consumable/T_dev_SDCard_B.T_dev_SDCard_B'",
  "ERank::Veteran": "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Consumable/T_dev_SDCard_P.T_dev_SDCard_P'",
  "ERank::Master": "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Consumable/T_dev_SDCard_Y.T_dev_SDCard_Y'",
} as Record<ERank, string>;

export function transformKeyItemPrototypes() {
  if (once) return;
  once = true;

  const xpCounterItem = new Struct({
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
  }) as QuestItemPrototype;
  const rankIndicatorItems = Object.entries(RANK_INDICATOR_ITEM_SIDS).map(([rank, sid]) => {
    const rankName = rank.replace("ERank::", "");
    return new Struct({
      __internal__: { refurl: "../ItemPrototypes.cfg", refkey: "[0]", rawName: sid, isRoot: true },
      SID: sid,
      Name: `Rank: ${rankName}`,
      LocalizationSID: `Rank: ${rankName}`,
      Icon: RANK_INDICATOR_ICONS[rank as keyof typeof RANK_INDICATOR_ICONS],
      MeshPrototypeSID: "Icon",
      Weight: 0,
      Cost: 0,
      Type: "EItemType::Other" as EItemType,
      MaxStackCount: 1,
      IsQuestItem: true,
      ItemGridWidth: 1,
      ItemGridHeight: 1,
    }) as QuestItemPrototype;
  });
  const [templatePatch, ...patches] = addFactionPatchItems();
  templatePatch.IsQuestItem = true;
  return [
    xpCounterItem,
    ...rankIndicatorItems,
    templatePatch,
    ...patches,
    ...patches.map((p: QuestItemPrototype) => {
      const cloned = p.fork();
      cloned.IsQuestItem = false;
      cloned.SID = getNonQuestFactionPatchSID(p.SID);
      cloned.__internal__.rawName = cloned.SID;
      // Inherit visuals/data from the corresponding faction patch variant (keeps per-faction icon).
      cloned.__internal__.refkey = p.SID;
      cloned.__internal__.bpatch = false;
      return cloned;
    }),
  ] as QuestItemPrototype[];
}

transformKeyItemPrototypes.files = ["/KeyItemPrototypes.cfg"];
