import type { MetaContext, MetaType } from "../../src/meta-type.mts";
import { Struct } from "s2cfgtojson";
import type {
  DialogPrototype,
  DialogPrototypeNextDialogOptionsItem,
  QuestNodePrototype,
  QuestNodePrototypeIf,
  QuestNodePrototypeRandom,
  QuestNodePrototypeTechnical,
} from "s2cfgtojson";
import { deepMerge } from "../../src/deep-merge.mts";
import { RSQLessThan3QuestNodesSIDs, RSQRandomizerQuestNodesSIDs, RSQSetDialogQuestNodesSIDs } from "../../src/consts.mts";
import { logger } from "../../src/logger.mts";
import { getDialogPrototypeConditions } from "../../src/struct-utils.mts";

const RSQRandomizerQuestNodesSet = new Set(RSQRandomizerQuestNodesSIDs);

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

alwaysShowAllMutantQuestPartsDialog.files = ["/DialogPrototypes/EQ197_QD_Orders.cfg"];

export function transformQuestNodePrototypes(struct: QuestNodePrototype, context: MetaContext<QuestNodePrototypeRandom>) {
  if (RSQLessThan3QuestNodesSIDs.has(struct.SID)) {
    const total = context.structsById[RSQRandomizerQuestNodesSIDs.find((key) => !!context.structsById[key])].OutputPinNames.entries().length;
    return deepMerge(struct.fork(), {
      Conditions: new Struct({
        // as of 1.7 all of them are [0][0]
        0: new Struct({
          0: new Struct({ VariableValue: total }),
        }),
      }),
    }).fork(true);
  }
  if (RSQSetDialogQuestNodesSIDs.has(struct.SID)) {
    let connectionIndex: string;
    const [launcherIndex] = (struct as QuestNodePrototypeIf).Launchers.entries().find((e) => {
      return e[1].Connections.entries().find((e1) => {
        connectionIndex = e1[0];
        return RSQLessThan3QuestNodesSIDs.has(e1[1].SID);
      });
    });
    return deepMerge(struct.fork(), {
      Launchers: new Struct({
        [launcherIndex]: new Struct({
          Connections: new Struct({
            [connectionIndex]: new Struct({
              Name: "True",
            }),
          }),
        }),
      }),
    }).fork(true);
  }
  // Replace Random nodes with Technical pass-through so all quest options appear simultaneously
  if (RSQRandomizerQuestNodesSet.has(struct.SID)) {
    const dependants = context.array
      .filter(
        (s) =>
          s.Launchers instanceof Struct &&
          s.Launchers.entries().some(([, l]) => l.Connections instanceof Struct && l.Connections.entries().some(([, c]) => c.SID === struct.SID)),
      )
      .map((s) => s.SID);
    return rerouteRandomToTechnical(struct as QuestNodePrototype, context as MetaContext<QuestNodePrototype>, dependants);
  }
}

function rerouteRandomToTechnical(struct: QuestNodePrototype, context: MetaContext<QuestNodePrototype>, dependants: string[]) {
  const techSID = struct.SID.replace("_Random", "_Technical");
  // Strip Random node's launchers (deactivate it)
  const randomFork = struct.fork();
  randomFork.Launchers = new Struct() as any;

  // Create new Technical node inheriting Random's launchers
  const techNode = new Struct() as QuestNodePrototypeTechnical;
  techNode.__internal__.isRoot = true;
  techNode.__internal__.rawName = techSID;
  techNode.SID = techSID;
  techNode.QuestSID = (struct as QuestNodePrototypeRandom).QuestSID;
  techNode.NodeType = "EQuestNodeType::Technical";
  techNode.StartDelay = 0;
  techNode.LaunchOnQuestStart = false;
  techNode.Launchers = (struct as QuestNodePrototypeRandom).Launchers.clone();

  const structs: Struct[] = [randomFork, techNode];

  // Reroute dependants: patch connection from Random → Technical, clear Name
  for (const sid of dependants) {
    const target = context.structsById[sid];
    if (!target?.Launchers) continue;

    const launcherPatches: Record<string, any> = {};
    target.Launchers.entries().forEach(([lIdx, launcher]) => {
      if (!(launcher.Connections instanceof Struct)) return;
      const connectionPatches: Record<string, any> = {};
      launcher.Connections.entries().forEach(([cIdx, conn]) => {
        if (conn.SID === struct.SID) {
          connectionPatches[cIdx] = new Struct({ SID: techSID, Name: "" });
        }
      });
      if (Object.keys(connectionPatches).length > 0) {
        launcherPatches[lIdx] = new Struct({ Connections: new Struct(connectionPatches) });
      }
    });
    if (Object.keys(launcherPatches).length > 0) {
      structs.push(deepMerge(target.fork(), { Launchers: new Struct(launcherPatches) }).fork(true));
    }
  }

  return structs;
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
