import { type DialogPrototype, type DialogPrototypeNextDialogOptions, type DialogPrototypeNextDialogOptionsItem, Struct } from "s2cfgtojson";
import { logger } from "../../src/logger.mts";
import { getDialogPrototypeConditions } from "../../src/struct-utils.mts";
import type { MetaContext } from "../../src/meta-type.mts";

export function transformDialogPrototypes(struct: DialogPrototype, context: MetaContext<DialogPrototype>) {
  if (context.filePath.endsWith("/DialogPrototypes/EQ197_QD_Orders.cfg")) {
    return alwaysShowAllMutantQuestPartsDialog(struct);
  }
}

transformDialogPrototypes.files = ["/DialogPrototypes/EQ197_QD_Orders.cfg"];

function alwaysShowAllMutantQuestPartsDialog(struct: DialogPrototype) {
  /**
   * Show all dialog options for mutant parts quests regardless of what devs intended lol
   */
  if (struct.SID === "EQ197_QD_Orders_WaitForReply") {
    const fork = struct.fork();
    fork.NextDialogOptions = new Struct() as DialogPrototypeNextDialogOptions;
    struct.NextDialogOptions.forEach(([k, option]: [string, DialogPrototypeNextDialogOptionsItem]) => {
      const optionFork = option.fork();
      if (!DialogOptionToMutantPartsMap[option.NextDialogSID]) {
        logger.error("Unknown dialog option", option.NextDialogSID);
        return;
      }

      optionFork.Conditions = getDialogPrototypeConditions({
        ConditionType: "EQuestConditionType::ItemInInventory",
        ConditionComparance: "EConditionComparance::GreaterOrEqual",
        TargetCharacter: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        ItemPrototypeSID: {
          VariableType: "EGlobalVariableType::String",
          VariableValue: DialogOptionToMutantPartsMap[option.NextDialogSID].name,
        },
        ItemsCount: {
          VariableType: "EGlobalVariableType::Int",
          VariableValue: DialogOptionToMutantPartsMap[option.NextDialogSID].count,
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

const DialogOptionToMutantPartsMap = {
  EQ197_QD_Orders_Dog_73040: { name: "BlinddogLoot", count: 8 },
  EQ197_QD_Orders_Bloodsucker_73047: { name: "BloodsuckerLoot", count: 5 },
  EQ197_QD_Orders_Boar_73042: { name: "BoarLoot", count: 5 },
  EQ197_QD_Orders_Burer_73049: { name: "BurerLoot", count: 6 },
  EQ197_QD_Orders_Cat_73048: { name: "CatLoot", count: 9 },
  EQ197_QD_Orders_Chimera_73052: { name: "ChimeraLoot", count: 2 },
  EQ197_QD_Orders_Controller_73051: { name: "ControllerLoot", count: 3 },
  EQ197_QD_Orders_Deer_73044: { name: "DeerLoot", count: 6 },
  EQ197_QD_Orders_Flesh_73041: { name: "FleshLoot", count: 5 },
  EQ197_QD_Orders_Jerboa_73043: { name: "TushkanLoot", count: 10 },
  EQ197_QD_Orders_Poltergeist_73050: { name: "PoltergeistLoot", count: 3 },
  EQ197_QD_Orders_Pseudodog_73045: { name: "PseudodogLoot", count: 3 },
  EQ197_QD_Orders_Pseudogiant_73053: { name: "PseudogiantLoot", count: 2 },
  EQ197_QD_Orders_Snork_73046: { name: "SnorkLoot", count: 7 },
};
