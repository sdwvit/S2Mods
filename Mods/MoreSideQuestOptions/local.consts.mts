export const dialogConditionsToShowTakeJobOption = new Set([
  "RSQ01_Dialog_Warlock_RSQ_If_1",
  "RSQ04_Dialog_Drabadan_RSQ_If",
  "RSQ05_Dialog_Sich_RSQ_If",
  "RSQ06_Dialog_Sidorovich_RSQ_If",
  "RSQ07_Dialog_Barmen_RSQ_If",
  "RSQ08_Dialog_Barmen_RSQ_If",
  "RSQ09_Dialog_Spica_RSQ_If",
  "RSQ10_Dialog_Harpy_RSQ_If",
]);
export const dialogConditionsToShowMoreThanOneJobOption = new Set([
  "RSQ01_Dialog_Warlock_RSQ_If",
  "RSQ04_Dialog_Drabadan_RSQ_If_1",
  "RSQ05_Dialog_Sich_RSQ_If_1",
  "RSQ06_Dialog_Sidorovich_RSQ_If_1",
  "RSQ07_Dialog_Barmen_RSQ_If_1",
  "RSQ08_Dialog_Barmen_RSQ_If_1",
  "RSQ09_Dialog_Spica_RSQ_If_1",
  "RSQ10_Dialog_Harpy_RSQ_If_1",
]);

export const dialogQuestPackNodes = new Set([
  "RSQ01_Dialog_Warlock_RSQ_WaitForReply_QuestPack",
  "RSQ04_Dialog_Drabadan_RSQ_WaitForReply_1",
  "RSQ05_Dialog_Sich_RSQ_WaitForReply_1",
  "RSQ06_Dialog_Sidorovich_RSQ_WaitForReply_1",
  "RSQ07_Dialog_Barmen_RSQ_WaitForReply_1",
  "RSQ08_Dialog_Barmen_RSQ_WaitForReply_1",
  "RSQ09_Dialog_Spica_RSQ_WaitForReply_1",
  "RSQ10_Dialog_Harpy_RSQ_WaitForReply_1",
]);

export const mainSetDialogQuestNodes = new Set([
  "RSQ01_SetDialog_WarlockRSQ",
  "RSQ04_SetDialog_DrabadanRSQ_1",
  "RSQ05_SetDialog_SichRSQ",
  "RSQ06_C00___SIDOROVICH_SetDialog_SichRSQ",
  "RSQ07_C00_TSEMZAVOD_SetDialog_SichRSQ",
  "RSQ08_C00_ROSTOK_SetDialog_SichRSQ",
  "RSQ09_C00_MALAHIT_SetDialog_SichRSQ",
  "RSQ10_C00_HARPY_SetDialog_SichRSQ",
]);
export const resetSetDialogQuestNodes = new Set([
  "RSQ01_SetDialog_RSQ01_Dialog_Warlock_RSQ",
  "RSQ04_SetDialog_RSQ04_Dialog_Drabadan_RSQ",
  "RSQ05_SetDialog_NoJob",
  "RSQ06_C00___SIDOROVICH_SetDialog_RSQ06_Dialog_Sidorovich_RSQ",
  "RSQ07_C00_TSEMZAVOD_SetDialog_RSQ07_Dialog_Barmen_RSQ",
  "RSQ08_C00_ROSTOK_SetDialog_RSQ08_Dialog_Barmen_RSQ",
  "RSQ09_C00_MALAHIT_SetDialog_RSQ09_Dialog_Spica_RSQ",
  "RSQ10_C00_HARPY_SetDialog_RSQ10_Dialog_Harpy_RSQ",
]);

