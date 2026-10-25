import { Struct } from "s2cfgtojson";
import type {
  QuestNodePrototype,
  QuestNodePrototypeConsoleCommand,
  QuestNodePrototypeIf,
  QuestNodePrototypeSetGlobalVariable,
  QuestNodePrototypeTechnical,
  QuestNodePrototypeToggleLairActivity,
} from "s2cfgtojson";
import { modName } from "../../src/base-paths.mts";
import { getConditions, getLaunchers } from "../../src/struct-utils.mts";
import { LEVEL_GLOBAL_VARIABLE_SID } from "../DecoupledRanks/transformGlobalVariablePrototypes.mts";
import {
  LAIR_TIER_GLOBAL_VARIABLE_SID,
  lairCopySID,
  forceDespawnLairs,
  lairHeldOffVariableSID,
  lairTierVariableSID,
  tieredLairs,
  lairsBySID,
  TIERS,
  tierStartLevel,
} from "./lairTiers.mts";

/** Records the tier the level calls for, then rescans the lairs near the player. */
export const LAIR_TIER_SYNC = `${modName}_Sync`;
/**
 * Started on every world load by the announce blueprint (meta.mts `gameStartCommand`). On a save from before
 * the mod, rootgraph_Start had already run, so the quest was never started: its False pin starts it then.
 */
export const ON_WORLD_LOAD = `${modName}_OnWorldLoad`;
/** The level is re-checked and the nearby lairs rescanned this often (two alternating delays). */
const POLL_SECONDS = 15;
/** Only lairs within this distance of the player switch tier (UE units: 1 km). */
const NEAR_PLAYER = 100000;
const SKIF_GUID = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

type Launcher = { SID: string; Name?: string };

function node<T extends QuestNodePrototype>(fields: Record<string, unknown>, launchers?: Launcher[]) {
  const s = new Struct({ Repeatable: true, ...fields }) as T;
  if (launchers?.length) s.Launchers = getLaunchers(launchers);
  s.__internal__.rawName = s.SID;
  s.__internal__.isRoot = true;
  return s;
}

const toggle = (SID: string, QuestSID: string, target: string, Activate: boolean, launchers: Launcher[], ForceDespawn = false) =>
  node<QuestNodePrototypeToggleLairActivity>(
    { SID, QuestSID, NodeType: "EQuestNodeType::ToggleLairActivity", TargetQuestGuid: target, Activate, ForceDespawn },
    launchers,
  );

const setVariable = (SID: string, QuestSID: string, variable: string, value: number, launchers: Launcher[]) =>
  node<QuestNodePrototypeSetGlobalVariable>(
    {
      SID,
      QuestSID,
      NodeType: "EQuestNodeType::SetGlobalVariable",
      GlobalVariablePrototypeSID: variable,
      ChangeValueMode: "EChangeValueMode::Set",
      VariableValue: value,
    },
    launchers,
  );

const variableCondition = (variable: string, comparance: string, value: number) => ({
  ConditionType: "EQuestConditionType::GlobalVariable",
  ConditionComparance: comparance,
  GlobalVariablePrototypeSID: variable,
  ChangeValueMode: "EChangeValueMode::Set",
  VariableValue: value,
});

/**
 * All conditions must hold. Vanilla puts each condition in its own group (`[0]`, `[1]`, ...) and joins
 * the groups with ConditionCheckType; conditions sharing one group are not ANDed. getConditions puts
 * them all in group [0], which made every multi-condition check here pass on any one condition: the
 * applied tier flipped 0 <-> 9 and every lair switched on every scan (2026-10-24).
 */
function allOf(conditions: object[]) {
  const all = new Struct({ ConditionCheckType: "EConditionCheckType::And" }) as any;
  conditions.forEach((condition) => all.addNode(new Struct({ 0: condition })));
  return all;
}

const ifVariables = (SID: string, conditions: object[], launchers: Launcher[], QuestSID = modName) =>
  node<QuestNodePrototypeIf>({ SID, QuestSID, NodeType: "EQuestNodeType::If", Conditions: allOf(conditions) }, launchers);

const consoleNode = (SID: string, QuestSID: string, ConsoleCommand: string, launchers: Launcher[]) =>
  node<QuestNodePrototypeConsoleCommand>({ SID, QuestSID, NodeType: "EQuestNodeType::ConsoleCommand", ConsoleCommand }, launchers);

