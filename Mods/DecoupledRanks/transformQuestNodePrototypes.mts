import type { ERank } from "s2cfgtojson";
import type { DialogPrototypeItemPrototypeSID, DialogPrototypeMoney, QuestNodePrototypeConditionsItemItem, QuestNodePrototypeParams } from "s2cfgtojson";
import { Struct } from "s2cfgtojson";
import type { QuestNodePrototype, QuestNodePrototypeIf, QuestNodePrototypeConsoleCommand, QuestNodePrototypeItemAdd, QuestNodePrototypeItemRemove, QuestNodePrototypeOnPlayerGetItemEvent, QuestNodePrototypeSetCharacterParam, QuestNodePrototypeTechnical } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { modName } from "../../src/base-paths.mts";
import { FactionPatchDefinitions } from "../FactionPatches/addFactionPatchItems.mts";
import { getNonQuestFactionPatchSID, LEVEL_COUNTER_ITEM_SID, RANK_INDICATOR_ITEM_SIDS, XP_COUNTER_ITEM_SID } from "./transformKeyItemPrototypes.mts";
import { getConditions, getLaunchers } from "../../src/struct-utils.mts";
import { NPCRank } from "../../src/consts.mts";

export const levelThresholds = [
  { level: 1, xp: 0 },
  { level: 2, xp: 350 },
  { level: 3, xp: 900 },
  { level: 4, xp: 1600 },
  { level: 5, xp: 2450 },
  { level: 6, xp: 3350 },
  { level: 7, xp: 3950 },
  { level: 8, xp: 4400 },
  { level: 9, xp: 4750 },
  { level: 10, xp: 5000 },
  { level: 11, xp: 5900 },
  { level: 12, xp: 7000 },
  { level: 13, xp: 8300 },
  { level: 14, xp: 9800 },
  { level: 15, xp: 11500 },
  { level: 16, xp: 13300 },
  { level: 17, xp: 15000 },
  { level: 18, xp: 16300 },
  { level: 19, xp: 17200 },
  { level: 20, xp: 18000 },
  { level: 21, xp: 19600 },
  { level: 22, xp: 21400 },
  { level: 23, xp: 23400 },
  { level: 24, xp: 25600 },
  { level: 25, xp: 28000 },
  { level: 26, xp: 30300 },
  { level: 27, xp: 32300 },
  { level: 28, xp: 33900 },
  { level: 29, xp: 35100 },
  { level: 30, xp: 36000 },
] as const;

export const rankThresholdsByLevel: Array<{ lowLevel: number; highLevel?: number; rank: ERank }> = [
  { lowLevel: 1, highLevel: 10, rank: "ERank::Newbie" },
  { lowLevel: 10, highLevel: 20, rank: "ERank::Experienced" },
  { lowLevel: 20, highLevel: 30, rank: "ERank::Veteran" },
  { lowLevel: 30, rank: "ERank::Master" },
];

const SKIF_GUID = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

let once = false;

function getRankIndicatorItemSID(rank: ERank) {
  return RANK_INDICATOR_ITEM_SIDS[rank as keyof typeof RANK_INDICATOR_ITEM_SIDS];
}

function asTrueConnection(node: QuestNodePrototype) {
  return { SID: node.SID, Name: "True" };
}

function asSuccessConnection(node: QuestNodePrototype) {
  if (node.NodeType === "EQuestNodeType::If" || node.NodeType === "EQuestNodeType::Condition") {
    return asTrueConnection(node);
  }
  return { SID: node.SID, Name: "" };
}

function getLaunchQuestNode(struct: QuestNodePrototype) {
  const launchQuestSID = `${struct.QuestSID}_run_${modName}`;

  return new Struct({
    ConsoleCommand: "XStartQuestNodeBySID DecoupledRanks_OnPlayerGetItemEvent_FactionPatchBandits",
    NodeType: "EQuestNodeType::ConsoleCommand",
    QuestSID: struct.QuestSID,
    SID: launchQuestSID,
    Launchers: getLaunchers([{ SID: "rootgraph_Start" }]),
    __internal__: {
      rawName: launchQuestSID,
      isRoot: true,
    },
  }) as QuestNodePrototypeConsoleCommand;
}

