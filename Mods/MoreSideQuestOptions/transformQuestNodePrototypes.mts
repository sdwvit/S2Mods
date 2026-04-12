import {
  type QuestNodePrototype,
  type QuestNodePrototypeCondition,
  type QuestNodePrototypeConditionsItemItem,
  type QuestNodePrototypeItemAdd,
  type QuestNodePrototypeRandom,
  type QuestNodePrototypeSetDialog,
  type QuestNodePrototypeSetJournal,
  type QuestNodePrototypeTechnical,
  Struct,
} from "s2cfgtojson";
import type { EQuestNodeType } from "s2cfgtojson";
import type { MetaContext } from "../../src/meta-type.mts";
import { getConditions, getLaunchers } from "../../src/struct-utils.mts";
import {
  vendors,
  getGlobalVarSID,
  getCancelDialogSID,
  getTurnInDialogSID,
  getReadyForTurnInVarSID,
  getReturnToAddJobVarSID,
  resetSetDialogQuestNodes,
  declineJobQuestNodes,
  type VendorConfig,
} from "./local.consts.mts";
import { readFileAndGetStructs } from "../../src/read-file-and-get-structs.mts";

const processedVendors = new Set<string>();
const playerQuestGuid = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const rsq04TerriconMeetLastPhrases = [
  "Terricon_Hub_drabadan_0_Meet_1_63431",
  "Terricon_Hub_drabadan_0_Meet_Terricon_Hub_drabadan_0_Meet_1_63431_2",
  "Terricon_Hub_drabadan_0_Meet_2_63433",
  "Terricon_Hub_drabadan_0_Meet_Terricon_Hub_drabadan_0_Meet_2_63433_2",
  "Terricon_Hub_drabadan_0_Meet_2_1_63465",
  "Terricon_Hub_drabadan_0_Meet_3_1_63483",
  "Terricon_Hub_drabadan_0_Meet_4_1_63491",
];

export async function transformQuestNodePrototypes(
  struct: QuestNodePrototype,
  context: MetaContext<QuestNodePrototype>,
) {
  const vendor = findVendor(context.filePath);
  if (!vendor) return;

  // Disable vanilla Random node (strip launchers)
  if (
    struct.NodeType === "EQuestNodeType::Random" &&
    struct.SID === `${vendor.questNodePrefix}_Random`
  ) {
    const fork = struct.fork() as QuestNodePrototypeRandom;
    fork.Launchers = new Struct() as any;
    return fork;
  }

  // Remove E08_MQ01 main quest gate from RSQ08 Duty kill quest so it appears in rotation
  if (struct.SID === "RSQ08_C00_ROSTOK_If_C09_NotAdded") {
    const forked = struct.fork();
    forked.Conditions = struct.Conditions.filter(([key]: [string, unknown]) => key !== "3");
    forked.Conditions.__internal__.bpatch = false;
    return forked;
  }

  // Disable vanilla SetDialog nodes to prevent competing dialogs with the ModSetDialog hub.
  // Reset SetDialogs get re-launched from ModSetDialog so their downstream outputs still fire.
  // Main and decline-job SetDialogs are fully stripped.
  if (
    struct.SID === vendor.setDialogSID ||
    resetSetDialogQuestNodes.has(struct.SID) ||
    declineJobQuestNodes.has(struct.SID)
  ) {
    const fork = struct.fork() as QuestNodePrototypeSetDialog;
    const modSetDialogSID = `${vendor.questNodePrefix}_ModSetDialog_MoreSideQuestOptions`;

    if (resetSetDialogQuestNodes.has(struct.SID)) {
      // Reset SetDialog: rewire to launch from ModSetDialog
      fork.Launchers = getLaunchers([{ SID: modSetDialogSID }]);
    } else {
      fork.Launchers = new Struct() as any;
    }

    // Generate all mod nodes once per vendor (piggyback on main SetDialog processing)
    if (struct.SID === vendor.setDialogSID && !processedVendors.has(vendor.questSID)) {
      processedVendors.add(vendor.questSID);
      const modNodes = await generateAllModNodes(
        vendor,
        struct as QuestNodePrototypeSetDialog,
        context,
      );
      return [fork, ...modNodes];
    }
    return fork;
  }
}

function findVendor(filePath: string): VendorConfig | undefined {
  for (const v of vendors) {
    if (filePath.endsWith(`/${v.questNodePrefix}.cfg`)) return v;
  }
}

// --- Parent quest node generation ---