const startNode = (SID: string, QuestSID: string, target: string, launchers: Launcher[]) =>
  consoleNode(SID, QuestSID, `XStartQuestNodeBySID ${target}`, launchers);

const heldOffIs = (lairSID: string, value: number) =>
  variableCondition(lairHeldOffVariableSID(lairSID), "EConditionComparance::Equal", value);

/** Lairs per scan batch quest; each batch starts the next one this many seconds after its own start. */
const LAIRS_PER_BATCH = 10;
const SECONDS_PER_BATCH = 0.5;
/** LAIRTIERS_DEBUG=1 at prepare-configs time shows "LairTiers switch <lair> <prototype> to T" on screen whenever a lair switches tier. */
const DEBUG = process.env.LAIRTIERS_DEBUG === "1";

const technical = (SID: string, StartDelay: number, launchers: Launcher[], QuestSID = modName, extra: Record<string, unknown> = {}) =>
  node<QuestNodePrototypeTechnical>({ SID, QuestSID, NodeType: "EQuestNodeType::Technical", StartDelay, ...extra }, launchers);

/** Ends the quest, like vanilla quests do (a console XEndQuestBySID from inside a quest never ended it). */
const endNode = (SID: string, QuestSID: string, launchers: Launcher[]) =>
  node<QuestNodePrototype>({ SID, QuestSID, NodeType: "EQuestNodeType::End", ExcludeAllNodesInContainer: false }, launchers);

/**
 * (Re)start a quest. `XResetQuestBySID` alone restarts it (shown in game 2026-10-24); a reset followed by
 * `XStartQuestBySID` started it twice, so each scan batch started its successor twice and the chain
 * multiplied without end.
 */
const restartQuest = (prefix: string, QuestSID: string, target: string, launchers: Launcher[]) => {
  const reset = consoleNode(`${prefix}_Reset`, QuestSID, `XResetQuestBySID ${target}`, launchers);
  return { nodes: [reset], started: reset };
};

/**
 * Lairs switch only near the player, lazily. Every quest stays small, because a running quest costs
 * game-thread time per node: 14,000 nodes in LairTiers, and later one 4,100-node scan quest left
 * running, each lagged the game massively (2026-10-23/24). The always-running LairTiers quest (~70
 * nodes) records the tier the level calls for and restarts the scan for that tier every poll. A scan is
 * a chain of batch quests `LairTiers_Scan_<T>_<b>` (~10 lairs, ~130 nodes each): each checks its lairs,
 * restarts the next batch and ends, so only one small quest runs at a time. A lair switches only when it
 * is within 1 km of the player and not at tier T yet; far lairs keep their tier until the player is close.
 */
const batches = Math.ceil(tieredLairs.length / LAIRS_PER_BATCH);
const scanBatchQuestSID = (tier: number, batch: number) => `${modName}_Scan_${tier}_${batch}`;
const lairQuestSID = (lairSID: string) => `${modName}_Lair_${lairSID}`;
const questToggledLairs = tieredLairs.filter((lair) => lair.questToggled);
export const LAIR_TIER_QUEST_SIDS = [
  modName,
  ...TIERS.flatMap((tier) => Array.from({ length: batches }, (_, b) => scanBatchQuestSID(tier, b))),
  ...questToggledLairs.map((lair) => lairQuestSID(lair.sid)),
];

const nearPlayer = (lair: (typeof tieredLairs)[number]) => ({
  ConditionType: "EQuestConditionType::DistanceToPoint",
  ConditionComparance: "EConditionComparance::LessOrEqual",
  TargetCharacter: SKIF_GUID,
  NumericValue: NEAR_PLAYER,
  TargetPoint: { X: lair.position.X, Y: lair.position.Y, Z: lair.position.Z },
});

/**
 * Scan_<T>_<b>: one If per lair of the batch (near the player, not at tier T yet, not held off by a
 * vanilla quest). True: every other instance of the lair off, the tier-T one on (the vanilla lair for
 * T = 0), its tier recorded. Then the next batch is restarted and this one ends.
 */
