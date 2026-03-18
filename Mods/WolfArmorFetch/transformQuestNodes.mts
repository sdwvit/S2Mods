import { Struct } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { getLaunchers } from "../../src/struct-utils.mts";

const Q = "WolfArmorFetch";
const WOLF_GUID = "927B9C2A43F721EC11E6C486D0DDFA0F";
const STASH_GUID = "1DFF64AA468013EBAE934D8F3B8F980B";
const PLAYER = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const ITEM = "HeavyBattle_Spark_Armor";

function node(SID: string, fields: Record<string, unknown>) {
  const s = new Struct({ __internal__: { rawName: SID, isRoot: true }, SID, QuestSID: Q, ...fields });
  return s;
}

function setDialog(SID: string, launcherConfig: { SID: string; Name?: string }[], chain: string, lastPhrases: string[], memberGuid: string) {
  const LastPhrases = new Struct();
  lastPhrases.forEach((lp) => LastPhrases.addNode(new Struct({ FinishNode: true, LastPhraseSID: lp })));

  const DialogMembers = new Struct();
  DialogMembers.addNode(memberGuid);

  const TalkThroughRadio = new Struct();
  TalkThroughRadio.addNode(false);

  const DialogObjectLocation = new Struct();
  DialogObjectLocation.addNode(new Struct({ X: 0, Y: 0, Z: 0 }));

  const OutputPinNames = new Struct();
  OutputPinNames.addNode("End");
  OutputPinNames.addNode("Interrupt");

  return node(SID, {
    NodePrototypeVersion: 2,
    NodeType: "EQuestNodeType::SetDialog",
    OutputPinNames,
    Launchers: getLaunchers(launcherConfig),
    LastPhrases,
    DialogChainPrototypeSID: chain,
    DialogMembers,
    TalkThroughRadio,
    DialogObjectLocation,
    NPCToStartDialog: -1,
    StartForcedDialog: false,
    WaitAllDialogEndingsToFinish: false,
    IsComment: false,
    OverrideDialogTopic: "EOverrideDialogTopic::Info",
    CanExitAnytime: false,
    ContinueThroughRadio: false,
    CallPlayer: false,
    SeekPlayer: false,
    CallPlayerRadius: 1000,
  });
}

let once = false;