async function generateAllModNodes(
  vendor: VendorConfig,
  vanillaSetDialog: QuestNodePrototypeSetDialog,
  context: MetaContext<QuestNodePrototype>,
): Promise<Struct[]> {
  const nodes: Struct[] = [];

  // Extract confirm phrase SIDs per sub-quest from Container Pin_0 conditions
  const confirmPhrases = extractConfirmPhrases(vendor, context);

  // Boot node: fires on quest start to trigger ModSetDialog
  const bootSID = `${vendor.questNodePrefix}_Boot_MoreSideQuestOptions`;
  nodes.push(
    new Struct({
      __internal__: { rawName: bootSID, isRoot: true },
      SID: bootSID,
      QuestSID: vendor.questSID,
      NodeType: "EQuestNodeType::Technical" satisfies EQuestNodeType,
      StartDelay: 0,
      LaunchOnQuestStart: true,
    }),
  );

  // ConsoleCommand node: launches from _Start, triggers Boot via XStartQuestNodeBySID
  const bootCmdSID = `${vendor.questNodePrefix}_BootCmd_MoreSideQuestOptions`;
  nodes.push(
    new Struct({
      __internal__: { rawName: bootCmdSID, isRoot: true },
      SID: bootCmdSID,
      QuestSID: vendor.questNodePrefix,
      NodeType: "EQuestNodeType::ConsoleCommand" satisfies EQuestNodeType,
      Repeatable: true,
      Launchers: getLaunchers([{ SID: `${vendor.questNodePrefix}_Start` }]),
      ConsoleCommand: `XStartQuestNodeBySID ${bootSID}`,
    }),
  );

  // Generate ModSetDialog (our replacement for vanilla SetDialog)
  const modSetDialogSID = `${vendor.questNodePrefix}_ModSetDialog_MoreSideQuestOptions`;
  const modSetDialog = generateModSetDialog(
    vendor,
    vanillaSetDialog,
    modSetDialogSID,
    confirmPhrases,
    bootSID,
    context,
  );
  nodes.push(modSetDialog);

  // Generate per-sub-quest ConsoleCommand chains
  for (const subQuest of vendor.subQuests) {
    const confirmPhrase = confirmPhrases.get(subQuest);
    if (!confirmPhrase) continue;

    const cancelPhrase = getCancelDialogSID(vendor.dialogChain, subQuest);
    const newQuestSID = `MoreSideQuestOptions_${subQuest}`;

    nodes.push(
      ...generateActionChain(
        vendor,
        subQuest,
        modSetDialogSID,
        confirmPhrase,
        newQuestSID,
        "Start",
      ),
    );
    nodes.push(
      ...generateActionChain(
        vendor,
        subQuest,
        modSetDialogSID,
        cancelPhrase,
        newQuestSID,
        "Cancel",
      ),
    );
  }

  // Generate per-sub-quest TurnIn ConsoleCommand chains
  for (const subQuest of vendor.subQuests) {
    const turnInPhrase = getTurnInDialogSID(vendor.dialogChain, subQuest);
    const newQuestSID = `MoreSideQuestOptions_${subQuest}`;
    const prefix = `${vendor.questNodePrefix}_TurnIn_${subQuest}_MoreSideQuestOptions`;
    const cmdSID = `${prefix}_ConsoleCommand`;
    nodes.push(
      new Struct({
        __internal__: { rawName: cmdSID, isRoot: true },
        SID: cmdSID,
        QuestSID: vendor.questSID,
        NodeType: "EQuestNodeType::ConsoleCommand" satisfies EQuestNodeType,
        Repeatable: true,
        Launchers: getLaunchers([{ SID: modSetDialogSID, Name: turnInPhrase }]),
        ConsoleCommand: `XStartQuestNodeBySID ${newQuestSID}_Reward`,
      }),
    );
  }

  // Generate independent quest nodes for each sub-quest
  for (const subQuest of vendor.subQuests) {
    const questNodes = await generateIndependentQuest(vendor, subQuest);
    nodes.push(...questNodes);
  }

  return nodes;
}

function extractConfirmPhrases(
  vendor: VendorConfig,
  context: MetaContext<QuestNodePrototype>,
): Map<string, string> {
  const result = new Map<string, string>();
  for (const subQuest of vendor.subQuests) {
    // Find the Container node for this sub-quest
    const container = context.array.find(
      (s) =>
        s.NodeType === "EQuestNodeType::Container" &&
        (s as any).ContaineredQuestPrototypeSID === subQuest,
    );
    if (!container?.Launchers) continue;

    // The Container's launcher has a connection to a Pin_0 condition node
    // Find the Pin_0 SID from the Container's launcher connections
    for (const [, launcher] of container.Launchers.entries()) {
      if (launcher.Excluding || !(launcher.Connections instanceof Struct)) continue;
      for (const [, conn] of launcher.Connections.entries()) {
        const pinNode = context.structsById[conn.SID] as QuestNodePrototypeCondition | undefined;
        if (!pinNode?.Conditions || pinNode.NodeType !== "EQuestNodeType::Condition") continue;
        const condGroup = pinNode.Conditions["0"];
        const cond = condGroup?.["0"] as QuestNodePrototypeConditionsItemItem | undefined;
        if (
          cond?.ConditionType === "EQuestConditionType::Bridge" &&
          cond.LinkedNodePrototypeSID === vendor.setDialogSID
        ) {
          const phraseSID = cond.CompletedNodeLauncherNames?.["0"];
          if (phraseSID) result.set(subQuest, String(phraseSID));
        }
      }
    }
  }
  return result;
}