export const transformQuestNodePrototypes: StructTransformer<QuestNodePrototypeSetCharacterParam> = (struct, context) => {
  const extraStructs = [];

  if (context.filePath.endsWith("/QuestNodePrototypes/rootgraph.cfg") && !once) {
    once = true;
    extraStructs.push(getLaunchQuestNode(struct));
    extraStructs.push(...createOnPlayerGetFactionPatchEventListeners());
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

function createOnPlayerGetFactionPatchEventListeners() {
  const extraStructs: Struct[] = [];
  const xpAdjustNodes: Array<QuestNodePrototypeItemAdd | QuestNodePrototypeItemRemove> = [];

  FactionPatchDefinitions.forEach((patchDef) => {
    const onPatchReceivedNode = getOnItemReceivedNode(patchDef.SID);                                                                               // Trigger when player gets this faction patch item.
    const hasQuestPatchNode = getConditionNode(onPatchReceivedNode);                                                                 //  Check that the received patch is a quest variant.
    const removeQuestPatchNode = getRemovePatchNode(hasQuestPatchNode);                                                                // Remove quest patch item after check.
    hasQuestPatchNode.Launchers = getLaunchers([onPatchReceivedNode, removeQuestPatchNode]);

    const adjustXpItem = getAdjustXPItemNode(hasQuestPatchNode, NPCRank[patchDef.Faction]);                                         // Add/remove XP counter item for this patch reward.
    const addNonQuestPatchNode = getAddNonQuestPatchNode(hasQuestPatchNode);                                                            // Grant normalized non-quest patch item.

    extraStructs.push(onPatchReceivedNode);
    extraStructs.push(hasQuestPatchNode);
    extraStructs.push(adjustXpItem);
    xpAdjustNodes.push(adjustXpItem);
    extraStructs.push(removeQuestPatchNode);
    extraStructs.push(addNonQuestPatchNode);
  });

  const levelThresholdNode = getDelay(xpAdjustNodes, `${modName}_SharedLevelThresholdNode`);
  extraStructs.push(levelThresholdNode);
  const levelSyncNodes = levelThresholds.flatMap((entry, i, arr) => {
    const highXp = arr[i + 1]?.xp ?? Infinity;
    return getLevelSyncNodes(levelThresholdNode, entry.level, entry.xp, highXp);
  });
  extraStructs.push(...levelSyncNodes);

  const rankThresholdNode = getDelay(
    levelSyncNodes.filter((node): node is QuestNodePrototypeItemAdd => node.NodeType === "EQuestNodeType::ItemAdd"),
    `${modName}_SharedRankThresholdNode`,
  );
  extraStructs.push(rankThresholdNode);
  const missingRankIndicators = [];

  rankThresholdsByLevel.forEach(({ lowLevel, highLevel, rank }) => {
    const { finalNode: conditionNode, nodes: thresholdNodes } = getRankThresholdConditionChain(rankThresholdNode, rank, lowLevel, highLevel ?? Infinity); // Match current level against this rank bracket.

    const missingRankIndicator = getMissingRankIndicator(conditionNode, rank);                                                       // Continue only if this rank indicator is currently missing.
    missingRankIndicators.push(missingRankIndicator);
    const delay = getDelay([missingRankIndicator], `${modName}_${rank.split("::").pop()}_delay`, 1);                   // Small sequencing delay before rank apply.
    delay.Launchers = getLaunchers([asTrueConnection(missingRankIndicator)]);
    const setRankNode = getSetRankNode(delay, rank);                                                                                   // Write resolved player rank param.
    const addCurrentRankIndicatorNode = getAddCurrentRankIndicatorNode(delay, rank);                                                    // Add indicator item for active rank.

    extraStructs.push(...thresholdNodes);
    extraStructs.push(missingRankIndicator);
    extraStructs.push(delay);
    extraStructs.push(setRankNode);
    extraStructs.push(addCurrentRankIndicatorNode);
  });
  const removeAllRankIndicatorNodes = getRemoveAllRankIndicatorNodes(missingRankIndicators);                                                  // Remove all rank indicators before adding current one.
  extraStructs.push(...removeAllRankIndicatorNodes);

  return extraStructs;
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

function getOnItemReceivedNode(SID: string): QuestNodePrototypeOnPlayerGetItemEvent {
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

function getAdjustXPItemNode(hasQuestPatchNode: QuestNodePrototypeIf, xp: number) {
  const amount = Math.abs(xp);
  const isAdd = xp > 0;
  const ItemSID = hasQuestPatchNode.Conditions["0"]["0"].ItemPrototypeSID.VariableValue as string;

  const node = new Struct() as QuestNodePrototypeItemAdd | QuestNodePrototypeItemRemove;
  node.ItemSID = XP_COUNTER_ITEM_SID;
  node.ItemsCount = amount;
  node.Launchers = getLaunchers([asTrueConnection(hasQuestPatchNode)]);
  node.QuestSID = hasQuestPatchNode.QuestSID;
  node.Repeatable = true;
  node.SID = `${modName}_${isAdd ? "add" : "remove"}XpItem_${ItemSID}`;
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

function getDelay(launcherNodes: Array<QuestNodePrototype>, SID: string, length = 0) {
  return new Struct({
    Launchers: getLaunchers(launcherNodes),
    NodeType: "EQuestNodeType::Technical",
    QuestSID: launcherNodes[0].QuestSID,
    Repeatable: true,
    SID,
    StartDelay: length,
    __internal__: {
      rawName: SID,
      isRoot: true,
    },
  }) as QuestNodePrototypeTechnical;
}

function getInventoryThresholdConditionNode(
  launcher: QuestNodePrototype,
  sid: string,
  itemSID: string,
  compare: "EConditionComparance::GreaterOrEqual" | "EConditionComparance::Less",
  value: number,
) {
  const node = new Struct() as QuestNodePrototypeIf;
  node.SID = sid;
  node.QuestSID = modName;
  node.NodeType = "EQuestNodeType::If";
  node.Repeatable = true;
  // Chain condition checks through the successful branch only.
  node.Launchers = getLaunchers([asSuccessConnection(launcher)]);
  node.Conditions = getConditions([
    {
      ConditionType: "EQuestConditionType::ItemInInventory",
      TargetCharacter: SKIF_GUID,
      ItemPrototypeSID: { VariableType: "EGlobalVariableType::String", VariableValue: itemSID },
      WithEquipped: true,
      WithInventory: true,
      ConditionComparance: compare,
      ItemsCount: { VariableType: "EGlobalVariableType::Int", VariableValue: value },
    },
  ] as QuestNodePrototypeConditionsItemItem[]);

  node.__internal__.isRoot = true;
  node.__internal__.rawName = node.SID;
  return node;
}

function getThresholdConditionChain(
  launcher: QuestNodePrototypeTechnical,
  itemSID: string,
  sidPrefix: string,
  lowValue: number,
  highValue: number,
) {
  const nodes: QuestNodePrototypeIf[] = [];
  let currentLauncher: QuestNodePrototype = launcher;

  if (lowValue > 0) {
    const minNode = getInventoryThresholdConditionNode(
      currentLauncher,
      `${sidPrefix}_Min`,
      itemSID,
      "EConditionComparance::GreaterOrEqual",
      lowValue,
    );
    nodes.push(minNode);
    currentLauncher = minNode;
  }

  if (Number.isFinite(highValue)) {
    const maxNode = getInventoryThresholdConditionNode(
      currentLauncher,
      sidPrefix,
      itemSID,
      "EConditionComparance::Less",
      highValue,
    );
    nodes.push(maxNode);
    return { finalNode: maxNode, nodes };
  }

  const minOnlyNode = getInventoryThresholdConditionNode(
    currentLauncher,
    sidPrefix,
    itemSID,
    "EConditionComparance::GreaterOrEqual",
    lowValue,
  );
  nodes.push(minOnlyNode);
  return { finalNode: minOnlyNode, nodes };
}

function getRankThresholdConditionChain(launcher: QuestNodePrototypeTechnical, rank: ERank, lowLevel: number, highLevel: number) {
  const rankName = rank.replace("ERank::", "");
  return getThresholdConditionChain(launcher, LEVEL_COUNTER_ITEM_SID, `${modName}_rankCheck_${rankName}`, lowLevel, highLevel);
}

function getLevelSyncNodes(launcher: QuestNodePrototypeTechnical, level: number, lowXp: number, highXp: number) {
  const { finalNode: xpRangeNode, nodes } = getThresholdConditionChain(
    launcher,
    XP_COUNTER_ITEM_SID,
    `${modName}_levelCheck_${level}`,
    lowXp,
    highXp,
  );
  const levelMissingNode = new Struct() as QuestNodePrototypeIf;
  levelMissingNode.SID = `${modName}_levelMissing_${level}`;
  levelMissingNode.QuestSID = modName;
  levelMissingNode.NodeType = "EQuestNodeType::If";
  levelMissingNode.Repeatable = true;
  levelMissingNode.Launchers = getLaunchers([asTrueConnection(xpRangeNode)]);
  levelMissingNode.Conditions = getConditions([
    {
      ConditionType: "EQuestConditionType::ItemInInventory",
      ConditionComparance: "EConditionComparance::Less",
      TargetCharacter: SKIF_GUID,
      ItemPrototypeSID: new Struct({
        VariableType: "EGlobalVariableType::String",
        VariableValue: LEVEL_COUNTER_ITEM_SID,
      }) as DialogPrototypeItemPrototypeSID,
      ItemsCount: new Struct({
        VariableType: "EGlobalVariableType::Int",
        VariableValue: level,
      }) as DialogPrototypeMoney,
      WithEquipped: true,
      WithInventory: true,
    },
  ] as const);
  levelMissingNode.__internal__.isRoot = true;
  levelMissingNode.__internal__.rawName = levelMissingNode.SID;

  const removeLevelNode = new Struct() as QuestNodePrototypeItemRemove;
  removeLevelNode.ItemSID = LEVEL_COUNTER_ITEM_SID;
  removeLevelNode.ItemsCount = levelThresholds[levelThresholds.length - 1].level;
  removeLevelNode.Launchers = getLaunchers([asTrueConnection(levelMissingNode)]);
  removeLevelNode.NodeType = "EQuestNodeType::ItemRemove";
  removeLevelNode.QuestSID = modName;
  removeLevelNode.Repeatable = true;
  removeLevelNode.SID = `${modName}_clearLevel_${level}`;
  removeLevelNode.TargetQuestGuid = SKIF_GUID;
  removeLevelNode.__internal__.isRoot = true;
  removeLevelNode.__internal__.rawName = removeLevelNode.SID;

  const addLevelNode = new Struct() as QuestNodePrototypeItemAdd;
  addLevelNode.AddToPlayerStash = false;
  addLevelNode.ItemSID = LEVEL_COUNTER_ITEM_SID;
  addLevelNode.ItemsCount = level;
  addLevelNode.Launchers = getLaunchers([removeLevelNode]);
  addLevelNode.NodeType = "EQuestNodeType::ItemAdd";
  addLevelNode.QuestSID = modName;
  addLevelNode.Repeatable = true;
  addLevelNode.SID = `${modName}_setLevel_${level}`;
  addLevelNode.TargetQuestGuid = SKIF_GUID;
  addLevelNode.__internal__.isRoot = true;
  addLevelNode.__internal__.rawName = addLevelNode.SID;

  return [...nodes, levelMissingNode, removeLevelNode, addLevelNode];
}

function getSetRankNode(conditionNode: QuestNodePrototype, rank: ERank) {
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

function getMissingRankIndicator(launcherNode: QuestNodePrototype, rank: ERank) {
  const rankName = rank.replace("ERank::", "");
  const node = new Struct() as QuestNodePrototypeIf;
  node.SID = `${modName}_rankIconMissing_${rankName}`;
  node.QuestSID = modName;
  node.NodeType = "EQuestNodeType::If";
  node.Repeatable = true;
  node.Launchers = getLaunchers([asTrueConnection(launcherNode)]);
  node.Conditions = getConditions([
    {
      ConditionType: "EQuestConditionType::ItemInInventory",
      ConditionComparance: "EConditionComparance::Less",
      TargetCharacter: SKIF_GUID,
      ItemPrototypeSID: new Struct({
        VariableType: "EGlobalVariableType::String",
        VariableValue: getRankIndicatorItemSID(rank),
      }) as DialogPrototypeItemPrototypeSID,
      ItemsCount: new Struct({
        VariableType: "EGlobalVariableType::Int",
        VariableValue: 1,
      }) as DialogPrototypeMoney,
      WithEquipped: true,
      WithInventory: true,
    },
  ] as const);

  node.__internal__.isRoot = true;
  node.__internal__.rawName = node.SID;
  return node;
}

function getRemoveAllRankIndicatorNodes(launcherNodes: QuestNodePrototypeIf[]) {
  const rankSids = Object.entries(RANK_INDICATOR_ITEM_SIDS);

  return rankSids.map(([rank, itemSID]) => {
    const node = new Struct() as QuestNodePrototypeItemRemove;
    node.ItemSID = itemSID;
    node.ItemsCount = 1;
    node.Launchers = getLaunchers(
      launcherNodes
        .filter((ln) => ln.Conditions["0"]["0"].ItemPrototypeSID.VariableValue !== itemSID)
        .map(asTrueConnection),
    );
    node.NodeType = "EQuestNodeType::ItemRemove";
    node.QuestSID = modName;
    node.Repeatable = true;
    node.SID = `${modName}_removeRankIndicator_${rank.split("::").pop()}`;
    node.TargetQuestGuid = SKIF_GUID;
    node.__internal__.isRoot = true;
    node.__internal__.rawName = node.SID;
    return node;
  });
}

function getAddCurrentRankIndicatorNode(launcherNode: QuestNodePrototype, rank: ERank) {
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

function getConditionNode(onPatchReceivedNode: QuestNodePrototypeOnPlayerGetItemEvent): QuestNodePrototypeIf {
  const hasQuestPatchNode = new Struct() as QuestNodePrototypeIf;
  hasQuestPatchNode.SID = `${modName}_hasQuestPatch_${onPatchReceivedNode.ItemPrototypeSID}`;
  hasQuestPatchNode.QuestSID = onPatchReceivedNode.QuestSID;
  hasQuestPatchNode.NodeType = "EQuestNodeType::If";
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
      ItemsCount: new Struct({
        VariableType: "EGlobalVariableType::Int",
        VariableValue: 1,
      }) as DialogPrototypeMoney,
      WithEquipped: true,
      WithInventory: true,
    },
  ] as const);
  hasQuestPatchNode.__internal__.isRoot = true;
  hasQuestPatchNode.__internal__.rawName = hasQuestPatchNode.SID;
  return hasQuestPatchNode;
}

function getRemovePatchNode(hasQuestPatchNode: QuestNodePrototypeIf): QuestNodePrototypeItemRemove {
  const ItemSID = hasQuestPatchNode.Conditions["0"]["0"].ItemPrototypeSID.VariableValue as string;
  const removeOriginalPatchNode = new Struct() as QuestNodePrototypeItemRemove;
  removeOriginalPatchNode.ItemSID = ItemSID;
  removeOriginalPatchNode.ItemsCount = 1;
  removeOriginalPatchNode.Launchers = getLaunchers([asTrueConnection(hasQuestPatchNode)]);
  removeOriginalPatchNode.NodeType = "EQuestNodeType::ItemRemove";
  removeOriginalPatchNode.QuestSID = hasQuestPatchNode.QuestSID;
  removeOriginalPatchNode.Repeatable = true;
  removeOriginalPatchNode.SID = `${modName}_removeOriginalPatch_${ItemSID}`;
  removeOriginalPatchNode.TargetQuestGuid = SKIF_GUID;
  removeOriginalPatchNode.__internal__.isRoot = true;
  removeOriginalPatchNode.__internal__.rawName = removeOriginalPatchNode.SID;
  return removeOriginalPatchNode;
}

function getAddNonQuestPatchNode(hasQuestPatchNode: QuestNodePrototypeIf) {
  const ItemSID = hasQuestPatchNode.Conditions["0"]["0"].ItemPrototypeSID.VariableValue as string;

  const addNonQuestPatchNode = new Struct() as QuestNodePrototypeItemAdd;
  addNonQuestPatchNode.AddToPlayerStash = false;
  addNonQuestPatchNode.ItemSID = getNonQuestFactionPatchSID(ItemSID);
  addNonQuestPatchNode.ItemsCount = 1;
  addNonQuestPatchNode.Launchers = getLaunchers([asTrueConnection(hasQuestPatchNode)]);
  addNonQuestPatchNode.NodeType = "EQuestNodeType::ItemAdd";
  addNonQuestPatchNode.QuestSID = hasQuestPatchNode.QuestSID;
  addNonQuestPatchNode.Repeatable = true;
  addNonQuestPatchNode.SID = `${modName}_addNonQuestPatch_${ItemSID}`;
  addNonQuestPatchNode.TargetQuestGuid = SKIF_GUID;
  addNonQuestPatchNode.__internal__.isRoot = true;
  addNonQuestPatchNode.__internal__.rawName = addNonQuestPatchNode.SID;

  return addNonQuestPatchNode;
}

transformQuestNodePrototypes.files = [
  "/QuestNodePrototypes/rootgraph.cfg",
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
