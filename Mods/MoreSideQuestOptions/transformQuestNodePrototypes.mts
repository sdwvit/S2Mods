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
import { getLaunchers } from "../../src/struct-utils.mts";
import { vendors, getGlobalVarSID, getCancelDialogSID, type VendorConfig } from "./local.consts.mts";
import { readFileAndGetStructs } from "../../src/read-file-and-get-structs.mts";

const processedVendors = new Set<string>();

export async function transformQuestNodePrototypes(
  struct: QuestNodePrototype,
  context: MetaContext<QuestNodePrototype>,
) {
  const vendor = findVendor(context.filePath);
  if (!vendor) return;

  // Disable vanilla Random node (strip launchers)
  if (struct.NodeType === "EQuestNodeType::Random" && struct.SID === `${vendor.questNodePrefix}_Random`) {
    const fork = struct.fork() as QuestNodePrototypeRandom;
    fork.Launchers = new Struct() as any;
    return fork;
  }

  // Disable vanilla SetDialog (strip launchers so it never fires)
  if (struct.SID === vendor.setDialogSID) {
    const fork = struct.fork() as QuestNodePrototypeSetDialog;
    fork.Launchers = new Struct() as any;

    // Generate all mod nodes once per vendor (piggyback on SetDialog processing)
    if (!processedVendors.has(vendor.questSID)) {
      processedVendors.add(vendor.questSID);
      const modNodes = await generateAllModNodes(vendor, struct as QuestNodePrototypeSetDialog, context);
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
  nodes.push(new Struct({
    __internal__: { rawName: bootSID, isRoot: true },
    SID: bootSID,
    QuestSID: vendor.questSID,
    NodeType: "EQuestNodeType::Technical" satisfies EQuestNodeType,
    StartDelay: 0,
    LaunchOnQuestStart: true,
  }));

  // ConsoleCommand node: launches from _Start, triggers Boot via XStartQuestNodeBySID
  const bootCmdSID = `${vendor.questNodePrefix}_BootCmd_MoreSideQuestOptions`;
  nodes.push(new Struct({
    __internal__: { rawName: bootCmdSID, isRoot: true },
    SID: bootCmdSID,
    QuestSID: vendor.questNodePrefix,
    NodeType: "EQuestNodeType::ConsoleCommand" satisfies EQuestNodeType,
    Repeatable: true,
    Launchers: getLaunchers([{ SID: `${vendor.questNodePrefix}_Start` }]),
    ConsoleCommand: `XStartQuestNodeBySID ${bootSID}`,
  }));

  // Generate ModSetDialog (our replacement for vanilla SetDialog)
  const modSetDialogSID = `${vendor.questNodePrefix}_ModSetDialog_MoreSideQuestOptions`;
  const modSetDialog = generateModSetDialog(vendor, vanillaSetDialog, modSetDialogSID, confirmPhrases, bootSID);
  nodes.push(modSetDialog);

  // Generate per-sub-quest ConsoleCommand chains
  for (const subQuest of vendor.subQuests) {
    const confirmPhrase = confirmPhrases.get(subQuest);
    if (!confirmPhrase) continue;

    const cancelPhrase = getCancelDialogSID(vendor.dialogChain, subQuest);
    const newQuestSID = `MoreSideQuestOptions_${subQuest}`;

    nodes.push(...generateActionChain(vendor, subQuest, modSetDialogSID, confirmPhrase, newQuestSID, "Start"));
    nodes.push(...generateActionChain(vendor, subQuest, modSetDialogSID, cancelPhrase, newQuestSID, "Cancel"));
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
      (s) => s.NodeType === "EQuestNodeType::Container" && (s as any).ContaineredQuestPrototypeSID === subQuest,
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
        if (cond?.ConditionType === "EQuestConditionType::Bridge" && cond.LinkedNodePrototypeSID === vendor.setDialogSID) {
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
  const initialLaunchers: any[] = [
    { SID: bootSID },
    { SID: startSID },
  ];
  // Add vanilla condition node connections as separate entries
  for (const [, launcher] of vanilla.Launchers.entries()) {
    if (launcher.Excluding) continue;
    if (!(launcher.Connections instanceof Struct)) continue;
    let isSelfRef = false;
    for (const [, conn] of launcher.Connections.entries()) {
      if (conn.SID === vanilla.SID) { isSelfRef = true; break; }
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

  const launchers = getLaunchers([
    ...initialLaunchers,
    ...selfLoopLaunchers,
  ]);

  // Copy excluding launchers from vanilla (prevent dialog during certain events)
  for (const [, launcher] of vanilla.Launchers.entries()) {
    if (launcher.Excluding) {
      launchers.addNode(launcher.clone());
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
    OverrideDialogTopic: "EOverrideDialogTopic::Info",
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
  const launcherRef = { SID: modSetDialogSID, Name: phrase };

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

  return [cmdNode, setVarNode];
}

// --- Independent quest generation ---

async function generateIndependentQuest(
  vendor: VendorConfig,
  subQuest: string,
): Promise<Struct[]> {
  const newQuestSID = `MoreSideQuestOptions_${subQuest}`;
  const cancelTechnicalSID = `${newQuestSID}_Cancel`;

  // Read vanilla sub-quest .cfg
  const vanillaNodes = await readFileAndGetStructs<QuestNodePrototype>(`/QuestNodePrototypes/${subQuest}.cfg`);

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

  const journalCancelNodes: { questSID: string; stageSID?: string; action: string }[] = [];

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

    // Update Launchers: remap SIDs
    if (cloned.Launchers instanceof Struct) {
      for (const [, launcher] of cloned.Launchers.entries()) {
        if (launcher.Connections instanceof Struct) {
          for (const [, conn] of launcher.Connections.entries()) {
            const mapped = sidMap.get(conn.SID);
            if (mapped) conn.SID = mapped;
          }
        }
      }
    }

    // Update Bridge conditions: remap LinkedNodePrototypeSID
    const condNode = cloned as QuestNodePrototypeCondition;
    if (condNode.Conditions instanceof Struct) {
      for (const [, condGroup] of condNode.Conditions.entries()) {
        if (condGroup instanceof Struct) {
          for (const [, cond] of (condGroup as Struct).entries() as [string, QuestNodePrototypeConditionsItemItem][]) {
            if (cond.LinkedNodePrototypeSID) {
              const mapped = sidMap.get(cond.LinkedNodePrototypeSID);
              if (mapped) cond.LinkedNodePrototypeSID = mapped;
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

    nodes.push(cloned);
  }

  // Inject Spawn + delay before each ItemAdd to force-spawn containers
  // (StashClueRework sets SpawnOnStart=false on ItemContainers, so we must spawn them explicitly)
  const itemAddNodes = nodes.filter(n => (n as QuestNodePrototype).NodeType === "EQuestNodeType::ItemAdd");
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

    nodes.push(new Struct({
      __internal__: { rawName: spawnSID, isRoot: true },
      SID: spawnSID,
      QuestSID: newQuestSID,
      NodeType: "EQuestNodeType::Spawn" satisfies EQuestNodeType,
      Launchers: getLaunchers(launcherRefs),
      TargetQuestGuid: ia.TargetQuestGuid,
      IgnoreDamageType: "EIgnoreDamageType::None",
      SpawnHidden: false,
      SpawnNodeExcludeType: "ESpawnNodeExcludeType::SeamlessDespawn",
    }));

    nodes.push(new Struct({
      __internal__: { rawName: delaySID, isRoot: true },
      SID: delaySID,
      QuestSID: newQuestSID,
      NodeType: "EQuestNodeType::Technical" satisfies EQuestNodeType,
      StartDelay: 1.0,
      Launchers: getLaunchers(launcherRefs),
    }));

    // Rewire ItemAdd to launch from delay instead of original trigger
    ia.Launchers = getLaunchers([{ SID: delaySID }]);
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
    nodes.push(new Struct({
      __internal__: { rawName: completionSetVarSID, isRoot: true },
      SID: completionSetVarSID,
      QuestSID: newQuestSID,
      NodeType: "EQuestNodeType::SetGlobalVariable" satisfies EQuestNodeType,
      Launchers: endProto.Launchers?.clone(),
      GlobalVariablePrototypeSID: getGlobalVarSID(subQuest),
      ChangeValueMode: "EChangeValueMode::Set",
      VariableValue: false,
    }));
    // Rewire End to fire from SetInactive completion
    endProto.Launchers = getLaunchers([{ SID: completionSetVarSID }]);
  }

  // --- Cancel flow ---
  // Cancel Technical node (entry point, triggered by XStartQuestNodeBySID from parent quest)
  nodes.push(new Struct({
    __internal__: { rawName: cancelTechnicalSID, isRoot: true },
    SID: cancelTechnicalSID,
    QuestSID: newQuestSID,
    NodeType: "EQuestNodeType::Technical" satisfies EQuestNodeType,
    StartDelay: 0,
    LaunchOnQuestStart: false,
  }));

  // Cancel journal stage entries (cancel all started stages)
  const uniqueStages = journalCancelNodes.filter((j) => j.action === "stage");
  const seenStages = new Set<string>();
  for (const stage of uniqueStages) {
    if (!stage.stageSID || seenStages.has(stage.stageSID)) continue;
    seenStages.add(stage.stageSID);
    const sid = `${newQuestSID}_CancelStage_${stage.stageSID}`;
    nodes.push(new Struct({
      __internal__: { rawName: sid, isRoot: true },
      SID: sid,
      QuestSID: newQuestSID,
      NodeType: "EQuestNodeType::SetJournal" satisfies EQuestNodeType,
      Launchers: getLaunchers([{ SID: cancelTechnicalSID }]),
      JournalEntity: "EJournalEntity::QuestStage",
      JournalAction: "EJournalAction::Cancel",
      JournalQuestSID: stage.questSID,
      JournalQuestStageSID: stage.stageSID,
    }));
  }

  // Skip quest-level journal cancel — it would cancel the shared parent quest journal
  // for all other active sub-quests. Stage-level cancels above are sufficient.

  // Cancel SetGlobalVariable Active=false
  const cancelSetVarSID = `${newQuestSID}_CancelSetInactive`;
  nodes.push(new Struct({
    __internal__: { rawName: cancelSetVarSID, isRoot: true },
    SID: cancelSetVarSID,
    QuestSID: newQuestSID,
    NodeType: "EQuestNodeType::SetGlobalVariable" satisfies EQuestNodeType,
    Launchers: getLaunchers([{ SID: cancelTechnicalSID }]),
    GlobalVariablePrototypeSID: getGlobalVarSID(subQuest),
    ChangeValueMode: "EChangeValueMode::Set",
    VariableValue: false,
  }));

  // Cancel End node (terminates all quest nodes including spawns)
  const cancelEndSID = `${newQuestSID}_CancelEnd`;
  nodes.push(new Struct({
    __internal__: { rawName: cancelEndSID, isRoot: true },
    SID: cancelEndSID,
    QuestSID: newQuestSID,
    NodeType: "EQuestNodeType::End" satisfies EQuestNodeType,
    Launchers: getLaunchers([{ SID: cancelTechnicalSID }]),
    ExcludeAllNodesInContainer: true,
  }));

  return nodes;
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
