import { MetaType } from "../../src/meta-type.mts";
import {
  ArmorPrototype,
  QuestItemPrototype,
  QuestNodePrototype,
  QuestNodePrototypeSetCharacterParam,
  QuestNodePrototypeTechnical,
  Struct,
} from "s2cfgtojson";

export const meta: MetaType = {
  description: `
Title
[hr][/hr]
Description[h1][/h1]
`,
  changenote: "Initial release",
  structTransformers: [skipSkifRankUpdate, addXpGlobalVariable, addFactionPatchItems],
};

const SKIF_GUID = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

function skipSkifRankUpdate(struct: QuestNodePrototype) {
  if (struct.NodeType !== "EQuestNodeType::SetCharacterParam") {
    return null;
  }

  const setParam = struct as QuestNodePrototypeSetCharacterParam;
  if (setParam.TargetQuestGuid !== SKIF_GUID) {
    return null;
  }

  const rankParamKeys: string[] = [];
  let hasNonRank = false;

  setParam.Params.forEach(([k, p]) => {
    if (!p) return;
    if (p.ModifiedCharacterParam === "EModifiedCharacterParam::Rank") {
      rankParamKeys.push(k);
    } else {
      hasNonRank = true;
    }
  });

  if (!rankParamKeys.length) {
    return null;
  }

  // If the node only sets Rank for Skif, replace it with a Technical noop.
  if (!hasNonRank) {
    const fork = setParam.fork() as QuestNodePrototype as QuestNodePrototypeTechnical;
    fork.NodeType = "EQuestNodeType::Technical";
    fork.StartDelay = 0;
    fork.removeNode("Params" as any);
    fork.removeNode("TargetQuestGuid" as any);
    return fork;
  }

  // Otherwise, keep non-rank params and remove only rank entries.
  const fork = setParam.fork(true);
  fork.Params = setParam.Params.fork();
  rankParamKeys.forEach((k) => fork.Params.removeNode(k as any));
  return fork;
}

skipSkifRankUpdate.files = [
  "/QuestNodePrototypes/Arch_L.cfg",
  "/QuestNodePrototypes/Arch_L_Assault_E08.cfg",
  "/QuestNodePrototypes/E02_MQ03.cfg",
  "/QuestNodePrototypes/E03_MQ01.cfg",
  "/QuestNodePrototypes/E03_MQ05.cfg",
  "/QuestNodePrototypes/E03_MQ06.cfg",
  "/QuestNodePrototypes/E05_MQ01.cfg",
  "/QuestNodePrototypes/E05_MQ02.cfg",
  "/QuestNodePrototypes/E05_MQ03.cfg",
  "/QuestNodePrototypes/E05_MQ04.cfg",
  "/QuestNodePrototypes/E06_MQ03_C01.cfg",
  "/QuestNodePrototypes/E07_MQ05.cfg",
  "/QuestNodePrototypes/E08_MQ01.cfg",
  "/QuestNodePrototypes/E12_MQ01.cfg",
  "/QuestNodePrototypes/E14_MQ01.cfg",
  "/QuestNodePrototypes/E16_MQ01.cfg",
  "/QuestNodePrototypes/E16_MQ03.cfg",
  "/QuestNodePrototypes/EQ04.cfg",
  "/QuestNodePrototypes/EQ04_P.cfg",
  "/QuestNodePrototypes/EQ05.cfg",
  "/QuestNodePrototypes/EQ05_P.cfg",
  "/QuestNodePrototypes/EQ71.cfg",
  "/QuestNodePrototypes/QTC.cfg",
  "/QuestNodePrototypes/SQ102_P.cfg",
];
skipSkifRankUpdate.contents = ["EQuestNodeType::SetCharacterParam"];
skipSkifRankUpdate.contains = true;

let addXpGlobalVarOnce = false;

