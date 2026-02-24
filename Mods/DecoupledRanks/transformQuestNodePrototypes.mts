import {
  QuestNodePrototype,
  QuestNodePrototypeCondition,
  QuestNodePrototypeItemAdd,
  QuestNodePrototypeItemRemove,
  QuestNodePrototypeOnPlayerGetItemEvent,
  QuestNodePrototypeSetCharacterParam,
  QuestNodePrototypeShowFadeScreen,
  QuestNodePrototypeTechnical,
  Struct,
} from "s2cfgtojson";
import { StructTransformer } from "../../src/meta-type.mts";
import { modName } from "../../src/base-paths.mts";
import { FactionPatchDefinitions } from "../FactionPatches/addFactionPatchItems.mts";
import { getNonQuestFactionPatchSID, RANK_INDICATOR_ITEM_SIDS, XP_COUNTER_ITEM_SID } from "./transformKeyItemPrototypes.mts";
import { getConditions, getLaunchers } from "../../src/struct-utils.mts";
import { NPCRank } from "../../src/consts.mts";
import type { DialogPrototypeItemPrototypeSID, ERank, QuestNodePrototypeParams } from "s2cfgtojson";

// XP thresholds for player rank progression in ascending order.
export const rankThresholdsByXp: Record<number, ERank> = {
  0: "ERank::Newbie",
  2500: "ERank::Experienced",
  10000: "ERank::Veteran",
  20000: "ERank::Master",
} as const satisfies Record<number, ERank>;

const SKIF_GUID = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

let onceQtcBootstrap = false;

function getRankIndicatorItemSID(rank: ERank) {
  return RANK_INDICATOR_ITEM_SIDS[rank as keyof typeof RANK_INDICATOR_ITEM_SIDS];
}

export const transformQuestNodePrototypes: StructTransformer<QuestNodePrototype> = (struct: QuestNodePrototypeSetCharacterParam) => {
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
  const xpAdjustNodes: Array<QuestNodePrototypeItemAdd | QuestNodePrototypeItemRemove> = [];
  FactionPatchDefinitions.forEach((patchDef) => {
    const onPatchReceivedNode = getOnItemReceivedNode(patchDef.SID);
    extraStructs.push(onPatchReceivedNode);

    const gotXPNode = getGotXPNode(onPatchReceivedNode, NPCRank[patchDef.Faction]);
    extraStructs.push(gotXPNode);

    const adjustXpItem = getAdjustXPItemNode(onPatchReceivedNode, NPCRank[patchDef.Faction]);
    extraStructs.push(adjustXpItem);
    xpAdjustNodes.push(adjustXpItem);

    extraStructs.push(...getReplacePatchWithNonQuestNodes(onPatchReceivedNode));
  });
  extraStructs.push(...getSharedRankThresholdNodes(xpAdjustNodes));
}

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

