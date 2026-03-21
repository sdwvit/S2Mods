import { type DialogPrototype, type DialogPrototypeNextDialogOptions, type DialogPrototypeNextDialogOptionsItem, Struct } from "s2cfgtojson";
import { logger } from "../../src/logger.mts";
import { getDialogPrototypeConditions } from "../../src/struct-utils.mts";
import type { MetaContext } from "../../src/meta-type.mts";

export function transformDialogPrototypes(struct: DialogPrototype, context: MetaContext<DialogPrototype>) {
  if (context.filePath.endsWith("/DialogPrototypes/EQ197_QD_Orders.cfg")) {
    return alwaysShowAllMutantQuestPartsDialog(struct, context.structsById);
  }
}

transformDialogPrototypes.files = ["/DialogPrototypes/EQ197_QD_Orders.cfg"];

function deriveItemInfo(optionSID: string, structsById: Record<string, DialogPrototype>) {
  // option (e.g. Dog_73040) → WaitForReply_N → Done struct with GiveItem action
  const optionStruct = structsById[optionSID];
  const waitForReplySID = optionStruct?.NextDialogOptions?.["0"]?.NextDialogSID;
  const waitForReply = waitForReplySID && structsById[waitForReplySID];
  const doneSID = waitForReply?.NextDialogOptions?.["0"]?.NextDialogSID;
  const doneStruct = doneSID && structsById[doneSID];
  const giveAction = doneStruct?.DialogActions?.entries().find(
    ([, a]) => a.DialogAction === "EDialogAction::GiveItem",
  )?.[1];
  if (!giveAction) return null;
  return { name: giveAction.DialogActionParam.VariableValue as string, count: giveAction.ItemsCount.VariableValue as number };
}

function alwaysShowAllMutantQuestPartsDialog(struct: DialogPrototype, structsById: Record<string, DialogPrototype>) {
  /**
   * Show all dialog options for mutant parts quests regardless of what devs intended lol
   */
  if (struct.SID === "EQ197_QD_Orders_WaitForReply") {
    const fork = struct.fork();
    fork.NextDialogOptions = new Struct() as DialogPrototypeNextDialogOptions;
    struct.NextDialogOptions.forEach(([k, option]: [string, DialogPrototypeNextDialogOptionsItem]) => {
      const optionFork = option.fork();
      const itemInfo = deriveItemInfo(option.NextDialogSID, structsById);
      if (!itemInfo) {
        logger.error("Unknown dialog option", option.NextDialogSID);
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