function generateModSetDialog(
  vendor: VendorConfig,
  vanilla: QuestNodePrototypeSetDialog,
  modSID: string,
  confirmPhrases: Map<string, string>,
  bootSID: string,
  context: MetaContext<QuestNodePrototype>,
): Struct {
  // Build LastPhrases: vanilla confirms + our cancel confirms
  const lastPhrases = new Struct();
  const outputPins = new Struct();
  let idx = 0;

  // Add confirm phrases (from vanilla)
  for (const [subQuest, phrase] of confirmPhrases) {
    const pinName = `Confirm_${subQuest}`;
    outputPins.addNode(pinName);
    lastPhrases.addNode(new Struct({ FinishNode: true, LastPhraseSID: phrase }));
    idx++;
  }

  // Add cancel confirm phrases (from our dialog prototypes)
  for (const subQuest of vendor.subQuests) {
    const cancelPhrase = getCancelDialogSID(vendor.dialogChain, subQuest);
    const pinName = `Cancel_${subQuest}`;
    outputPins.addNode(pinName);
    lastPhrases.addNode(new Struct({ FinishNode: true, LastPhraseSID: cancelPhrase }));
    idx++;
  }

  // Add turn-in confirm phrases (from our dialog prototypes)
  for (const subQuest of vendor.subQuests) {
    const turnInPhrase = getTurnInDialogSID(vendor.dialogChain, subQuest);
    const pinName = `TurnIn_${subQuest}`;
    outputPins.addNode(pinName);
    lastPhrases.addNode(new Struct({ FinishNode: true, LastPhraseSID: turnInPhrase }));
    idx++;
  }

  // Add vanilla non-confirm phrases (cancel_job_cancel → self-loop, postpone → self-loop, etc.)
  for (const [, entry] of vanilla.LastPhrases.entries()) {
    if (!entry.FinishNode) {
      const pinName = `Relaunch_${idx}`;
      outputPins.addNode(pinName);
      lastPhrases.addNode(new Struct({ FinishNode: false, LastPhraseSID: entry.LastPhraseSID }));
      idx++;
    }
  }

  // Add Interrupt pin
  outputPins.addNode("Interrupt");

  // Build launchers: fire from boot node OR parent quest Start OR vanilla condition nodes + self-loops
  // Each trigger must be a separate launcher entry (OR logic), not combined (AND logic)
  const startSID = `${vendor.questNodePrefix}_Start`;
  const initialLaunchers: any[] = [{ SID: bootSID }, { SID: startSID }];
  // Add vanilla condition node connections as separate entries
  for (const [, launcher] of vanilla.Launchers.entries()) {
    if (launcher.Excluding) continue;
    if (!(launcher.Connections instanceof Struct)) continue;
    let isSelfRef = false;
    for (const [, conn] of launcher.Connections.entries()) {
      if (conn.SID === vanilla.SID) {
        isSelfRef = true;
        break;
      }
    }
    if (isSelfRef) continue;
    for (const [, conn] of launcher.Connections.entries()) {
      initialLaunchers.push({ SID: conn.SID, Name: conn.Name || undefined });
    }
    break;
  }

  // Self-loops for non-finish phrases
  const selfLoopLaunchers: any[] = [];
  for (const [, entry] of vanilla.LastPhrases.entries()) {
    if (!entry.FinishNode) {
      selfLoopLaunchers.push({ SID: modSID, Name: entry.LastPhraseSID });
    }
  }

  // Also self-loop after each confirm (so dialog can be used again)
  for (const [subQuest, phrase] of confirmPhrases) {
    selfLoopLaunchers.push({ SID: modSID, Name: phrase });
  }
  for (const subQuest of vendor.subQuests) {
    const cancelPhrase = getCancelDialogSID(vendor.dialogChain, subQuest);
    selfLoopLaunchers.push({ SID: modSID, Name: cancelPhrase });
  }
  for (const subQuest of vendor.subQuests) {
    const turnInPhrase = getTurnInDialogSID(vendor.dialogChain, subQuest);
    selfLoopLaunchers.push({ SID: modSID, Name: turnInPhrase });
  }
  if (vendor.questSID === "RSQ04") {
    for (const phrase of rsq04TerriconMeetLastPhrases) {
      selfLoopLaunchers.push({ SID: modSID, Name: phrase });
    }
  }

  const launchers = getLaunchers([...initialLaunchers, ...selfLoopLaunchers]);

  // Incorporate non-self-loop, non-excluding launchers from disabled reset and decline-job
  // SetDialog nodes so the ModSetDialog fires in all the same situations vanilla dialogs would.
  // We intentionally skip excluding launchers from ALL vanilla SetDialogs — they were designed
  // for the vanilla quest flow (timers, quest-stage events, quest init) and conflict with
  // the mod's own flow control (Hub menu + global variable gating).
  for (const otherSID of [...resetSetDialogQuestNodes, ...declineJobQuestNodes]) {
    const otherNode = context.structsById[otherSID] as QuestNodePrototypeSetDialog | undefined;
    if (!otherNode?.Launchers || !(otherNode.Launchers instanceof Struct)) continue;
    for (const [, launcher] of otherNode.Launchers.entries()) {
      if (launcher.Excluding) continue;
      if (!(launcher.Connections instanceof Struct)) continue;
      // Skip self-loops (connections back to the disabled node itself)
      let isSelfRef = false;
      for (const [, conn] of launcher.Connections.entries()) {
        if (conn.SID === otherSID) { isSelfRef = true; break; }
      }
      if (isSelfRef) continue;
      // Add each connection as a separate OR launcher entry
      for (const [, conn] of launcher.Connections.entries()) {
        const added = getLaunchers([{ SID: conn.SID, Name: conn.Name || undefined }]);
        for (const [, entry] of added.entries()) {
          launchers.addNode(entry);
        }
      }
    }
  }

  const node = new Struct({
    __internal__: { rawName: modSID, isRoot: true },
    SID: modSID,
    NodePrototypeVersion: vanilla.NodePrototypeVersion,
    Repeatable: true,
    QuestSID: vendor.questSID,
    NodeType: "EQuestNodeType::SetDialog" satisfies EQuestNodeType,
    OutputPinNames: outputPins,
    Launchers: launchers,
    LastPhrases: lastPhrases,
    DialogChainPrototypeSID: vanilla.DialogChainPrototypeSID,
    DialogMembers: vanilla.DialogMembers.clone(),
    TalkThroughRadio: vanilla.TalkThroughRadio.clone(),
    DialogObjectLocation: vanilla.DialogObjectLocation.clone(),
    NPCToStartDialog: vanilla.NPCToStartDialog,
    StartForcedDialog: false,
    WaitAllDialogEndingsToFinish: false,
    IsComment: false,
    OverrideDialogTopic: "EOverrideDialogTopic::None",
    CanExitAnytime: false,
    ContinueThroughRadio: false,
    CallPlayer: false,
    SeekPlayer: false,
    CallPlayerRadius: 1000.0,
  });

  return node;
}

function generateActionChain(
  vendor: VendorConfig,
  subQuest: string,
  modSetDialogSID: string,
  phrase: string,
  newQuestSID: string,
  action: "Start" | "Cancel",
): Struct[] {
  const prefix = `${vendor.questNodePrefix}_${action}_${subQuest}_MoreSideQuestOptions`;
  const globalVarSID = getGlobalVarSID(subQuest);
  const readyForTurnInVarSID = getReadyForTurnInVarSID(subQuest);
  const launcherRef = { SID: modSetDialogSID, Name: phrase };
  const returnToAddJobVarSID = getReturnToAddJobVarSID(vendor.questSID);

  const cmdSID = `${prefix}_ConsoleCommand`;
  const cmdNode = new Struct({
    __internal__: { rawName: cmdSID, isRoot: true },
    SID: cmdSID,
    QuestSID: vendor.questSID,
    NodeType: "EQuestNodeType::ConsoleCommand" satisfies EQuestNodeType,
    Repeatable: true,
    Launchers: getLaunchers([launcherRef]),
    ConsoleCommand: `XStartQuestNodeBySID ${newQuestSID}_${action}`,
  });

  const setVarSID = `${prefix}_SetVar`;
  const setVarNode = new Struct({
    __internal__: { rawName: setVarSID, isRoot: true },
    SID: setVarSID,
    QuestSID: vendor.questSID,
    NodeType: "EQuestNodeType::SetGlobalVariable" satisfies EQuestNodeType,
    Repeatable: true,
    Launchers: getLaunchers([launcherRef]),
    GlobalVariablePrototypeSID: globalVarSID,
    ChangeValueMode: "EChangeValueMode::Set",
    VariableValue: action === "Start",
  });

  if (action !== "Start") {
    return [cmdNode, setVarNode];
  }

  const clearReadyOnStartSID = `${prefix}_ClearReadyForTurnIn`;
  const clearReadyOnStartNode = new Struct({
    __internal__: { rawName: clearReadyOnStartSID, isRoot: true },
    SID: clearReadyOnStartSID,
    QuestSID: vendor.questSID,
    NodeType: "EQuestNodeType::SetGlobalVariable" satisfies EQuestNodeType,
    Repeatable: true,
    Launchers: getLaunchers([launcherRef]),
    GlobalVariablePrototypeSID: readyForTurnInVarSID,
    ChangeValueMode: "EChangeValueMode::Set",
    VariableValue: false,
  });

  const setReturnToAddJobSID = `${prefix}_SetReturnToAddJob`;
  const setReturnToAddJobNode = new Struct({
    __internal__: { rawName: setReturnToAddJobSID, isRoot: true },
    SID: setReturnToAddJobSID,
    QuestSID: vendor.questSID,
    NodeType: "EQuestNodeType::SetGlobalVariable" satisfies EQuestNodeType,
    Repeatable: true,
    Launchers: getLaunchers([launcherRef]),
    GlobalVariablePrototypeSID: returnToAddJobVarSID,
    ChangeValueMode: "EChangeValueMode::Set",
    VariableValue: true,
  });

  return [cmdNode, setVarNode, clearReadyOnStartNode, setReturnToAddJobNode];
}

