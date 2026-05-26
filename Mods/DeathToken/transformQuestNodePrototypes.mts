import { Struct } from "s2cfgtojson";
import type {
  QuestNodePrototype,
  QuestNodePrototypeConsoleCommand,
  QuestNodePrototypeItemAdd,
  QuestNodePrototypeOnNPCDeathEvent,
} from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { modName } from "../../src/base-paths.mts";
import { getLaunchers } from "../../src/struct-utils.mts";
import { DEATH_TOKEN_ITEM_SID } from "./addDeathTokenItem.mts";

const SKIF_GUID = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

let once = false;

export const transformQuestNodePrototypes: StructTransformer<QuestNodePrototype> = (
  struct,
  context,
) => {
  if (!context.filePath.endsWith("/QuestNodePrototypes/rootgraph.cfg") || once) {
    return;
  }
  once = true;

  const onSkifDeathSID = `${modName}_OnSkifDeath`;

  const onSkifDeath = new Struct() as QuestNodePrototypeOnNPCDeathEvent;
  onSkifDeath.SID = onSkifDeathSID;
  onSkifDeath.QuestSID = modName;
  onSkifDeath.NodeType = "EQuestNodeType::OnNPCDeathEvent";
  onSkifDeath.LaunchOnQuestStart = true;
  onSkifDeath.Repeatable = true;
  onSkifDeath.EventType = "EQuestEventType::OnObjDeath";
  onSkifDeath.TrackBeforeActive = false;
  onSkifDeath.TargetQuestGuid = SKIF_GUID;
  onSkifDeath.__internal__.isRoot = true;
  onSkifDeath.__internal__.rawName = onSkifDeathSID;

  const addToken = new Struct() as QuestNodePrototypeItemAdd;
  addToken.SID = `${modName}_AddToken`;
  addToken.QuestSID = modName;
  addToken.NodeType = "EQuestNodeType::ItemAdd";
  addToken.Repeatable = true;
  addToken.ItemSID = DEATH_TOKEN_ITEM_SID;
  addToken.ItemsCount = 1;
  addToken.AddToPlayerStash = false;
  addToken.TargetQuestGuid = SKIF_GUID;
  addToken.Launchers = getLaunchers([onSkifDeath]);
  addToken.__internal__.isRoot = true;
  addToken.__internal__.rawName = addToken.SID;

  const launchSID = `${struct.QuestSID}_run_${modName}`;
  const launchNode = new Struct({
    ConsoleCommand: `XStartQuestNodeBySID ${onSkifDeathSID}`,
    NodeType: "EQuestNodeType::ConsoleCommand",
    QuestSID: struct.QuestSID,
    SID: launchSID,
    Launchers: getLaunchers([{ SID: "rootgraph_Start" }]),
    __internal__: {
      rawName: launchSID,
      isRoot: true,
    },
  }) as QuestNodePrototypeConsoleCommand;

  return [launchNode, onSkifDeath, addToken];
};

transformQuestNodePrototypes.files = ["/QuestNodePrototypes/rootgraph.cfg"];
