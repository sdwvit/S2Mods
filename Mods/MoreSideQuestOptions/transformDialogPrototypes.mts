import { type DialogPrototype, type DialogPrototypeNextDialogOptions, type DialogPrototypeNextDialogOptionsItem, Struct } from "s2cfgtojson";
import { getDialogPrototypeConditions } from "../../src/struct-utils.mts";
import { getDialogPhrase, getWaitForReply } from "../../src/getDialogPhrase.mts";
import type { MetaContext } from "../../src/meta-type.mts";
import {
  dialogConditionsToShowTakeJobOption,
  dialogConditionsToShowMoreThanOneJobOption,
  vendorByDialogChain,
  getGlobalVarSID,
  getCancelDialogSID,
  getTurnInDialogSID,
  getReadyForTurnInVarSID,
  type VendorConfig,
} from "./local.consts.mts";
import { QuestDataTableByQuestSID } from "../MasterMod/rewardFormula.mts";

const processedChains = new Set<string>();

export function transformDialogPrototypes(struct: DialogPrototype, context: MetaContext<DialogPrototype>) {
  if (context.filePath.endsWith("/DialogPrototypes/EQ197_QD_Orders.cfg")) {
    return alwaysShowAllMutantQuestPartsDialog(struct, context.structsById);
  }

  // RSQ vendor dialog chains: patch If/If_1 to add hub option + generate hub dialogs
  const vendor = vendorByDialogChain.get(struct.DialogChainPrototypeSID);
  if (!vendor) return;

  const isIfNode = dialogConditionsToShowTakeJobOption.has(struct.SID) || dialogConditionsToShowMoreThanOneJobOption.has(struct.SID);

  if (isIfNode) {
    const patched = patchIfWithHubOption(struct, vendor);

    // Generate hub dialogs once per chain (triggered by first If node encountered)
    if (!processedChains.has(vendor.dialogChain)) {
      processedChains.add(vendor.dialogChain);
      const hubDialogs = generateHubDialogs(vendor);
      return [patched, ...hubDialogs];
    }
    return patched;
  }
}

transformDialogPrototypes.files = [
  "/DialogPrototypes/EQ197_QD_Orders.cfg",
  "/DialogPrototypes/RSQ01_Dialog_Warlock_RSQ.cfg",
  "/DialogPrototypes/RSQ04_Dialog_Drabadan_RSQ.cfg",
  "/DialogPrototypes/RSQ05_Dialog_Sich_RSQ.cfg",
  "/DialogPrototypes/RSQ06_Dialog_Sidorovich_RSQ.cfg",
  "/DialogPrototypes/RSQ07_Dialog_Barmen_RSQ.cfg",
  "/DialogPrototypes/RSQ08_Dialog_Barmen_RSQ.cfg",
  "/DialogPrototypes/RSQ09_Dialog_Spica_RSQ.cfg",
  "/DialogPrototypes/RSQ10_Dialog_Harpy_RSQ.cfg",
];

// --- RSQ Hub Dialog Generation ---

function patchIfWithHubOption(struct: DialogPrototype, vendor: VendorConfig): Struct {
  const hubSID = `${vendor.dialogChain}_Hub_MoreSideQuestOptions`;
  const fork = struct.fork();

  // Redirect both True and False branches to hub
  const hubOption = new Struct({
    Conditions: new Struct(),
    NextDialogSID: hubSID,
    AvailableFromStart: true,
    VisibleOnFailedCondition: true,
    MainReply: false,
    AnswerTo: -1,
    IncludeBy: "",
    ExcludeBy: "",
  }) as DialogPrototypeNextDialogOptionsItem;

  fork.NextDialogOptions = new Struct() as DialogPrototypeNextDialogOptions;
  if (struct.NextDialogOptions?.True) {
    fork.NextDialogOptions.addNode(hubOption.clone(), "True");
  }
  if (struct.NextDialogOptions?.False) {
    fork.NextDialogOptions.addNode(hubOption.clone(), "False");
  }

  return fork.fork(true);
}