// --- Independent quest generation ---

/**
 * Clones a vanilla sub-quest into a standalone independent quest, applying several
 * critical transformations to prevent interference with the parent quest and other mods:
 *
 * - **Start node**: LaunchOnQuestStart disabled — triggered externally via XStartQuestNodeBySID.
 * - **RostokMutantRSQuestFix (RSQ08_C01_K_M only)**: Applies the same PinWeights and Conditions
 *   fixes that RostokMutantRSQuestFix bpatches onto vanilla, since we read unpatched data.
 * - **PreviousTask globals**: Skipped entirely — these SetGlobalVariable nodes write to parent-quest
 *   globals (e.g. RSQ08_PreviousTask) that drive the parent's condition nodes. Our independent
 *   quests use their own global vars instead.
 * - **Quest-level SetJournal**: Converted to Technical pass-throughs — all independent quests share
 *   the parent journal SID, so firing Quest-level journal actions would cancel/complete for everyone.
 * - **SetDialog nodes**: Converted to Technical pass-throughs — the parent quest's ModSetDialog hub
 *   handles all NPC dialog. A cloned SetDialog would compete for the same NPC and block the hub
 *   entirely (no dialog options visible, e.g. RSQ08_C04_B_B).
 * - **ItemAdd nodes**: Preceded by injected Spawn + delay nodes to force-spawn item containers,
 *   working around StashClueRework setting SpawnOnStart=false.
 * - **End node**: Rewired through a SetInactive node to clear the quest's global var before
 *   ExcludeAllNodesInContainer kills the container.
 */