function scanBatchQuest(tier: number, b: number) {
  const quest = scanBatchQuestSID(tier, b);
  const start = technical(`${quest}_Start`, 0, [], quest, { LaunchOnQuestStart: true });
  // A scan whose tier is no longer current stops here. A scan of the old tier still running after a
  // tier change switched lairs back to it, and every switch leaves a squad: 0-1-2-0-1-2 while the level
  // climbed (2026-10-24).
  const current = ifVariables(
    `${quest}_Current`,
    [variableCondition(LAIR_TIER_GLOBAL_VARIABLE_SID, "EConditionComparance::Equal", tier)],
    [{ SID: start.SID }],
    quest,
  );
  const entry: Launcher = { SID: current.SID, Name: "True" };
  const nodes: QuestNodePrototype[] = [start, current, endNode(`${quest}_Stale`, quest, [{ SID: current.SID, Name: "False" }])];
  tieredLairs.slice(b * LAIRS_PER_BATCH, (b + 1) * LAIRS_PER_BATCH).forEach((lair) => {
    const conditions: any[] = [
      nearPlayer(lair),
      variableCondition(lairTierVariableSID(lair.sid), "EConditionComparance::NotEqual", tier),
    ];
    if (lair.questToggled) conditions.push(heldOffIs(lair.sid, 0));
    const check = ifVariables(`${quest}_${lair.sid}`, conditions, [entry], quest);
    const launcher = { SID: check.SID, Name: "True" };
    nodes.push(
      check,
      ...TIERS.filter((t) => t !== tier).map((t) => toggle(`${check.SID}_Off_${t}`, quest, lairCopySID(lair.sid, t), false, [launcher])),
      toggle(`${check.SID}_On`, quest, lairCopySID(lair.sid, tier), true, [launcher]),
      setVariable(`${check.SID}_Set`, quest, lairTierVariableSID(lair.sid), tier, [launcher]),
    );
    if (DEBUG) {
      nodes.push(
        node({ SID: `${check.SID}_Debug`, QuestSID: quest, NodeType: "EQuestNodeType::ShowFadeScreen", ScreenText: `LairTiers switch ${lair.sid.slice(0, 6)} ${lair.lairPrototypeSID} to ${tier}`, FadeTime: 3.0, ImagePath: "" }, [launcher]),
      );
    }
  });
  const next = technical(`${quest}_Next`, SECONDS_PER_BATCH, [entry], quest);
  nodes.push(next);
  if (b + 1 < batches) {
    const { nodes: restart, started } = restartQuest(`${quest}_Chain`, quest, scanBatchQuestSID(tier, b + 1), [{ SID: next.SID }]);
    nodes.push(...restart, endNode(`${quest}_End`, quest, [{ SID: started.SID }]));
  } else {
    nodes.push(endNode(`${quest}_End`, quest, [{ SID: next.SID }]));
  }
  return nodes;
}

/** LairTiers_Lair_<GUID>: a vanilla quest holds the lair off, so every tier copy goes off too. */
function lairQuest(lair: (typeof tieredLairs)[number]) {
  const quest = lairQuestSID(lair.sid);
  const entry = technical(`${quest}_Start`, 0, [], quest, { LaunchOnQuestStart: true });
  const done = technical(`${quest}_Done`, 1, [{ SID: entry.SID }], quest);
  return [
    entry,
    ...TIERS.slice(1).map((tier) =>
      toggle(`${quest}_Off_${tier}`, quest, lairCopySID(lair.sid, tier), false, [{ SID: entry.SID }], forceDespawnLairs.has(lair.sid)),
    ),
    done,
    endNode(`${quest}_End`, quest, [{ SID: done.SID }]),
  ];
}

/**
 * LairTiers: poll, pick the tier the level calls for, record it and restart that tier's scan. Also runs on
 * quest start and every world load (`LairTiers_Sync`). The pick is one If chain from the top tier down
 * (`Pick_<T>`: level >= start of T, else the next lower tier), so exactly one tier is picked per poll.
 * Per-tier range checks with `Less` picked every tier from 0 up to the right one at level 10: the scans
 * cycled 0-1-2-3 and the Militaries camp stacked 30+ NPCs (2026-10-24).
 */