export const declineJobQuestNodes = new Set([
  "RSQ01_SetDialog_RSQ01_Dialog_Warlock_DeclineJob",
  "RSQ04_SetDialog_RSQ04_Dialog_Drabadan_DeclineJob",
  "RSQ05_SetDialog_RSQ05_Dialog_Sich_DeclineJob",
  "RSQ06_C00___SIDOROVICH_SetDialog_RSQ06_Dialog_Sidorovich_DeclineJob",
  "RSQ07_C00_TSEMZAVOD_SetDialog_RSQ07_Dialog_Barmen_DeclineJob",
  "RSQ08_C00_ROSTOK_SetDialog_RSQ08_Dialog_Barmen_DeclineJob",
  "RSQ09_C00_MALAHIT_SetDialog_RSQ09_Dialog_Spica_DeclineJob",
  "RSQ10_C00_HARPY_SetDialog_RSQ10_Dialog_Harpy_DeclineJob",
]);

export const randomizerQuestNodes = new Set([
  "RSQ01_Random",
  "RSQ04_Random",
  "RSQ05_Random",
  "RSQ06_C00___SIDOROVICH_Random",
  "RSQ07_C00_TSEMZAVOD_Random",
  "RSQ08_C00_ROSTOK_Random",
  "RSQ09_C00_MALAHIT_Random",
  "RSQ10_C00_HARPY_Random",
]);

export interface VendorConfig {
  questSID: string;
  questNodePrefix: string;
  dialogChain: string;
  questPackWaitForReply: string;
  setDialogSID: string;
  subQuests: string[];
}

