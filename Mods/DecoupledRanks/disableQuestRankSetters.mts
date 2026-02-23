import {
  QuestNodePrototype,
  QuestNodePrototypeOnPlayerGetItemEvent,
  QuestNodePrototypeSetCharacterParam,
  QuestNodePrototypeSetGlobalVariable,
  QuestNodePrototypeShowFadeScreen,
  QuestNodePrototypeTechnical,
  Struct,
} from "s2cfgtojson";
import { StructTransformer } from "../../src/meta-type.mts";
import { modName } from "../../src/base-paths.mts";
import { patchDefs } from "../FactionPatches/addFactionPatchItems.mts";
import { XP_GLOBAL_VARIABLE_SID } from "./addXpGlobalVariable.mts";
import { getLaunchers } from "../../src/struct-utils.mts";
import { allDefaultArtifactPrototypesRecord, ArtifactRankMap, DefaultArtifact, NPCRank } from "../../src/consts.mts";

const SKIF_GUID = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

let onceQtcBootstrap = false;

export const disableQuestRankSetters: StructTransformer<QuestNodePrototype> = (struct: QuestNodePrototypeSetCharacterParam) => {
  const extraStructs = [];

  if (!onceQtcBootstrap) {
    onceQtcBootstrap = true;
    createOnPlayerGetFactionPatchEventListeners(extraStructs);
  }

  let { rankParamKeys, hasNonRank } = collectRelevantKeys(struct);

  if (!rankParamKeys.length) {
    return extraStructs;
  }

  if (hasNonRank) {
    handleNonRank(struct, rankParamKeys, extraStructs);
  } else {
    handleRank(struct, extraStructs);
  }

  return extraStructs;
};

function createOnPlayerGetFactionPatchEventListeners(extraStructs: Struct[]) {
  patchDefs.forEach((patchDef) => {
    const onPatchReceivedNode = getOnPatchReceivedNode(patchDef.SID);
    extraStructs.push(onPatchReceivedNode);

    const gotXPNode = getGotXPNode(onPatchReceivedNode, NPCRank[patchDef.Faction]);
    extraStructs.push(gotXPNode);

    const bumpXp = getBumpXPVariableNode(onPatchReceivedNode, NPCRank[patchDef.Faction]);
    extraStructs.push(bumpXp);
  });

  Object.keys(ArtifactRankMap).forEach((artifact: DefaultArtifact) => {
    const SID = allDefaultArtifactPrototypesRecord[artifact].SID;
    const onPatchReceivedNode = getOnPatchReceivedNode(SID);
    extraStructs.push(onPatchReceivedNode);

    const gotXPNode = getGotXPNode(onPatchReceivedNode, ArtifactRankMap[SID]);
    extraStructs.push(gotXPNode);

    const bumpXp = getBumpXPVariableNode(onPatchReceivedNode, ArtifactRankMap[SID]);
    extraStructs.push(bumpXp);
  });
}

disableQuestRankSetters.files = [
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

/**
 * Preserve any non-rank param writes and remove only rank writes.
 */
function handleNonRank(struct: QuestNodePrototypeSetCharacterParam, rankParamKeys: string[], extraStructs: QuestNodePrototype[]) {
  const fork = struct.fork();
  fork.Params = struct.Params.fork();
  rankParamKeys.forEach((k) => {
    if (struct.Params[k] instanceof Struct) fork.Params[k] = new Struct();
    fork.Params.removeNode(k as any);
  });
  extraStructs.push(fork);
}

/**
 * If the node only sets Rank for Skif, replace it with a Technical noop.
 */
function handleRank(struct: QuestNodePrototypeSetCharacterParam, extraStructs: QuestNodePrototype[]) {
  const techNode = struct.fork();

  (techNode as QuestNodePrototype as QuestNodePrototypeTechnical).NodeType = "EQuestNodeType::Technical";
  (techNode as QuestNodePrototype as QuestNodePrototypeTechnical).StartDelay = 0;
  (techNode as QuestNodePrototype as QuestNodePrototypeTechnical).LaunchOnQuestStart = false;

  techNode.Params = struct.Params.fork();
  techNode.removeNode("Params");
  techNode.removeNode("TargetQuestGuid");

  extraStructs.push(techNode);
}

function collectRelevantKeys(struct: QuestNodePrototypeSetCharacterParam): {
  rankParamKeys: string[];
  hasNonRank: boolean;
} {
  if (struct.NodeType !== "EQuestNodeType::SetCharacterParam" || struct.TargetQuestGuid !== SKIF_GUID || !struct.Launchers) {
    return { rankParamKeys: [] as string[], hasNonRank: false };
  }
  const rankParamKeys: string[] = [];
  let hasNonRank = false;

  struct.Params.forEach(([k, p]) => {
    if (!p) return;
    if (p.ModifiedCharacterParam === "EModifiedCharacterParam::Rank") {
      rankParamKeys.push(k);
    } else {
      hasNonRank = true;
    }
  });
  return { rankParamKeys, hasNonRank };
}

function getOnPatchReceivedNode(SID: string) {
  const node = new Struct() as QuestNodePrototypeOnPlayerGetItemEvent;
  node.SID = `${modName}_OnPlayerGetItemEvent_${SID}`;
  node.QuestSID = modName;
  node.NodeType = "EQuestNodeType::OnPlayerGetItemEvent";
  node.LaunchOnQuestStart = true;
  node.Repeatable = true;
  node.EventType = "EQuestEventType::OnPlayerGetItem";
  node.TrackBeforeActive = false;
  node.ItemPrototypeSID = SID;
  node.ExpectedItemsCount = 1;
  node.WithEquipped = true;

  node.__internal__.isRoot = true;
  node.__internal__.rawName = node.SID;
  return node;
}

function getGotXPNode(onPatchReceivedNode: QuestNodePrototypeOnPlayerGetItemEvent, xp: number) {
  const printXpVarNode = new Struct() as QuestNodePrototypeShowFadeScreen;

  printXpVarNode.FadeTime = 1;
  printXpVarNode.Launchers = getLaunchers([{ SID: onPatchReceivedNode.SID }]);
  printXpVarNode.NodeType = "EQuestNodeType::ShowFadeScreen";
  printXpVarNode.QuestSID = onPatchReceivedNode.QuestSID;
  printXpVarNode.Repeatable = true;
  printXpVarNode.ScreenText = `+${xp} XP`;
  printXpVarNode.SID = `ShowFadeScreen_${onPatchReceivedNode.ItemPrototypeSID}`;

  printXpVarNode.__internal__.isRoot = true;
  printXpVarNode.__internal__.rawName = printXpVarNode.SID;
  return printXpVarNode;
}

function getBumpXPVariableNode(onPatchReceivedNode: QuestNodePrototypeOnPlayerGetItemEvent, xp: number) {
  const bumpXp = new Struct() as QuestNodePrototypeSetGlobalVariable;
  bumpXp.ChangeValueMode = "EChangeValueMode::Add";
  bumpXp.GlobalVariablePrototypeSID = XP_GLOBAL_VARIABLE_SID;
  bumpXp.Launchers = getLaunchers([onPatchReceivedNode]);
  bumpXp.NodeType = "EQuestNodeType::SetGlobalVariable";
  bumpXp.QuestSID = onPatchReceivedNode.QuestSID;
  bumpXp.Repeatable = true;
  bumpXp.SID = `${modName}_bumpXpBy_${xp}`;
  bumpXp.VariableValue = xp;
  bumpXp.__internal__.isRoot = true;
  bumpXp.__internal__.rawName = bumpXp.SID;
  return bumpXp;
}