function getTierDecisionNodes() {
  const nodes: QuestNodePrototype[] = [];
  // Kick starts the loop once; the loop nodes themselves only relaunch each other (as vanilla's do).
  const kick = technical(`${modName}_Kick`, 0, [], modName, { LaunchOnQuestStart: true });
  const pollA = technical(`${modName}_PollA`, POLL_SECONDS, [{ SID: kick.SID }, { SID: `${modName}_PollB` }]);
  const pollB = technical(`${modName}_PollB`, POLL_SECONDS, [{ SID: pollA.SID }]);
  const sync = technical(LAIR_TIER_SYNC, 0, [{ SID: pollB.SID }], modName, { LaunchOnQuestStart: true });
  nodes.push(kick, pollA, pollB, sync);
  let previous: Launcher = { SID: sync.SID };
  [...TIERS].reverse().forEach((tier) => {
    // Tier 0 has no check: it is what is left (DecoupledRanksLevel is 0 on a new game until the first XP).
    let picked: Launcher = previous;
    if (tier > 0) {
      const pick = ifVariables(
        `${modName}_Pick_${tier}`,
        [variableCondition(LEVEL_GLOBAL_VARIABLE_SID, "EConditionComparance::GreaterOrEqual", tierStartLevel(tier))],
        [previous],
      );
      nodes.push(pick);
      picked = { SID: pick.SID, Name: "True" };
      previous = { SID: pick.SID, Name: "False" };
    }
    const apply = setVariable(`${modName}_Apply_${tier}`, modName, LAIR_TIER_GLOBAL_VARIABLE_SID, tier, [picked]);
    nodes.push(apply, ...restartQuest(`${modName}_Run_${tier}`, modName, scanBatchQuestSID(tier, 0), [{ SID: apply.SID }]).nodes);
  });
  return nodes;
}

/**
 * Starts the LairTiers quest from rootgraph_Start, or from the world-load node on a save from before the
 * mod (the DecoupledRanks pattern), and re-syncs tiers on every world load.
 */
function getLaunchQuestNodes(rootgraphQuestSID: string) {
  const launchQuestSID = `${rootgraphQuestSID}_run_${modName}`;
  const onWorldLoad = node<QuestNodePrototypeIf>({
    SID: ON_WORLD_LOAD,
    QuestSID: rootgraphQuestSID,
    NodeType: "EQuestNodeType::If",
    Conditions: getConditions({
      ConditionType: "EQuestConditionType::Bridge",
      ConditionComparance: "EConditionComparance::Equal",
      LinkedNodePrototypeSID: launchQuestSID,
      CompletedNodeLauncherNames: { 0: "" },
    } as any),
  });
  const launchQuest = node<QuestNodePrototypeConsoleCommand>(
    {
      SID: launchQuestSID,
      QuestSID: rootgraphQuestSID,
      NodeType: "EQuestNodeType::ConsoleCommand",
      ConsoleCommand: `XStartQuestBySID ${modName}`,
    },
    [{ SID: "rootgraph_Start" }, { SID: ON_WORLD_LOAD, Name: "False" }],
  );
  const syncOnWorldLoad = startNode(`${modName}_SyncOnWorldLoad`, rootgraphQuestSID, LAIR_TIER_SYNC, [
    { SID: ON_WORLD_LOAD, Name: "True" },
  ]);
  return [onWorldLoad, launchQuest, syncOnWorldLoad];
}

/** The LairTiers quests (main + switch quests), plus the start and world-load nodes in rootgraph. */
export function getLairTierNodes(rootgraphQuestSID: string) {
  return [
    ...getLaunchQuestNodes(rootgraphQuestSID),
    ...getTierDecisionNodes(),
    ...TIERS.flatMap((tier) => Array.from({ length: batches }, (_, b) => scanBatchQuest(tier, b)).flat()),
    ...questToggledLairs.flatMap(lairQuest),
  ];
}

/**
 * Mirrors a vanilla ToggleLairActivity inside the vanilla quest. Off: hold the lair (flag 1), record it
 * as vanilla and restart its LairTiers_Lair_<GUID> quest, which switches every tier copy off. On: release
 * the hold and record it as vanilla (the quest just switched the vanilla lair on); the next scan near the
 * player brings it to the current tier.
 */
export function getLairToggleMirrorNodes(vanilla: QuestNodePrototypeToggleLairActivity) {
  const lair = lairsBySID[vanilla.TargetQuestGuid];
  if (!lair || lair.tierZeroOnly) return [];
  const prefix = `${vanilla.SID}_${modName}`;
  const quest = vanilla.QuestSID;
  const off = String(vanilla.Activate) === "false";
  const flag = setVariable(`${prefix}_${off ? "Hold" : "Release"}`, quest, lairHeldOffVariableSID(lair.sid), off ? 1 : 0, [
    { SID: vanilla.SID },
  ]);
  const vanillaTier = setVariable(`${prefix}_Vanilla`, quest, lairTierVariableSID(lair.sid), 0, [{ SID: vanilla.SID }]);
  if (!off) return [flag, vanillaTier];
  return [flag, vanillaTier, ...restartQuest(`${prefix}_Copies`, quest, lairQuestSID(lair.sid), [{ SID: flag.SID }]).nodes];
}