export const transformQuestNodes: StructTransformer<Struct> = () => {
  if (once) return;
  once = true;

  return [
    // 1. Bootstrap
    node(`${Q}_Start`, {
      NodeType: "EQuestNodeType::Technical",
      StartDelay: 0,
      LaunchOnQuestStart: true,
    }),

    // 2. Journal: quest start
    node(`${Q}_SetJournal_QuestStart`, {
      NodeType: "EQuestNodeType::SetJournal",
      Launchers: getLaunchers([{ SID: `${Q}_Start` }]),
      JournalEntity: "EJournalEntity::Quest",
      JournalAction: "EJournalAction::Start",
      JournalQuestSID: Q,
      JournalQuestDescriptionIndex: 0,
      SetQuestActive: false,
    }),

    // 3. Accept dialog on Wolf
    setDialog(
      `${Q}_AcceptDialog`,
      [{ SID: `${Q}_Start` }, { SID: `${Q}_Technical_ReOffer` }],
      `${Q}_Dialog_Accept`,
      [`${Q}_Dialog_Accept_Accepted_1`, `${Q}_Dialog_Accept_Declined_1`],
      WOLF_GUID,
    ),

    // 4. Re-offer after decline
    node(`${Q}_Technical_ReOffer`, {
      NodeType: "EQuestNodeType::Technical",
      Launchers: getLaunchers([{ SID: `${Q}_AcceptDialog`, Name: `${Q}_Dialog_Accept_Declined_1` }]),
      StartDelay: 5,
    }),

    // 5. Journal: find armor stage
    node(`${Q}_SetJournal_FindArmor`, {
      NodeType: "EQuestNodeType::SetJournal",
      Launchers: getLaunchers([{ SID: `${Q}_AcceptDialog`, Name: `${Q}_Dialog_Accept_Accepted_1` }]),
      JournalEntity: "EJournalEntity::QuestStage",
      JournalAction: "EJournalAction::Start",
      JournalQuestSID: Q,
      JournalQuestStageSID: `${Q}_FindArmor`,
    }),

    // 6. Listen for item pickup
    node(`${Q}_ListenItem`, {
      NodeType: "EQuestNodeType::OnPlayerGetItemEvent",
      Launchers: getLaunchers([{ SID: `${Q}_AcceptDialog`, Name: `${Q}_Dialog_Accept_Accepted_1` }]),
      EventType: "EQuestEventType::OnPlayerGetItem",
      TrackBeforeActive: false,
      ItemPrototypeSID: ITEM,
      ExpectedItemsCount: 1,
      WithEquipped: true,
    }),

    // 7. Journal: find armor done
    node(`${Q}_SetJournal_FindArmorDone`, {
      NodeType: "EQuestNodeType::SetJournal",
      Launchers: getLaunchers([{ SID: `${Q}_ListenItem` }]),
      JournalEntity: "EJournalEntity::QuestStage",
      JournalAction: "EJournalAction::Finish",
      JournalQuestSID: Q,
      JournalQuestStageSID: `${Q}_FindArmor`,
    }),

    // 8. Journal: return to Wolf (with marker)
    (() => {
      const Markers = new Struct();
      Markers.addNode(new Struct({ MarkerTargetQuestGuid: WOLF_GUID, AddOnCondition: false, RemoveOnCondition: false }));
      return node(`${Q}_SetJournal_ReturnToWolf`, {
        NodeType: "EQuestNodeType::SetJournal",
        Launchers: getLaunchers([{ SID: `${Q}_ListenItem` }]),
        JournalEntity: "EJournalEntity::QuestStage",
        JournalAction: "EJournalAction::Start",
        JournalQuestSID: Q,
        JournalQuestStageSID: `${Q}_ReturnToWolf`,
        Markers,
      });
    })(),

    // 9. Turn-in dialog on Wolf
    setDialog(
      `${Q}_TurnInDialog`,
      [{ SID: `${Q}_ListenItem` }],
      `${Q}_Dialog_TurnIn`,
      [`${Q}_Dialog_TurnIn_Done_1`],
      WOLF_GUID,
    ),

    // 10. Remove armor from player
    node(`${Q}_RemoveArmor`, {
      NodeType: "EQuestNodeType::ItemRemove",
      Launchers: getLaunchers([{ SID: `${Q}_TurnInDialog`, Name: `${Q}_Dialog_TurnIn_Done_1` }]),
      TargetQuestGuid: PLAYER,
      ItemSID: ITEM,
      ItemsCount: 1,
    }),

    // 11. Money reward
    node(`${Q}_MoneyReward`, {
      NodeType: "EQuestNodeType::SetItemGenerator",
      Launchers: getLaunchers([{ SID: `${Q}_RemoveArmor` }]),
      TargetQuestGuid: PLAYER,
      ReplaceInventory: false,
      EquipItems: false,
      ItemGeneratorSID: `${Q}_MoneyReward`,
    }),

    // 12. Force spawn stash in the world (fire-and-forget, no success output)
    node(`${Q}_SpawnStash`, {
      NodeType: "EQuestNodeType::Spawn",
      Launchers: getLaunchers([{ SID: `${Q}_MoneyReward` }]),
      TargetQuestGuid: STASH_GUID,
      SpawnHidden: false,
      SpawnNodeExcludeType: "ESpawnNodeExcludeType::SeamlessDespawn",
    }),

    // 13. Delay to let stash spawn before giving clue
    node(`${Q}_SpawnStashDelay`, {
      NodeType: "EQuestNodeType::Technical",
      Launchers: getLaunchers([{ SID: `${Q}_MoneyReward` }]),
      StartDelay: 0.1,
    }),

    // 14. Reveal stash on PDA
    node(`${Q}_RevealStash`, {
      NodeType: "EQuestNodeType::GiveCache",
      Launchers: getLaunchers([{ SID: `${Q}_SpawnStashDelay` }]),
      TargetQuestGuid: STASH_GUID,
    }),

    // 15. Populate stash with exo
    node(`${Q}_PopulateStash`, {
      NodeType: "EQuestNodeType::SetItemGenerator",
      Launchers: getLaunchers([{ SID: `${Q}_RevealStash` }]),
      TargetQuestGuid: STASH_GUID,
      ReplaceInventory: false,
      EquipItems: false,
      ItemGeneratorSID: `${Q}_StashReward`,
    }),

    // 16. Journal: return stage done
    node(`${Q}_SetJournal_ReturnDone`, {
      NodeType: "EQuestNodeType::SetJournal",
      Launchers: getLaunchers([{ SID: `${Q}_PopulateStash` }]),
      JournalEntity: "EJournalEntity::QuestStage",
      JournalAction: "EJournalAction::Finish",
      JournalQuestSID: Q,
      JournalQuestStageSID: `${Q}_ReturnToWolf`,
    }),

    // 17. Journal: quest finish
    node(`${Q}_SetJournal_QuestFinish`, {
      NodeType: "EQuestNodeType::SetJournal",
      Launchers: getLaunchers([{ SID: `${Q}_SetJournal_ReturnDone` }]),
      JournalEntity: "EJournalEntity::Quest",
      JournalAction: "EJournalAction::Finish",
      JournalQuestSID: Q,
    }),

    // 18. End
    node(`${Q}_End`, {
      NodeType: "EQuestNodeType::End",
      Launchers: getLaunchers([{ SID: `${Q}_SetJournal_QuestFinish` }]),
      ExcludeAllNodesInContainer: true,
    }),
  ];
};
transformQuestNodes.files = ["/QuestNodePrototypes/SQ86.cfg"];