function addXpGlobalVariable(_struct: Struct, context) {
  if (addXpGlobalVarOnce) {
    return null;
  }
  addXpGlobalVarOnce = true;
  if (context?.structsById?.XP) {
    return null;
  }

  context.extraStructs.push(
    new Struct({
      __internal__: { refkey: "[0]", rawName: "XP", isRoot: true },
      SID: "XP",
      Type: "EGlobalVariableType::Int",
      DefaultValue: 0,
    }),
  );

  return [];
}

addXpGlobalVariable.files = ["/GlobalVariablePrototypes.cfg"];

let addFactionPatchesOnce = false;

const ICON_BASE = "Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/PDA/FractionIcons/";

function addFactionPatchItems(_struct: Struct, context) {
  if (addFactionPatchesOnce) {
    return null;
  }
  addFactionPatchesOnce = true;

  const template = new Struct({
    __internal__: { refurl: "../ItemPrototypes.cfg", refkey: "[0]", rawName: "FactionPatch", isRoot: true },
    SID: "FactionPatch",
    Icon: `${ICON_BASE}T_inv_BanditsPatch.T_inv_BanditsPatch'`,
    MeshPrototypeSID: "Icon",
    Weight: 0.01,
    Cost: 250,
    Type: "EItemType::Other",
    MaxStackCount: 1000,
    IsQuestItem: false,
    ItemGridWidth: 1,
    ItemGridHeight: 1,
  }) as QuestItemPrototype;

  const patchDefs = [
    { SID: `${template.SID}Scientist`, Icon: `${ICON_BASE}T_inv_ScientistPatch.T_inv_ScientistPatch'` },
    { SID: `${template.SID}Spark`, Icon: `${ICON_BASE}T_inv_SparkPatch.T_inv_SparkPatch'` },
    { SID: `${template.SID}Duty`, Icon: `${ICON_BASE}T_inv_DutyPatch.T_inv_DutyPatch'` },
    { SID: `${template.SID}Freedom`, Icon: `${ICON_BASE}T_inv_FreedomPatch.T_inv_FreedomPatch'` },
    { SID: `${template.SID}Loners`, Icon: `${ICON_BASE}T_inv_LonersPatch.T_inv_LonersPatch'`, cost: 125 },
    { SID: `${template.SID}Neutral`, Icon: `${ICON_BASE}T_inv_NeutralPatch.T_inv_NeutralPatch'`, cost: 125 },
    { SID: `${template.SID}Mercenaries`, Icon: `${ICON_BASE}T_inv_MercenariesPatch.T_inv_MercenariesPatch'` },
    { SID: `${template.SID}ISPF`, Icon: `${ICON_BASE}T_inv_ISPFPatch.T_inv_ISPFPatch'` },
    { SID: `${template.SID}Monolith`, Icon: `${ICON_BASE}T_inv_MonolithPatch.T_inv_MonolithPatch'` },
    { SID: `${template.SID}Noon`, Icon: `${ICON_BASE}T_inv_NoonPatch.T_inv_NoonPatch'` },
    { SID: `${template.SID}Corpus`, Icon: `${ICON_BASE}T_inv_CorpusPatch.T_inv_CorpusPatch'` },
    { SID: `${template.SID}Varta`, Icon: `${ICON_BASE}T_inv_VartaPatch.T_inv_VartaPatch'` },
    { SID: `${template.SID}Bandits`, Icon: `${ICON_BASE}T_inv_BanditsPatch.T_inv_BanditsPatch'` },
  ];
  const patches = patchDefs.map(
    ({ SID, Icon, cost }) =>
      new Struct({
        __internal__: { refkey: "FactionPatch", rawName: SID, isRoot: true },
        SID,
        Icon,
        ...(cost !== undefined ? { Cost: cost } : {}),
      }),
  );

  context.extraStructs.push(template, ...patches);
  return [];
}

addFactionPatchItems.files = ["/ItemPrototypes/CL_ItemPrototypes.cfg"];