function generateHubDialogs(vendor: VendorConfig): Struct[] {
  const chain = vendor.dialogChain;
  const nodes: Struct[] = [];

  const hubSID = `${chain}_Hub_MoreSideQuestOptions`;
  const addJobSID = `${chain}_AddJob_MoreSideQuestOptions`;
  const removeJobSID = `${chain}_RemoveJob_MoreSideQuestOptions`;
  const turnInJobSID = `${chain}_TurnInJob_MoreSideQuestOptions`;

  // Hub menu: AddJob / RemoveJob / TurnInJob / Leave
  nodes.push(getWaitForReply(hubSID, chain, [
    { sid: addJobSID },
    { sid: removeJobSID },
    { sid: turnInJobSID },
    { sid: "", conditions: undefined }, // Terminate (Leave)
  ]));
  // Fix the leave option to be Terminate=true
  const hubNode = nodes[nodes.length - 1] as DialogPrototype;
  const lastOpt = hubNode.NextDialogOptions?.["3"];
  if (lastOpt) {
    lastOpt.NextDialogSID = "";
    lastOpt.Terminate = true;
  }

  // AddJob menu: per-quest options conditioned on Active==false
  const addJobOptions: { sid: string; conditions?: any }[] = [];
  for (const subQuest of vendor.subQuests) {
    const dialogSID = getQuestDescriptionDialogSID(subQuest);
    if (!dialogSID) continue;
    addJobOptions.push({
      sid: dialogSID,
      conditions: getDialogPrototypeConditions({
        ConditionType: "EQuestConditionType::GlobalVariable",
        ConditionComparance: "EConditionComparance::Equal",
        GlobalVariablePrototypeSID: getGlobalVarSID(subQuest),
        ChangeValueMode: "EChangeValueMode::Set",
        VariableValue: false,
      }),
    });
  }
  // Add back/terminate option
  addJobOptions.push({ sid: "" });
  nodes.push(getWaitForReply(addJobSID, chain, addJobOptions));
  // Fix last option to Terminate=true
  const addNode = nodes[nodes.length - 1] as DialogPrototype;
  const addLastOpt = addNode.NextDialogOptions?.[String(addJobOptions.length - 1)];
  if (addLastOpt) {
    addLastOpt.Terminate = true;
  }

  // RemoveJob menu: per-quest options conditioned on Active==true
  const removeJobOptions: { sid: string; conditions?: any }[] = [];
  for (const subQuest of vendor.subQuests) {
    const cancelSID = getCancelDialogSID(chain, subQuest);
    removeJobOptions.push({
      sid: cancelSID,
      conditions: getDialogPrototypeConditions({
        ConditionType: "EQuestConditionType::GlobalVariable",
        ConditionComparance: "EConditionComparance::Equal",
        GlobalVariablePrototypeSID: getGlobalVarSID(subQuest),
        ChangeValueMode: "EChangeValueMode::Set",
        VariableValue: true,
      }),
    });
  }
  // Add back/terminate option
  removeJobOptions.push({ sid: "" });
  nodes.push(getWaitForReply(removeJobSID, chain, removeJobOptions));
  const removeNode = nodes[nodes.length - 1] as DialogPrototype;
  const removeLastOpt = removeNode.NextDialogOptions?.[String(removeJobOptions.length - 1)];
  if (removeLastOpt) {
    removeLastOpt.Terminate = true;
  }

  // TurnInJob menu: per-quest options conditioned on Active==true AND ReadyForTurnIn==true
  const turnInOptions: { sid: string; conditions?: any }[] = [];
  for (const subQuest of vendor.subQuests) {
    const turnInSID = getTurnInDialogSID(chain, subQuest);
    turnInOptions.push({
      sid: turnInSID,
      conditions: getDialogPrototypeConditions([
        {
          ConditionType: "EQuestConditionType::GlobalVariable",
          ConditionComparance: "EConditionComparance::Equal",
          GlobalVariablePrototypeSID: getGlobalVarSID(subQuest),
          ChangeValueMode: "EChangeValueMode::Set",
          VariableValue: true,
        },
        {
          ConditionType: "EQuestConditionType::GlobalVariable",
          ConditionComparance: "EConditionComparance::Equal",
          GlobalVariablePrototypeSID: getReadyForTurnInVarSID(subQuest),
          ChangeValueMode: "EChangeValueMode::Set",
          VariableValue: true,
        },
      ]),
    });
  }
  // Add back/terminate option
  turnInOptions.push({ sid: "" });
  nodes.push(getWaitForReply(turnInJobSID, chain, turnInOptions));
  const turnInNode = nodes[nodes.length - 1] as DialogPrototype;
  const turnInLastOpt = turnInNode.NextDialogOptions?.[String(turnInOptions.length - 1)];
  if (turnInLastOpt) {
    turnInLastOpt.Terminate = true;
  }

  // Per-quest TurnIn dialogs
  for (const subQuest of vendor.subQuests) {
    const turnInSID = getTurnInDialogSID(chain, subQuest);
    // TurnIn confirm: terminates dialog (ModSetDialog detects this LastPhrase)
    nodes.push(getDialogPhrase(turnInSID, chain, -1, [{ sid: "", terminate: true }]));
  }

  // Per-quest Cancel dialogs
  for (const subQuest of vendor.subQuests) {
    const cancelSID = getCancelDialogSID(chain, subQuest);
    // Cancel confirm: terminates dialog (ModSetDialog detects this LastPhrase)
    nodes.push(getDialogPhrase(cancelSID, chain, -1, [{ sid: "", terminate: true }]));
  }

  return nodes;
}

