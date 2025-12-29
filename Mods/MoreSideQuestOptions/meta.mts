import { MetaType } from "../../src/meta-type.mts";
import { Condition, DialogPrototype, QuestNodePrototype, Struct } from "s2cfgtojson";
import { deepMerge } from "../../src/deep-merge.mts";
import { RSQLessThan3QuestNodesSIDs, RSQRandomizerQuestNodesSIDs, RSQSetDialogQuestNodesSIDs } from "../../src/consts.mjs";
import { markAsForkRecursively } from "../../src/mark-as-fork-recursively.mts";
import { logger } from "../../src/logger.mts";

export const meta: MetaType = {
  description: `
This mod does one thing only: expands the dialogue options offered by NPCs when requesting side quests.
`,
  changenote: "Viktoria now shows dialog option only if you have enough mutant loot parts",
  structTransformers: [alwaysShowAllMutantQuestPartsDialog, transformQuestNodePrototypes],
};

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

export function alwaysShowAllMutantQuestPartsDialog(struct: DialogPrototype) {
  /**
   * Show all dialog options for mutant parts quests regardless of what devs intended lol
   */
  if (struct.SID === "EQ197_QD_Orders_WaitForReply") {
    const fork = struct.fork();
    fork.NextDialogOptions = new Struct() as any;
    struct.NextDialogOptions.forEach(([k, option]) => {
      const optionFork = option.fork();
      if (!DialogOptionToMutantPartsMap[option.NextDialogSID]) {
        logger.error("Unknown dialog option", option.NextDialogSID);
        return;
      }
      optionFork.Conditions = new Struct({
        "0": new Struct({
          "0": new Struct({
            ConditionType: "EQuestConditionType::ItemInInventory",
            ConditionComparance: "EConditionComparance::GreaterOrEqual",
            TargetCharacter: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            ItemPrototypeSID: new Struct({
              VariableType: "EGlobalVariableType::String",
              VariableValue: DialogOptionToMutantPartsMap[option.NextDialogSID].name,
            }),
            ItemsCount: new Struct({
              VariableType: "EGlobalVariableType::Int",
              VariableValue: DialogOptionToMutantPartsMap[option.NextDialogSID].count,
            }),
            WithEquipped: true,
            WithInventory: true,
          } as Partial<Condition>),
        }),
      }) as any;

      fork.NextDialogOptions.addNode(optionFork, k);
    });
    return markAsForkRecursively(fork);
  }

  if (mutantPartsVarSet.has(struct.Conditions?.["0"]["0"].GlobalVariablePrototypeSID)) {
    const fork = struct.fork();
    deepMerge(fork, { Conditions: new Struct({ "0": new Struct({ "0": new Struct({}) }) }) });
    fork.Conditions["0"]["0"].ConditionComparance = "EConditionComparance::NotEqual";
    fork.Conditions["0"]["0"].VariableValue = -1;
    return markAsForkRecursively(fork);
  }
}

alwaysShowAllMutantQuestPartsDialog.files = ["/DialogPrototypes/EQ197_QD_Orders.cfg"];

export function transformQuestNodePrototypes(struct: QuestNodePrototype, context) {
  if (RSQLessThan3QuestNodesSIDs.has(struct.SID)) {
    const total = context.structsById[RSQRandomizerQuestNodesSIDs.find((key) => !!context.structsById[key])].OutputPinNames.entries().length;
    return markAsForkRecursively(
      deepMerge(struct.fork(), {
        Conditions: new Struct({
          // as of 1.7 all of them are [0][0]
          0: new Struct({
            0: new Struct({ VariableValue: total }),
          }),
        }),
      }),
    );
  }
  if (RSQSetDialogQuestNodesSIDs.has(struct.SID)) {
    let connectionIndex: string;
    const [launcherIndex] = struct.Launchers.entries().find((e) => {
      return e[1].Connections.entries().find((e1) => {
        connectionIndex = e1[0];
        return RSQLessThan3QuestNodesSIDs.has(e1[1].SID);
      });
    });
    return markAsForkRecursively(
      deepMerge(struct.fork(), {
        Launchers: new Struct({
          [launcherIndex]: new Struct({
            Connections: new Struct({
              [connectionIndex]: new Struct({
                Name: "True",
              }),
            }),
          }),
        }),
      }),
    );
  }
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
