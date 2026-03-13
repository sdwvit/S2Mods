import { Struct } from "s2cfgtojson";
import type { EItemType } from "s2cfgtojson";
import type { QuestItemPrototype } from "s2cfgtojson";
import { CoreFaction, getRecord } from "../../src/consts.mts";

let addFactionPatchesOnce = false;

const ICON_BASE = "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/PDA/FractionIcons/";
export const FactionPatchSID = "FactionPatch";

export const FactionPatchDefinitions: {
  SID: `FactionPatch${CoreFaction}`;
  Icon: string;
  cost?: number;
  Faction: CoreFaction;
}[] = [
  { Faction: "Bandits", SID: `${FactionPatchSID}Bandits`, Icon: `${ICON_BASE}T_inv_BanditsPatch.T_inv_BanditsPatch'` },
  { Faction: "Corpus", SID: `${FactionPatchSID}Corpus`, Icon: `${ICON_BASE}T_inv_CorpusPatch.T_inv_CorpusPatch'` },
  { Faction: "Duty", SID: `${FactionPatchSID}Duty`, Icon: `${ICON_BASE}T_inv_DutyPatch.T_inv_DutyPatch'` },
  { Faction: "FreeStalkers", SID: `${FactionPatchSID}FreeStalkers`, Icon: `${ICON_BASE}T_inv_LonersPatch.T_inv_LonersPatch'` },
  { Faction: "Freedom", SID: `${FactionPatchSID}Freedom`, Icon: `${ICON_BASE}T_inv_FreedomPatch.T_inv_FreedomPatch'` },
  { Faction: "Mercenaries", SID: `${FactionPatchSID}Mercenaries`, Icon: `${ICON_BASE}T_inv_MercenariesPatch.T_inv_MercenariesPatch'` },
  { Faction: "Militaries", SID: `${FactionPatchSID}Militaries`, Icon: `${ICON_BASE}T_inv_ISPFPatch.T_inv_ISPFPatch'` },
  { Faction: "Monolith", SID: `${FactionPatchSID}Monolith`, Icon: `${ICON_BASE}T_inv_MonolithPatch.T_inv_MonolithPatch'` },
  { Faction: "Neutrals", SID: `${FactionPatchSID}Neutrals`, Icon: `${ICON_BASE}T_inv_NeutralPatch.T_inv_NeutralPatch'` },
  { Faction: "Noon", SID: `${FactionPatchSID}Noon`, Icon: `${ICON_BASE}T_inv_NoonPatch.T_inv_NoonPatch'` },
  { Faction: "Scientists", SID: `${FactionPatchSID}Scientists`, Icon: `${ICON_BASE}T_inv_ScientistPatch.T_inv_ScientistPatch'` },
  { Faction: "Spark", SID: `${FactionPatchSID}Spark`, Icon: `${ICON_BASE}T_inv_SparkPatch.T_inv_SparkPatch'` },
  { Faction: "Varta", SID: `${FactionPatchSID}Varta`, Icon: `${ICON_BASE}T_inv_VartaPatch.T_inv_VartaPatch'` },
];

export const patchDefsRecord = getRecord(FactionPatchDefinitions);

export function addFactionPatchItems() {
  if (addFactionPatchesOnce) {
    return null;
  }
  addFactionPatchesOnce = true;

  const template = new Struct({
    __internal__: { refurl: "../ItemPrototypes.cfg", refkey: "[0]", rawName: FactionPatchSID, isRoot: true },
    SID: FactionPatchSID,
    Icon: `${ICON_BASE}T_inv_BanditsPatch.T_inv_BanditsPatch'`,
    MeshPrototypeSID: "Icon",
    Weight: 0.01,
    Cost: 25,
    Type: "EItemType::Other" as EItemType,
    MaxStackCount: 1000,
    IsQuestItem: false,
    ItemGridWidth: 1,
    ItemGridHeight: 1,
  }) as QuestItemPrototype;

  const patches = FactionPatchDefinitions.map(
    ({ SID, Icon, cost }) =>
      new Struct({
        __internal__: { refkey: FactionPatchSID, rawName: SID, isRoot: true },
        SID,
        Icon,
        ...(cost !== undefined ? { Cost: cost } : {}),
      }),
  );

  return [template, ...patches] as QuestItemPrototype[];
}

addFactionPatchItems.files = ["/KeyItemPrototypes.cfg"];