async function generateIndependentQuest(vendor: VendorConfig, subQuest: string): Promise<Struct[]> {
  const newQuestSID = `MoreSideQuestOptions_${subQuest}`;
  const cancelTechnicalSID = `${newQuestSID}_Cancel`;

  // Read vanilla sub-quest .cfg
  const vanillaNodes = await readFileAndGetStructs<QuestNodePrototype>(
    `/QuestNodePrototypes/${subQuest}.cfg`,
  );

  // Build complete SID map BEFORE cloning (including special cases)
  const sidMap = new Map<string, string>();
  for (const vNode of vanillaNodes) {
    sidMap.set(vNode.SID, `${newQuestSID}_${vNode.SID.replace(`${subQuest}_`, "")}`);
  }
  // Override Start/End to canonical names
  sidMap.set(`${subQuest}_Start`, `${newQuestSID}_Start`);
  sidMap.set(`${subQuest}_End`, `${newQuestSID}_End`);

  // Map cross-quest cancel reference to our own cancel node
  // Vanilla sub-quests use Bridge on `{parentQuest}_cancelQuest` for cancel detection
  const vanillaCancelSID = `${vendor.questSID}_cancelQuest`;
  sidMap.set(vanillaCancelSID, cancelTechnicalSID);

  // Track vanilla SetDialog SIDs — their cloned nodes become Technical pass-throughs,
  // so downstream launcher connections must drop their pin Name (Technical has no named pins).
  const vanillaSetDialogSIDs = new Set(
    vanillaNodes.filter((n) => n.NodeType === "EQuestNodeType::SetDialog").map((n) => n.SID),
  );

  const journalCancelNodes: { questSID: string; stageSID?: string; action: string }[] = [];

  // Track the vanilla node that starts the parent quest's finish stage (e.g., RSQ08_Finish).
  // We use this to locate the matching finish SetDialog that vanilla surfaces when the player
  // is actually ready to turn the job in.
  let objectivesCompleteVanillaSID: string | undefined;

  const nodes: Struct[] = [];

  for (const vNode of vanillaNodes) {
    const newSID = sidMap.get(vNode.SID)!;
    const cloned = vNode.clone();

    // Update SID and mark as new root struct
    cloned.SID = newSID;
    cloned.__internal__.rawName = newSID;
    cloned.__internal__.isRoot = true;
    cloned.__internal__.bpatch = undefined;
    cloned.QuestSID = newQuestSID;

    // Special: Start node should not LaunchOnQuestStart (triggered externally)
    if (vNode.SID === `${subQuest}_Start`) {
      (cloned as QuestNodePrototypeTechnical).LaunchOnQuestStart = false;
    }

    // Apply RostokMutantRSQuestFix: fix RSQ08 bar mutant quest auto-finishing
    if (vNode.SID === "RSQ08_C01_K_M_Random_3") {
      (cloned as QuestNodePrototypeRandom).PinWeights = Object.assign(
        (cloned as QuestNodePrototypeRandom).PinWeights.fork(),
        { 0: 0.5 },
      );
    }
    // Vanilla bug STL-4939: this condition node has no conditions, so it passes immediately
    // and auto-finishes the quest. Fix: require the finish dialog node to be completed first.
    if (vNode.SID === "RSQ08_C01_K_M_Technical_STL4939_Pin_0") {
      const finishDialogSID = sidMap.get(
        "RSQ08_C01_K_M_SetDialog_RSQ08_Dialog_Barmen_C01_Finish",
      ) ?? "RSQ08_C01_K_M_SetDialog_RSQ08_Dialog_Barmen_C01_Finish";
      (cloned as QuestNodePrototypeCondition).Conditions = getConditions([
        {
          ConditionType: "EQuestConditionType::NodeState",
          ConditionComparance: "EConditionComparance::Equal",
          TargetNode: finishDialogSID,
          NodeState: "EQuestNodeState::Finished",
        },
      ]);
    }

    // Skip SetGlobalVariable nodes that modify vanilla parent-quest globals
    // (e.g. RSQ08_PreviousTask) — changing these disrupts the parent quest's condition nodes
    // Nothing references this node downstream, so omitting entirely is safe.
    if (vNode.SID.includes("PreviousTask")) {
      continue;
    }

    // Update Launchers: remap SIDs
    if (cloned.Launchers instanceof Struct) {
      for (const [, launcher] of cloned.Launchers.entries()) {
        if (launcher.Connections instanceof Struct) {
          for (const [, conn] of launcher.Connections.entries()) {
            // Clear named pin refs to SetDialog nodes (now Technical, no named outputs)
            if (vanillaSetDialogSIDs.has(conn.SID)) conn.Name = "";
            const mapped = sidMap.get(conn.SID);
            if (mapped) conn.SID = mapped;
          }
        }
      }
    }

    // Update condition node references: remap any linked SIDs in conditions
    const condNode = cloned as QuestNodePrototypeCondition;
    if (condNode.Conditions instanceof Struct) {
      for (const [, condGroup] of condNode.Conditions.entries()) {
        if (condGroup instanceof Struct) {
          for (const [, cond] of (condGroup as Struct).entries() as [
            string,
            QuestNodePrototypeConditionsItemItem,
          ][]) {
            if (cond.LinkedNodePrototypeSID) {
              const mapped = sidMap.get(cond.LinkedNodePrototypeSID);
              if (mapped) cond.LinkedNodePrototypeSID = mapped;
            }
            if (cond.TargetNode) {
              const mapped = sidMap.get(cond.TargetNode);
              if (mapped) cond.TargetNode = mapped;
            }
          }
        }
      }
    }

    // Track journal entries for cancel, and neutralize Quest-level journal nodes
    // to prevent cross-quest cancellation (all independent quests share the parent journal SID)
    if (vNode.NodeType === "EQuestNodeType::SetJournal") {
      const j = vNode as QuestNodePrototypeSetJournal;
      if (j.JournalAction === "EJournalAction::Start") {
        journalCancelNodes.push({
          questSID: j.JournalQuestSID,
          stageSID: j.JournalQuestStageSID,
          action: j.JournalEntity === "EJournalEntity::Quest" ? "quest" : "stage",
        });
        // Track the node that starts the parent quest's finish stage — this signals
        // objectives are complete and the player should return to the vendor.
        if (
          j.JournalEntity === "EJournalEntity::QuestStage" &&
          j.JournalQuestStageSID === `${vendor.questSID}_Finish`
        ) {
          objectivesCompleteVanillaSID = vNode.SID;
        }
      }
      // Replace Quest-level Start/Finish with Technical pass-throughs
      // so the node chain stays intact but no shared journal action fires
      if (j.JournalEntity === "EJournalEntity::Quest") {
        (cloned as any).NodeType = "EQuestNodeType::Technical";
        (cloned as QuestNodePrototypeTechnical).StartDelay = 0;
        // Remove journal-specific fields
        delete (cloned as any).JournalEntity;
        delete (cloned as any).JournalAction;
        delete (cloned as any).JournalQuestSID;
        delete (cloned as any).JournalQuestDescriptionIndex;
        delete (cloned as any).SetQuestActive;
        nodes.push(cloned);
        continue;
      }
    }

    // Convert cloned SetDialog nodes to Technical pass-throughs.
    // The parent quest's ModSetDialog hub handles all NPC dialog; a cloned SetDialog
    // would compete for the same NPC and block the hub (no dialog options visible).
    if (vNode.NodeType === "EQuestNodeType::SetDialog") {
      (cloned as any).NodeType = "EQuestNodeType::Technical";
      (cloned as QuestNodePrototypeTechnical).StartDelay = 0;
      delete (cloned as any).OutputPinNames;
      delete (cloned as any).LastPhrases;
      delete (cloned as any).DialogChainPrototypeSID;
      delete (cloned as any).DialogMembers;
      delete (cloned as any).TalkThroughRadio;
      delete (cloned as any).DialogObjectLocation;
      delete (cloned as any).NPCToStartDialog;
      delete (cloned as any).StartForcedDialog;
      delete (cloned as any).WaitAllDialogEndingsToFinish;
      delete (cloned as any).IsComment;
      delete (cloned as any).OverrideDialogTopic;
      delete (cloned as any).CanExitAnytime;
      delete (cloned as any).ContinueThroughRadio;
      delete (cloned as any).CallPlayer;
      delete (cloned as any).SeekPlayer;
      delete (cloned as any).CallPlayerRadius;
      nodes.push(cloned);
      continue;
    }

    nodes.push(cloned);
  }

  // Inject Spawn + delay before each ItemAdd to force-spawn containers
  // (StashClueRework sets SpawnOnStart=false on ItemContainers, so we must spawn them explicitly)
  const itemAddNodes = nodes.filter(
    (n) => (n as QuestNodePrototype).NodeType === "EQuestNodeType::ItemAdd",
  );
  for (const itemAdd of itemAddNodes) {
    const ia = itemAdd as QuestNodePrototypeItemAdd;
    const spawnSID = `${ia.SID}_ForceSpawn`;
    const delaySID = `${ia.SID}_SpawnDelay`;

    // Extract launcher connections from ItemAdd to reuse for Spawn and delay
    const launcherRefs: { SID: string; Name?: string }[] = [];
    if (ia.Launchers instanceof Struct) {
      for (const [, launcher] of ia.Launchers.entries()) {
        if (!launcher.Excluding && launcher.Connections instanceof Struct) {
          for (const [, conn] of launcher.Connections.entries()) {
            launcherRefs.push({ SID: conn.SID, Name: conn.Name || undefined });
          }
        }
      }
    }

    nodes.push(
      new Struct({
        __internal__: { rawName: spawnSID, isRoot: true },
        SID: spawnSID,
        QuestSID: newQuestSID,
        NodeType: "EQuestNodeType::Spawn" satisfies EQuestNodeType,
        Launchers: getLaunchers(launcherRefs),
        TargetQuestGuid: ia.TargetQuestGuid,
        IgnoreDamageType: "EIgnoreDamageType::None",
        SpawnHidden: false,
        SpawnNodeExcludeType: "ESpawnNodeExcludeType::SeamlessDespawn",
      }),
    );

    nodes.push(
      new Struct({
        __internal__: { rawName: delaySID, isRoot: true },
        SID: delaySID,
        QuestSID: newQuestSID,
        NodeType: "EQuestNodeType::Technical" satisfies EQuestNodeType,
        StartDelay: 1.0,
        Launchers: getLaunchers(launcherRefs),
      }),
    );

    // Rewire ItemAdd to launch from delay instead of original trigger
    ia.Launchers = getLaunchers([{ SID: delaySID }]);
  }

  // --- Turn-in reward gating ---
  // The vanilla finish SetDialog (now Technical) fires instantly, causing rewards to trigger
  // on quest start instead of on turn-in. Fix: add a Reward entry point triggered externally
  // by the parent quest's ModSetDialog turn-in flow, and rewire all downstream nodes from
  // the finish SetDialog Technical to fire from the Reward node instead.
  const rewardSetDialogSID =
    vanillaNodes.find(
      (node) =>
        node.NodeType === "EQuestNodeType::SetDialog" &&
        objectivesCompleteVanillaSID &&
        node.Launchers instanceof Struct &&
        node.Launchers.entries().some(([, launcher]) =>
          !launcher.Excluding &&
          launcher.Connections instanceof Struct &&
          launcher.Connections.entries().some(([, conn]) => conn.SID === objectivesCompleteVanillaSID),
        ),
    )?.SID ??
    vanillaNodes.find(
      (node) =>
        node.NodeType === "EQuestNodeType::SetDialog" &&
        (node as QuestNodePrototypeSetDialog).DialogChainPrototypeSID?.includes("_Finish"),
    )?.SID ??
    [...vanillaSetDialogSIDs][0];

  if (rewardSetDialogSID) {
    const vanillaSetDialogSID = rewardSetDialogSID;
    const mappedSetDialogSID = sidMap.get(vanillaSetDialogSID)!;

    // Reward node: entry point triggered externally via XStartQuestNodeBySID
    const rewardSID = `${newQuestSID}_Reward`;
    nodes.push(
      new Struct({
        __internal__: { rawName: rewardSID, isRoot: true },
        SID: rewardSID,
        QuestSID: newQuestSID,
        NodeType: "EQuestNodeType::Technical" satisfies EQuestNodeType,
        StartDelay: 0,
        LaunchOnQuestStart: false,
      }),
    );

    // SetReadyForTurnIn: mirror vanilla by setting the flag when the finish SetDialog itself
    // becomes reachable, not at an earlier "return to vendor" journal transition.
    const setReadyTriggerSID = mappedSetDialogSID;
    const setReadySID = `${newQuestSID}_SetReadyForTurnIn`;
    nodes.push(
      new Struct({
        __internal__: { rawName: setReadySID, isRoot: true },
        SID: setReadySID,
        QuestSID: newQuestSID,
        NodeType: "EQuestNodeType::SetGlobalVariable" satisfies EQuestNodeType,
        Launchers: getLaunchers([{ SID: setReadyTriggerSID }]),
        GlobalVariablePrototypeSID: getReadyForTurnInVarSID(subQuest),
        ChangeValueMode: "EChangeValueMode::Set",
        VariableValue: true,
      }),
    );

    // ClearReadyForTurnIn: fires from Reward to reset the flag
    const clearReadySID = `${newQuestSID}_ClearReadyForTurnIn`;
    nodes.push(
      new Struct({
        __internal__: { rawName: clearReadySID, isRoot: true },
        SID: clearReadySID,
        QuestSID: newQuestSID,
        NodeType: "EQuestNodeType::SetGlobalVariable" satisfies EQuestNodeType,
        Launchers: getLaunchers([{ SID: rewardSID }]),
        GlobalVariablePrototypeSID: getReadyForTurnInVarSID(subQuest),
        ChangeValueMode: "EChangeValueMode::Set",
        VariableValue: false,
      }),
    );

    // Rewire all non-excluding launcher connections from SetDialog Technical → Reward node
    for (const node of nodes) {
      const proto = node as QuestNodePrototype;
      if (proto.SID === setReadySID) continue; // SetReadyForTurnIn must stay on SetDialog
      if (proto.Launchers instanceof Struct) {
        for (const [, launcher] of proto.Launchers.entries()) {
          if (launcher.Excluding) continue;
          if (!(launcher.Connections instanceof Struct)) continue;
          for (const [, conn] of launcher.Connections.entries()) {
            if (conn.SID === mappedSetDialogSID) {
              conn.SID = rewardSID;
            }
          }
        }
      }
      // Also rewire condition refs referencing the SetDialog
      const condNode = proto as QuestNodePrototypeCondition;
      if (condNode.Conditions instanceof Struct) {
        for (const [, condGroup] of condNode.Conditions.entries()) {
          if (condGroup instanceof Struct) {
            for (const [, cond] of (condGroup as Struct).entries() as [
              string,
              QuestNodePrototypeConditionsItemItem,
            ][]) {
              if (cond.LinkedNodePrototypeSID === mappedSetDialogSID) {
                cond.LinkedNodePrototypeSID = rewardSID;
              }
              if (cond.TargetNode === mappedSetDialogSID) {
                cond.TargetNode = rewardSID;
              }
            }
          }
        }
      }
    }

    const deliveryRewardGate = getDeliveryRewardGate(nodes, rewardSID);
    const rewardResultSID = deliveryRewardGate ? `${newQuestSID}_RewardGranted` : rewardSID;

    if (deliveryRewardGate) {
      const validationSID = `${newQuestSID}_RewardValidated`;
      const rewardGrantedSID = rewardResultSID;

      const validationConditions = getConditions(
        deliveryRewardGate.requiredItems.map((requiredItem) => ({
          ConditionType: "EQuestConditionType::ItemInInventory",
          ConditionComparance: "EConditionComparance::GreaterOrEqual",
          TargetCharacter: playerQuestGuid,
          ItemPrototypeSID: {
            VariableType: "EGlobalVariableType::String",
            VariableValue: requiredItem.itemSID,
          },
          ItemsCount: {
            VariableType: "EGlobalVariableType::Int",
            VariableValue: requiredItem.itemsCount,
          },
          WithEquipped: false,
          WithInventory: true,
        })),
      );
      validationConditions.ConditionCheckType = "EConditionCheckType::Or";

      nodes.push(
        new Struct({
          __internal__: { rawName: validationSID, isRoot: true },
          SID: validationSID,
          QuestSID: newQuestSID,
          NodeType: "EQuestNodeType::Condition" satisfies EQuestNodeType,
          Launchers: getLaunchers([{ SID: rewardSID }]),
          Conditions: validationConditions,
        }),
      );

      nodes.push(
        new Struct({
          __internal__: { rawName: rewardGrantedSID, isRoot: true },
          SID: rewardGrantedSID,
          QuestSID: newQuestSID,
          NodeType: "EQuestNodeType::Technical" satisfies EQuestNodeType,
          StartDelay: 0,
          LaunchOnQuestStart: false,
          Launchers: getLaunchers(
            deliveryRewardGate.itemRemoveSIDs.map((itemRemoveSID) => ({ SID: itemRemoveSID })),
          ),
        }),
      );

      for (const node of nodes) {
        const proto = node as QuestNodePrototype;
        if (proto.SID === validationSID || proto.SID === rewardGrantedSID) continue;

        if (deliveryRewardGate.gateNodeSIDs.has(proto.SID)) {
          if (proto.Launchers instanceof Struct) {
            for (const [, launcher] of proto.Launchers.entries()) {
              if (launcher.Excluding || !(launcher.Connections instanceof Struct)) continue;

              const hasAlternateRewardPath = launcher.Connections
                .entries()
                .some(([, conn]) => conn.SID !== rewardSID);
              const nextConnections = new Struct();

              for (const [, conn] of launcher.Connections.entries()) {
                if (conn.SID === rewardSID) {
                  if (
                    hasAlternateRewardPath &&
                    deliveryRewardGate.itemRemoveSIDs.includes(proto.SID)
                  ) {
                    continue;
                  }
                  const forkedConn = conn.clone();
                  forkedConn.SID = validationSID;
                  nextConnections.addNode(forkedConn);
                  continue;
                }

                nextConnections.addNode(conn.clone());
              }

              launcher.Connections = nextConnections as any;
            }
          }
          continue;
        }

        if (proto.Launchers instanceof Struct) {
          for (const [, launcher] of proto.Launchers.entries()) {
            if (launcher.Excluding || !(launcher.Connections instanceof Struct)) continue;
            for (const [, conn] of launcher.Connections.entries()) {
              if (conn.SID === rewardSID) conn.SID = rewardGrantedSID;
            }
          }
        }

        const condNode = proto as QuestNodePrototypeCondition;
        if (condNode.Conditions instanceof Struct) {
          for (const [, condGroup] of condNode.Conditions.entries()) {
            if (!(condGroup instanceof Struct)) continue;
            for (const [, cond] of (condGroup as Struct).entries() as [
              string,
              QuestNodePrototypeConditionsItemItem,
            ][]) {
              if (cond.LinkedNodePrototypeSID === rewardSID) {
                cond.LinkedNodePrototypeSID = rewardGrantedSID;
              }
              if (cond.TargetNode === rewardSID) {
                cond.TargetNode = rewardGrantedSID;
              }
            }
          }
        }
      }
    }
  }

  // Add SetGlobalVariable Active=false before End (on quest completion)
  // SetInactive must fire BEFORE End, because End with ExcludeAllNodesInContainer
  // kills the container and would race against SetInactive.
  // Chain: original trigger → SetInactive → End
  const completionSetVarSID = `${newQuestSID}_SetInactive`;
  const endNode = nodes.find((n) => (n as QuestNodePrototype).SID === `${newQuestSID}_End`);
  if (endNode) {
    const endProto = endNode as QuestNodePrototype;
    // SetInactive gets the End node's original launchers
    nodes.push(
      new Struct({
        __internal__: { rawName: completionSetVarSID, isRoot: true },
        SID: completionSetVarSID,
        QuestSID: newQuestSID,
        NodeType: "EQuestNodeType::SetGlobalVariable" satisfies EQuestNodeType,
        Launchers: endProto.Launchers?.clone(),
        GlobalVariablePrototypeSID: getGlobalVarSID(subQuest),
        ChangeValueMode: "EChangeValueMode::Set",
        VariableValue: false,
      }),
    );
    // Rewire End to fire from SetInactive completion
    endProto.Launchers = getLaunchers([{ SID: completionSetVarSID }]);
  }

  // --- Cancel flow ---
  // Cancel Technical node (entry point, triggered by XStartQuestNodeBySID from parent quest)
  nodes.push(
    new Struct({
      __internal__: { rawName: cancelTechnicalSID, isRoot: true },
      SID: cancelTechnicalSID,
      QuestSID: newQuestSID,
      NodeType: "EQuestNodeType::Technical" satisfies EQuestNodeType,
      StartDelay: 0,
      LaunchOnQuestStart: false,
    }),
  );

  // Cancel journal stage entries (cancel all started stages)
  const uniqueStages = journalCancelNodes.filter((j) => j.action === "stage");
  const seenStages = new Set<string>();
  for (const stage of uniqueStages) {
    if (!stage.stageSID || seenStages.has(stage.stageSID)) continue;
    seenStages.add(stage.stageSID);
    const sid = `${newQuestSID}_CancelStage_${stage.stageSID}`;
    nodes.push(
      new Struct({
        __internal__: { rawName: sid, isRoot: true },
        SID: sid,
        QuestSID: newQuestSID,
        NodeType: "EQuestNodeType::SetJournal" satisfies EQuestNodeType,
        Launchers: getLaunchers([{ SID: cancelTechnicalSID }]),
        JournalEntity: "EJournalEntity::QuestStage",
        JournalAction: "EJournalAction::Cancel",
        JournalQuestSID: stage.questSID,
        JournalQuestStageSID: stage.stageSID,
      }),
    );
  }

  // Skip quest-level journal cancel — it would cancel the shared parent quest journal
  // for all other active sub-quests. Stage-level cancels above are sufficient.

  // Cancel ClearReadyForTurnIn (reset flag on cancel)
  const cancelClearReadySID = `${newQuestSID}_CancelClearReadyForTurnIn`;
  nodes.push(
    new Struct({
      __internal__: { rawName: cancelClearReadySID, isRoot: true },
      SID: cancelClearReadySID,
      QuestSID: newQuestSID,
      NodeType: "EQuestNodeType::SetGlobalVariable" satisfies EQuestNodeType,
      Launchers: getLaunchers([{ SID: cancelTechnicalSID }]),
      GlobalVariablePrototypeSID: getReadyForTurnInVarSID(subQuest),
      ChangeValueMode: "EChangeValueMode::Set",
      VariableValue: false,
    }),
  );

  // Cancel SetGlobalVariable Active=false
  const cancelSetVarSID = `${newQuestSID}_CancelSetInactive`;
  nodes.push(
    new Struct({
      __internal__: { rawName: cancelSetVarSID, isRoot: true },
      SID: cancelSetVarSID,
      QuestSID: newQuestSID,
      NodeType: "EQuestNodeType::SetGlobalVariable" satisfies EQuestNodeType,
      Launchers: getLaunchers([{ SID: cancelTechnicalSID }]),
      GlobalVariablePrototypeSID: getGlobalVarSID(subQuest),
      ChangeValueMode: "EChangeValueMode::Set",
      VariableValue: false,
    }),
  );

  // Cancel End node (terminates all quest nodes including spawns)
  const cancelEndSID = `${newQuestSID}_CancelEnd`;
  nodes.push(
    new Struct({
      __internal__: { rawName: cancelEndSID, isRoot: true },
      SID: cancelEndSID,
      QuestSID: newQuestSID,
      NodeType: "EQuestNodeType::End" satisfies EQuestNodeType,
      Launchers: getLaunchers([{ SID: cancelTechnicalSID }]),
      ExcludeAllNodesInContainer: true,
    }),
  );

  return nodes;
}