function getQuestDescriptionDialogSID(subQuest: string): string | undefined {
  const entries = QuestDataTableByQuestSID[subQuest];
  if (!entries?.length) return;
  return entries[0]["Dialog SID"];
}

// --- EQ197 Mutant Parts Dialog ---

function alwaysShowAllMutantQuestPartsDialog(struct: DialogPrototype, structsById: Record<string, DialogPrototype>) {
  if (struct.SID === "EQ197_QD_Orders_WaitForReply") {
    const fork = struct.fork();
    fork.NextDialogOptions = new Struct() as DialogPrototypeNextDialogOptions;
    struct.NextDialogOptions.forEach(([k, option]: [string, DialogPrototypeNextDialogOptionsItem]) => {
      const optionFork = option.fork();
      const itemInfo = deriveItemInfo(option.NextDialogSID, structsById);
      if (!itemInfo) {
        fork.NextDialogOptions.addNode(optionFork, k);
        return;
      }

      optionFork.Conditions = getDialogPrototypeConditions({
        ConditionType: "EQuestConditionType::ItemInInventory",
        ConditionComparance: "EConditionComparance::GreaterOrEqual",
        TargetCharacter: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        ItemPrototypeSID: {
          VariableType: "EGlobalVariableType::String",
          VariableValue: itemInfo.name,
        },
        ItemsCount: {
          VariableType: "EGlobalVariableType::Int",
          VariableValue: itemInfo.count,
        },
        WithEquipped: true,
        WithInventory: true,
      });

      fork.NextDialogOptions.addNode(optionFork, k);
    });
    return fork.fork(true);
  }

  if (mutantPartsVarSet.has(struct.Conditions?.["0"]["0"].GlobalVariablePrototypeSID)) {
    const fork = struct.fork();
    fork.Conditions = getDialogPrototypeConditions({ ConditionComparance: "EConditionComparance::NotEqual", VariableValue: -1 });
    return fork.fork(true);
  }
}
const mutantPartsVarSet = new Set(["MutantLootQuestWeak", "MutantLootQuestMedium", "MutantLootQuestStrong"]);

function deriveItemInfo(optionSID: string, structsById: Record<string, DialogPrototype>) {
  const optionStruct = structsById[optionSID];
  const waitForReplySID = optionStruct?.NextDialogOptions?.["0"]?.NextDialogSID;
  const waitForReply = waitForReplySID && structsById[waitForReplySID];
  const doneSID = waitForReply?.NextDialogOptions?.["0"]?.NextDialogSID;
  const doneStruct = doneSID && structsById[doneSID];
  const giveAction = doneStruct?.DialogActions?.entries().find(([, a]) => a.DialogAction === "EDialogAction::GiveItem")?.[1];
  if (!giveAction) return null;
  return { name: giveAction.DialogActionParam.VariableValue as string, count: giveAction.ItemsCount.VariableValue as number };
}