export const vendors: VendorConfig[] = [
  {
    questSID: "RSQ01",
    questNodePrefix: "RSQ01",
    dialogChain: "RSQ01_Dialog_Warlock_RSQ",
    questPackWaitForReply: "RSQ01_Dialog_Warlock_RSQ_WaitForReply_QuestPack",
    setDialogSID: "RSQ01_SetDialog_WarlockRSQ",
    subQuests: ["RSQ01_C01", "RSQ01_C02", "RSQ01_C03", "RSQ01_C04", "RSQ01_C05", "RSQ01_C06"],
  },
  {
    questSID: "RSQ04",
    questNodePrefix: "RSQ04",
    dialogChain: "RSQ04_Dialog_Drabadan_RSQ",
    questPackWaitForReply: "RSQ04_Dialog_Drabadan_RSQ_WaitForReply_1",
    setDialogSID: "RSQ04_SetDialog_DrabadanRSQ_1",
    subQuests: [
      "RSQ04_C01", "RSQ04_C02", "RSQ04_C03", "RSQ04_C04", "RSQ04_C05",
      "RSQ04_C06", "RSQ04_C07", "RSQ04_C08", "RSQ04_C09", "RSQ04_C10",
    ],
  },
  {
    questSID: "RSQ05",
    questNodePrefix: "RSQ05",
    dialogChain: "RSQ05_Dialog_Sich_RSQ",
    questPackWaitForReply: "RSQ05_Dialog_Sich_RSQ_WaitForReply_1",
    setDialogSID: "RSQ05_SetDialog_SichRSQ",
    subQuests: [
      "RSQ05_C01", "RSQ05_C02", "RSQ05_C04", "RSQ05_C05",
      "RSQ05_C07", "RSQ05_C08", "RSQ05_C09", "RSQ05_C10",
    ],
  },
  {
    questSID: "RSQ06",
    questNodePrefix: "RSQ06_C00___SIDOROVICH",
    dialogChain: "RSQ06_Dialog_Sidorovich_RSQ",
    questPackWaitForReply: "RSQ06_Dialog_Sidorovich_RSQ_WaitForReply_1",
    setDialogSID: "RSQ06_C00___SIDOROVICH_SetDialog_SichRSQ",
    subQuests: [
      "RSQ06_C01___K_Z", "RSQ06_C02___K_M", "RSQ06_C03___K_B", "RSQ06_C04___K_S",
      "RSQ06_C05___B_B", "RSQ06_C06___B_A", "RSQ06_C07___B_A", "RSQ06_C08___B_A",
      "RSQ06_C09___S_P",
    ],
  },
  {
    questSID: "RSQ07",
    questNodePrefix: "RSQ07_C00_TSEMZAVOD",
    dialogChain: "RSQ07_Dialog_Barmen_RSQ",
    questPackWaitForReply: "RSQ07_Dialog_Barmen_RSQ_WaitForReply_1",
    setDialogSID: "RSQ07_C00_TSEMZAVOD_SetDialog_SichRSQ",
    subQuests: [
      "RSQ07_C01_K_Z", "RSQ07_C02_K_M", "RSQ07_C03_K_M", "RSQ07_C04_K_B",
      "RSQ07_C05_B_B", "RSQ07_C06_B_A", "RSQ07_C07_B_A", "RSQ07_C08_B_A",
      "RSQ07_C09_S_P",
    ],
  },
  {
    questSID: "RSQ08",
    questNodePrefix: "RSQ08_C00_ROSTOK",
    dialogChain: "RSQ08_Dialog_Barmen_RSQ",
    questPackWaitForReply: "RSQ08_Dialog_Barmen_RSQ_WaitForReply_1",
    setDialogSID: "RSQ08_C00_ROSTOK_SetDialog_SichRSQ",
    subQuests: [
      "RSQ08_C01_K_M", "RSQ08_C02_K_B", "RSQ08_C03_K_S", "RSQ08_C04_B_B",
      "RSQ08_C05_B_B", "RSQ08_C06_B_A", "RSQ08_C07_B_A", "RSQ08_C08_B_A",
      "RSQ08_C09_S_P",
    ],
  },
  {
    questSID: "RSQ09",
    questNodePrefix: "RSQ09_C00_MALAHIT",
    dialogChain: "RSQ09_Dialog_Spica_RSQ",
    questPackWaitForReply: "RSQ09_Dialog_Spica_RSQ_WaitForReply_1",
    setDialogSID: "RSQ09_C00_MALAHIT_SetDialog_SichRSQ",
    subQuests: [
      "RSQ09_C01_K_M", "RSQ09_C02_K_M", "RSQ09_C03_K_M", "RSQ09_C04_K_S",
      "RSQ09_C05_B_B", "RSQ09_C06_B_A", "RSQ09_C07_B_A", "RSQ09_C08_B_A",
      "RSQ09_C09_S_P",
    ],
  },
  {
    questSID: "RSQ10",
    questNodePrefix: "RSQ10_C00_HARPY",
    dialogChain: "RSQ10_Dialog_Harpy_RSQ",
    questPackWaitForReply: "RSQ10_Dialog_Harpy_RSQ_WaitForReply_1",
    setDialogSID: "RSQ10_C00_HARPY_SetDialog_SichRSQ",
    subQuests: [
      "RSQ10_C01_K_M", "RSQ10_C02_K_M", "RSQ10_C03_K_S", "RSQ10_C04_K_S",
      "RSQ10_C05_B_B", "RSQ10_C06_B_A", "RSQ10_C07_B_A", "RSQ10_C08_B_A",
      "RSQ10_C09_S_P",
    ],
  },
];

export function getGlobalVarSID(subQuestSID: string) {
  return `MoreSideQuestOptions_${subQuestSID}_Active`;
}

export function getCancelDialogSID(dialogChain: string, subQuestSID: string) {
  return `${dialogChain}_CancelJob_${subQuestSID}_MoreSideQuestOptions`;
}

export function getTurnInDialogSID(dialogChain: string, subQuestSID: string) {
  return `${dialogChain}_TurnInJob_${subQuestSID}_MoreSideQuestOptions`;
}

export function getReadyForTurnInVarSID(subQuestSID: string) {
  return `MoreSideQuestOptions_${subQuestSID}_ReadyForTurnIn`;
}

export function getReturnToAddJobVarSID(questSID: string) {
  return `MoreSideQuestOptions_${questSID}_ReturnToAddJob`;
}

export const allSubQuests = vendors.flatMap((v) => v.subQuests);

export const vendorByDialogChain = new Map(vendors.map((v) => [v.dialogChain, v]));
export const vendorByQuestNodePrefix = new Map(vendors.map((v) => [v.questNodePrefix, v]));
export const vendorBySubQuest = new Map(vendors.flatMap((v) => v.subQuests.map((sq) => [sq, v])));
