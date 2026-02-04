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
  structTransformers: [skipSkifRankUpdate, addXpGlobalVariable, ],
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
