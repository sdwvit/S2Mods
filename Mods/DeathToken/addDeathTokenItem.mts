import { Struct } from "s2cfgtojson";
import type { EItemType } from "s2cfgtojson";
import type { QuestItemPrototype } from "s2cfgtojson";

export const DEATH_TOKEN_ITEM_SID = "DeathToken_Token";

const ICON = "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Quest/IIT_QuestItem_USB_Stalker_Big.IIT_QuestItem_USB_Stalker_Big'";

let once = false;

export function addDeathTokenItem() {
  if (once) return;
  once = true;

  return [
    new Struct({
      __internal__: { refurl: "../ItemPrototypes.cfg", refkey: "[0]", rawName: DEATH_TOKEN_ITEM_SID, isRoot: true },
      SID: DEATH_TOKEN_ITEM_SID,
      Name: "Death Token",
      LocalizationSID: "Death Token",
      Icon: ICON,
      MeshPrototypeSID: "Icon",
      Weight: 0,
      Cost: 0,
      Type: "EItemType::Other" as EItemType,
      MaxStackCount: 9999,
      IsQuestItem: true,
      ItemGridWidth: 1,
      ItemGridHeight: 1,
    }) as QuestItemPrototype,
  ];
}

addDeathTokenItem.files = ["/DetectorPrototypes.cfg"];