function getOnItemReceivedNode(SID: string) {
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

function getAdjustXPItemNode(onPatchReceivedNode: QuestNodePrototypeOnPlayerGetItemEvent, xp: number) {
  const amount = Math.abs(xp);
  const isAdd = xp > 0;

  const node = new Struct() as QuestNodePrototypeItemAdd | QuestNodePrototypeItemRemove;
  node.ItemSID = XP_COUNTER_ITEM_SID;
  node.ItemsCount = amount;
  node.Launchers = getLaunchers([onPatchReceivedNode]);
  node.QuestSID = onPatchReceivedNode.QuestSID;
  node.Repeatable = true;
  node.SID = `${modName}_${isAdd ? "add" : "remove"}XpItem_${onPatchReceivedNode.ItemPrototypeSID}`;
  node.TargetQuestGuid = SKIF_GUID;

  if (isAdd) {
    (node as QuestNodePrototypeItemAdd).NodeType = "EQuestNodeType::ItemAdd";
    (node as QuestNodePrototypeItemAdd).AddToPlayerStash = false;
  } else {
    (node as QuestNodePrototypeItemRemove).NodeType = "EQuestNodeType::ItemRemove";
  }

  node.__internal__.isRoot = true;
  node.__internal__.rawName = node.SID;
  return node;
}

function getSharedRankThresholdNodes(launcherNodes: Array<QuestNodePrototypeItemAdd | QuestNodePrototypeItemRemove>) {
  const thresholdsAsc = Object.entries(rankThresholdsByXp)
    .map(([xp, rank]) => ({ xp: Number(xp), rank }))
    .sort((a, b) => a.xp - b.xp);
  const thresholdsDesc = [...thresholdsAsc].reverse();

  const nodes: QuestNodePrototype[] = [];
  thresholdsDesc.forEach((threshold, i) => {
    const nextHigher = i === 0 ? undefined : thresholdsDesc[i - 1];
    const xpConditionNode = getRankThresholdConditionNode(launcherNodes, threshold, nextHigher);
    const rankIndicatorMissingNode = getMissingRankIndicatorConditionNode(xpConditionNode, threshold.rank);
    const setRankNode = getSetRankNode(rankIndicatorMissingNode, threshold.rank);
    const rankIndicatorProofNode = getRankIndicatorProofNode(rankIndicatorMissingNode, threshold.rank);
    const removeRankIndicatorNodes = getRemoveAllRankIndicatorNodes(rankIndicatorProofNode, threshold.rank);
    const addCurrentRankIndicatorNode = getAddCurrentRankIndicatorNode(removeRankIndicatorNodes.at(-1)!, threshold.rank);

    nodes.push(xpConditionNode, rankIndicatorMissingNode, setRankNode, rankIndicatorProofNode, ...removeRankIndicatorNodes);
    if (threshold.rank !== "ERank::Newbie") {
      nodes.push(getRankAdvanceMessageNode(setRankNode, threshold.rank));
    }
    nodes.push(addCurrentRankIndicatorNode);
  });

  return nodes;
}

function getRankThresholdConditionNode(
  launcherNodes: Array<QuestNodePrototypeItemAdd | QuestNodePrototypeItemRemove>,
  threshold: { xp: number; rank: ERank },
  nextHigher?: { xp: number; rank: ERank },
) {
  const rankName = threshold.rank.replace("ERank::", "");
  const node = new Struct() as QuestNodePrototypeCondition;
  node.SID = `${modName}_rankCheck_${rankName}`;
  node.QuestSID = modName;
  node.NodeType = "EQuestNodeType::Condition";
  node.Repeatable = true;
  node.Launchers = getLaunchers(launcherNodes);
  node.Conditions = getConditions([
    {
      ConditionType: "EQuestConditionType::ItemInInventory",
      ConditionComparance: "EConditionComparance::GreaterOrEqual",
      TargetCharacter: SKIF_GUID,
      ItemPrototypeSID: new Struct({
        VariableType: "EGlobalVariableType::String",
        VariableValue: XP_COUNTER_ITEM_SID,
      }) as DialogPrototypeItemPrototypeSID,
      NumericValue: threshold.xp,
      WithEquipped: true,
      WithInventory: true,
    },
    ...(nextHigher
      ? [
          {
            ConditionType: "EQuestConditionType::ItemInInventory" as const,
            ConditionComparance: "EConditionComparance::Less" as const,
            TargetCharacter: SKIF_GUID,
            ItemPrototypeSID: new Struct({
              VariableType: "EGlobalVariableType::String",
              VariableValue: XP_COUNTER_ITEM_SID,
            }) as DialogPrototypeItemPrototypeSID,
            NumericValue: nextHigher.xp,
            WithEquipped: true,
            WithInventory: true,
          },
        ]
      : []),
  ] as const);

  node.__internal__.isRoot = true;
  node.__internal__.rawName = node.SID;
  return node;
}

function getSetRankNode(conditionNode: QuestNodePrototypeCondition, rank: ERank) {
  const rankName = rank.replace("ERank::", "");
  const node = new Struct() as QuestNodePrototypeSetCharacterParam;
  node.SID = `${modName}_setRank_${rankName}`;
  node.QuestSID = modName;
  node.NodeType = "EQuestNodeType::SetCharacterParam";
  node.Repeatable = true;
  node.TargetQuestGuid = SKIF_GUID;
  node.Launchers = getLaunchers([conditionNode]);
  node.Params = new Struct() as QuestNodePrototypeParams;
  node.Params.addNode(
    new Struct({
      ModifiedCharacterParam: "EModifiedCharacterParam::Rank",
      ChangeValueMode: "EChangeValueMode::Set",
      ChangeValue: 0,
      IgnoreDamageType: "EIgnoreDamageType::None",
      Rank: rank,
    }),
  );

  node.__internal__.isRoot = true;
  node.__internal__.rawName = node.SID;
  return node;
}

function getMissingRankIndicatorConditionNode(launcherNode: QuestNodePrototypeCondition, rank: ERank) {
  const rankName = rank.replace("ERank::", "");
  const node = new Struct() as QuestNodePrototypeCondition;
  node.SID = `${modName}_rankIconMissing_${rankName}`;
  node.QuestSID = modName;
  node.NodeType = "EQuestNodeType::Condition";
  node.Repeatable = true;
  node.Launchers = getLaunchers([launcherNode]);
  node.Conditions = getConditions([
    {
      ConditionType: "EQuestConditionType::ItemInInventory",
      ConditionComparance: "EConditionComparance::Less",
      TargetCharacter: SKIF_GUID,
      ItemPrototypeSID: new Struct({
        VariableType: "EGlobalVariableType::String",
        VariableValue: getRankIndicatorItemSID(rank),
      }) as DialogPrototypeItemPrototypeSID,
      NumericValue: 1,
      WithEquipped: true,
      WithInventory: true,
    },
  ] as const);

  node.__internal__.isRoot = true;
  node.__internal__.rawName = node.SID;
  return node;
}

function getRankAdvanceMessageNode(launcherNode: QuestNodePrototypeSetCharacterParam, rank: ERank) {
  const rankName = rank.replace("ERank::", "");
  const node = new Struct() as QuestNodePrototypeShowFadeScreen;
  node.FadeTime = 10;
  node.Launchers = getLaunchers([launcherNode]);
  node.NodeType = "EQuestNodeType::ShowFadeScreen";
  node.QuestSID = modName;
  node.Repeatable = true;
  node.ScreenText = `Skif advanced to ${rankName} rank`;
  node.SID = `${modName}_ShowFadeScreen_RankAdvance_${rankName}`;

  node.__internal__.isRoot = true;
  node.__internal__.rawName = node.SID;
  return node;
}

function getRankIndicatorProofNode(launcherNode: QuestNodePrototypeCondition, rank: ERank) {
  const rankName = rank.replace("ERank::", "");
  const node = new Struct() as QuestNodePrototypeTechnical;
  node.SID = `${modName}_rankIndicatorProof_${rankName}`;
  node.QuestSID = modName;
  node.NodeType = "EQuestNodeType::Technical";
  node.Repeatable = true;
  node.Launchers = getLaunchers([launcherNode]);
  node.StartDelay = 0;
  node.LaunchOnQuestStart = false;

  node.__internal__.isRoot = true;
  node.__internal__.rawName = node.SID;
  return node;
}

function getRemoveAllRankIndicatorNodes(launcherNode: QuestNodePrototype, rank: ERank) {
  const rankSids = Object.values(RANK_INDICATOR_ITEM_SIDS);
  const rankName = rank.replace("ERank::", "");
  let previousNode = launcherNode;
  return rankSids.map((itemSID, index) => {
    const node = new Struct() as QuestNodePrototypeItemRemove;
    node.ItemSID = itemSID;
    node.ItemsCount = 99;
    node.Launchers = getLaunchers([previousNode]);
    node.NodeType = "EQuestNodeType::ItemRemove";
    node.QuestSID = modName;
    node.Repeatable = true;
    node.SID = `${modName}_removeRankIndicator_${rankName}_${index}`;
    node.TargetQuestGuid = SKIF_GUID;
    node.__internal__.isRoot = true;
    node.__internal__.rawName = node.SID;
    previousNode = node;
    return node;
  });
}

function getAddCurrentRankIndicatorNode(launcherNode: QuestNodePrototypeItemRemove, rank: ERank) {
  const rankName = rank.replace("ERank::", "");
  const node = new Struct() as QuestNodePrototypeItemAdd;
  node.AddToPlayerStash = false;
  node.ItemSID = getRankIndicatorItemSID(rank);
  node.ItemsCount = 1;
  node.Launchers = getLaunchers([launcherNode]);
  node.NodeType = "EQuestNodeType::ItemAdd";
  node.QuestSID = modName;
  node.Repeatable = true;
  node.SID = `${modName}_addRankIndicator_${rankName}`;
  node.TargetQuestGuid = SKIF_GUID;
  node.__internal__.isRoot = true;
  node.__internal__.rawName = node.SID;
  return node;
}

function getReplacePatchWithNonQuestNodes(onPatchReceivedNode: QuestNodePrototypeOnPlayerGetItemEvent) {
  const hasQuestPatchNode = new Struct() as QuestNodePrototypeCondition;
  hasQuestPatchNode.SID = `${modName}_hasQuestPatch_${onPatchReceivedNode.ItemPrototypeSID}`;
  hasQuestPatchNode.QuestSID = onPatchReceivedNode.QuestSID;
  hasQuestPatchNode.NodeType = "EQuestNodeType::Condition";
  hasQuestPatchNode.Repeatable = true;
  hasQuestPatchNode.Conditions = getConditions([
    {
      ConditionType: "EQuestConditionType::ItemInInventory",
      ConditionComparance: "EConditionComparance::GreaterOrEqual",
      TargetCharacter: SKIF_GUID,
      ItemPrototypeSID: new Struct({
        VariableType: "EGlobalVariableType::String",
        VariableValue: onPatchReceivedNode.ItemPrototypeSID,
      }) as DialogPrototypeItemPrototypeSID,
      NumericValue: 1,
      WithEquipped: true,
      WithInventory: true,
    },
  ] as const);
  hasQuestPatchNode.__internal__.isRoot = true;
  hasQuestPatchNode.__internal__.rawName = hasQuestPatchNode.SID;

  const removeOriginalPatchNode = new Struct() as QuestNodePrototypeItemRemove;
  removeOriginalPatchNode.ItemSID = onPatchReceivedNode.ItemPrototypeSID;
  removeOriginalPatchNode.ItemsCount = 1;
  removeOriginalPatchNode.Launchers = getLaunchers([hasQuestPatchNode]);
  removeOriginalPatchNode.NodeType = "EQuestNodeType::ItemRemove";
  removeOriginalPatchNode.QuestSID = onPatchReceivedNode.QuestSID;
  removeOriginalPatchNode.Repeatable = true;
  removeOriginalPatchNode.SID = `${modName}_removeOriginalPatch_${onPatchReceivedNode.ItemPrototypeSID}`;
  removeOriginalPatchNode.TargetQuestGuid = SKIF_GUID;
  removeOriginalPatchNode.__internal__.isRoot = true;
  removeOriginalPatchNode.__internal__.rawName = removeOriginalPatchNode.SID;

  const addNonQuestPatchNode = new Struct() as QuestNodePrototypeItemAdd;
  addNonQuestPatchNode.AddToPlayerStash = false;
  addNonQuestPatchNode.ItemSID = getNonQuestFactionPatchSID(onPatchReceivedNode.ItemPrototypeSID);
  addNonQuestPatchNode.ItemsCount = 1;
  addNonQuestPatchNode.Launchers = getLaunchers([removeOriginalPatchNode]);
  addNonQuestPatchNode.NodeType = "EQuestNodeType::ItemAdd";
  addNonQuestPatchNode.QuestSID = onPatchReceivedNode.QuestSID;
  addNonQuestPatchNode.Repeatable = true;
  addNonQuestPatchNode.SID = `${modName}_addNonQuestPatch_${onPatchReceivedNode.ItemPrototypeSID}`;
  addNonQuestPatchNode.TargetQuestGuid = SKIF_GUID;
  addNonQuestPatchNode.__internal__.isRoot = true;
  addNonQuestPatchNode.__internal__.rawName = addNonQuestPatchNode.SID;

  // Re-triggering the condition from the replacement ItemAdd creates a recursion loop
  // if the engine still reports the quest patch as present at that moment.
  hasQuestPatchNode.Launchers = getLaunchers([onPatchReceivedNode]);

  return [hasQuestPatchNode, removeOriginalPatchNode, addNonQuestPatchNode] as const;
}

transformQuestNodePrototypes.files = [
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