function getDeliveryRewardGate(nodes: Struct[], rewardSID: string) {
  const gateNodeSIDs = new Set<string>();
  const itemRemoveSIDs = new Set<string>();
  const requiredItems = new Map<string, { itemSID: string; itemsCount: number }>();

  for (const node of nodes) {
    const proto = node as QuestNodePrototype & {
      TargetQuestGuid?: string;
      ItemSID?: string;
      ItemsCount?: number;
    };
    if (
      proto.NodeType !== "EQuestNodeType::ItemRemove" ||
      proto.TargetQuestGuid !== playerQuestGuid ||
      !(proto.Launchers instanceof Struct)
    ) {
      continue;
    }

    let rewardTriggered = false;
    const conditionSourceSIDs = new Set<string>();

    for (const [, launcher] of proto.Launchers.entries()) {
      if (launcher.Excluding || !(launcher.Connections instanceof Struct)) continue;
      for (const [, conn] of launcher.Connections.entries()) {
        if (conn.SID === rewardSID) rewardTriggered = true;
        conditionSourceSIDs.add(conn.SID);
      }
    }

    for (const sourceSID of conditionSourceSIDs) {
      const sourceNode = nodes.find((candidate) => (candidate as QuestNodePrototype).SID === sourceSID) as
        | QuestNodePrototypeCondition
        | undefined;
      if (
        !sourceNode ||
        sourceNode.NodeType !== "EQuestNodeType::Condition" ||
        !(sourceNode.Launchers instanceof Struct)
      ) {
        continue;
      }

      const launchedFromReward = sourceNode.Launchers.entries().some(([, launcher]) =>
        !launcher.Excluding &&
        launcher.Connections instanceof Struct &&
        launcher.Connections.entries().some(([, conn]) => conn.SID === rewardSID),
      );
      if (!launchedFromReward) continue;

      rewardTriggered = true;
      gateNodeSIDs.add(sourceSID);

      if (!(sourceNode.Conditions instanceof Struct)) continue;
      for (const [, condGroup] of sourceNode.Conditions.entries()) {
        if (!(condGroup instanceof Struct)) continue;
        for (const [, cond] of (condGroup as Struct).entries() as [
          string,
          QuestNodePrototypeConditionsItemItem,
        ][]) {
          if (cond.ConditionType !== "EQuestConditionType::ItemInInventory") continue;
          const itemSID = cond.ItemPrototypeSID?.VariableValue;
          const itemsCount = cond.ItemsCount?.VariableValue;
          if (typeof itemSID !== "string" || typeof itemsCount !== "number") continue;
          requiredItems.set(`${itemSID}:${itemsCount}`, { itemSID, itemsCount });
        }
      }
    }

    if (!rewardTriggered) continue;

    gateNodeSIDs.add(proto.SID);
    itemRemoveSIDs.add(proto.SID);

    if (requiredItems.size === 0 && typeof proto.ItemSID === "string") {
      requiredItems.set(`${proto.ItemSID}:${proto.ItemsCount ?? 1}`, {
        itemSID: proto.ItemSID,
        itemsCount: proto.ItemsCount ?? 1,
      });
    }
  }

  if (!itemRemoveSIDs.size || !requiredItems.size) return undefined;

  return {
    gateNodeSIDs,
    itemRemoveSIDs: [...itemRemoveSIDs],
    requiredItems: [...requiredItems.values()],
  };
}

transformQuestNodePrototypes.files = [
  "/QuestNodePrototypes/RSQ01.cfg",
  "/QuestNodePrototypes/RSQ04.cfg",
  "/QuestNodePrototypes/RSQ05.cfg",
  "/QuestNodePrototypes/RSQ06_C00___SIDOROVICH.cfg",
  "/QuestNodePrototypes/RSQ07_C00_TSEMZAVOD.cfg",
  "/QuestNodePrototypes/RSQ08_C00_ROSTOK.cfg",
  "/QuestNodePrototypes/RSQ09_C00_MALAHIT.cfg",
  "/QuestNodePrototypes/RSQ10_C00_HARPY.cfg",
];
