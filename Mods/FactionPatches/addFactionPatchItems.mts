import { EItemType, QuestItemPrototype, Struct } from "s2cfgtojson";
import { CoreFaction, Factions, getRecord } from "../../src/consts.mts";

let addFactionPatchesOnce = false;

const ICON_BASE = "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/PDA/FractionIcons/";
export const FactionPatch = "FactionPatch";

export const patchDefs: {
  SID: `FactionPatch${CoreFaction}`;
  Icon: string;
  cost?: number;
  Faction: CoreFaction;
}[] = [
  { Faction: "Bandits", SID: `${FactionPatch}Bandits`, Icon: `${ICON_BASE}T_inv_BanditsPatch.T_inv_BanditsPatch'` },
  { Faction: "Corpus", SID: `${FactionPatch}Corpus`, Icon: `${ICON_BASE}T_inv_CorpusPatch.T_inv_CorpusPatch'` },
  { Faction: "Duty", SID: `${FactionPatch}Duty`, Icon: `${ICON_BASE}T_inv_DutyPatch.T_inv_DutyPatch'` },
  { Faction: "FreeStalkers", SID: `${FactionPatch}FreeStalkers`, Icon: `${ICON_BASE}T_inv_LonersPatch.T_inv_LonersPatch'` },
  { Faction: "Freedom", SID: `${FactionPatch}Freedom`, Icon: `${ICON_BASE}T_inv_FreedomPatch.T_inv_FreedomPatch'` },
  { Faction: "Mercenaries", SID: `${FactionPatch}Mercenaries`, Icon: `${ICON_BASE}T_inv_MercenariesPatch.T_inv_MercenariesPatch'` },
  { Faction: "Militaries", SID: `${FactionPatch}Militaries`, Icon: `${ICON_BASE}T_inv_ISPFPatch.T_inv_ISPFPatch'` },
  { Faction: "Monolith", SID: `${FactionPatch}Monolith`, Icon: `${ICON_BASE}T_inv_MonolithPatch.T_inv_MonolithPatch'` },
  { Faction: "Neutrals", SID: `${FactionPatch}Neutrals`, Icon: `${ICON_BASE}T_inv_NeutralPatch.T_inv_NeutralPatch'` },
  { Faction: "Noon", SID: `${FactionPatch}Noon`, Icon: `${ICON_BASE}T_inv_NoonPatch.T_inv_NoonPatch'` },
  { Faction: "Scientists", SID: `${FactionPatch}Scientists`, Icon: `${ICON_BASE}T_inv_ScientistPatch.T_inv_ScientistPatch'` },
  { Faction: "Spark", SID: `${FactionPatch}Spark`, Icon: `${ICON_BASE}T_inv_SparkPatch.T_inv_SparkPatch'` },
  { Faction: "Varta", SID: `${FactionPatch}Varta`, Icon: `${ICON_BASE}T_inv_VartaPatch.T_inv_VartaPatch'` },
];

export const patchDefsRecord = getRecord(patchDefs);

export function addFactionPatchItems() {
  if (addFactionPatchesOnce) {
    return null;
  }
  addFactionPatchesOnce = true;

  const template = new Struct({
    __internal__: { refurl: "../ItemPrototypes.cfg", refkey: "[0]", rawName: "FactionPatch", isRoot: true },
    SID: FactionPatch,
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

  const patches = patchDefs.map(
    ({ SID, Icon, cost }) =>
      new Struct({
        __internal__: { refkey: "FactionPatch", rawName: SID, isRoot: true },
        SID,
        Icon,
        ...(cost !== undefined ? { Cost: cost } : {}),
      }),
  );

  return [template, ...patches];
}

addFactionPatchItems.files = ["/KeyItemPrototypes.cfg"];
