import { Struct } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { getLaunchers } from "../../src/struct-utils.mts";
import {
  ACCEPT,
  DECIDER_ACCEPT,
  DECIDER_DOUBT,
  DECIDER_ITEM,
  DECIDER_TURNIN,
  DECIDER_ACCEPTED,
  FALCON_ACCEPTED,
  FALCON_GIVE,
  FALCON_ITEM as ITEM,
  FALCON_OFFER_DELAY_HOURS,
  TURNIN,
} from "./dialog.mts";
import { INSTALLED_EFFECT_SID as HEADLESS_ARMORS_INSTALLED } from "../HeadlessArmors/installed.mts";
import { PLAYER_GUID as PLAYER, Q, WOLF_GUID, hasRun, onDialogEnding, questNode } from "./nodes.mts";
import { allOf, hasEffect, itemInContainer } from "./conditions.mts";
import { coverNodes } from "./coverNodes.mts";
import { REWARD_STASH_GUID as STASH_GUID } from "./coverPrototypes.mts";

const node = (SID: string, fields: Record<string, unknown>) => questNode(Q, SID, fields);

/** The Decider's nodes carry this prefix; its journal entry is a quest of its own. */
const QD = `${Q}_Decider`;

/** A journal stage of `quest` with a marker on Wolf. */
function returnToWolfStage(SID: string, launcher: string, quest: string, stage: string) {
  const Markers = new Struct();
  Markers.addNode(new Struct({ MarkerTargetQuestGuid: WOLF_GUID, AddOnCondition: false, RemoveOnCondition: false }));
  return node(SID, {
    NodeType: "EQuestNodeType::SetJournal",
    Launchers: getLaunchers([{ SID: launcher }]),
    JournalEntity: "EJournalEntity::QuestStage",
    JournalAction: "EJournalAction::Start",
    JournalQuestSID: quest,
    JournalQuestStageSID: stage,
    Markers,
  });
}

/**
 * Wolf's first job: bring him the Decider. Accepting starts its journal entry; carrying the gun moves
 * it to "bring it to Wolf"; Wolf pays mid-hand-in, on his "this is for you" line (see dialog.mts), and
 * the gun is taken once the hand-in ends. The Falcon job is offered after it
 * (see transformRookieVillageHub).
 */
function deciderNodes() {
  return [
    onDialogEnding(`${QD}_OnAccepted`, DECIDER_ACCEPT, DECIDER_ACCEPTED),
    onDialogEnding(`${QD}_OnHandedIn`, DECIDER_TURNIN, DECIDER_DOUBT),

    // Side-quest marker on Wolf while the job is on offer, removed once it is accepted.
    node(`${QD}_SetQuestGiver_Wolf`, {
      NodePrototypeVersion: 1,
      NodeType: "EQuestNodeType::SetQuestGiver",
      Launchers: getLaunchers([{ SID: `${Q}_Start` }, { SID: `${QD}_OnAccepted`, Excluding: true }]),
      TargetQuestGuid: WOLF_GUID,
      MainQuest: false,
      MarkerDescription: "",
    }),

    node(`${QD}_SetJournal_QuestStart`, {
      NodeType: "EQuestNodeType::SetJournal",
      Launchers: getLaunchers([{ SID: `${QD}_OnAccepted` }]),
      JournalEntity: "EJournalEntity::Quest",
      JournalAction: "EJournalAction::Start",
      JournalQuestSID: QD,
      JournalQuestDescriptionIndex: 0,
      SetQuestActive: false,
    }),
    node(`${QD}_SetJournal_FindGun`, {
      NodeType: "EQuestNodeType::SetJournal",
      Launchers: getLaunchers([{ SID: `${QD}_SetJournal_QuestStart` }]),
      JournalEntity: "EJournalEntity::QuestStage",
      JournalAction: "EJournalAction::Start",
      JournalQuestSID: QD,
      JournalQuestStageSID: `${QD}_FindGun`,
    }),
    node(`${QD}_ListenItem`, {
      NodeType: "EQuestNodeType::OnPlayerGetItemEvent",
      Launchers: getLaunchers([{ SID: `${QD}_OnAccepted` }]),
      EventType: "EQuestEventType::OnPlayerGetItem",
      TrackBeforeActive: false,
      ItemPrototypeSID: DECIDER_ITEM,
      ExpectedItemsCount: 1,
      WithEquipped: true,
    }),
    node(`${QD}_SetJournal_FindGunDone`, {
      NodeType: "EQuestNodeType::SetJournal",
      Launchers: getLaunchers([{ SID: `${QD}_ListenItem` }]),
      JournalEntity: "EJournalEntity::QuestStage",
      JournalAction: "EJournalAction::Finish",
      JournalQuestSID: QD,
      JournalQuestStageSID: `${QD}_FindGun`,
    }),
    returnToWolfStage(`${QD}_SetJournal_ReturnToWolf`, `${QD}_ListenItem`, QD, `${QD}_ReturnToWolf`),

    node(`${QD}_RemoveGun`, {
      NodeType: "EQuestNodeType::ItemRemove",
      Launchers: getLaunchers([{ SID: `${QD}_OnHandedIn` }]),
      TargetQuestGuid: PLAYER,
      ItemSID: DECIDER_ITEM,
      ItemsCount: 1,
    }),
    node(`${QD}_SetJournal_ReturnDone`, {
      NodeType: "EQuestNodeType::SetJournal",
      Launchers: getLaunchers([{ SID: `${QD}_RemoveGun` }]),
      JournalEntity: "EJournalEntity::QuestStage",
      JournalAction: "EJournalAction::Finish",
      JournalQuestSID: QD,
      JournalQuestStageSID: `${QD}_ReturnToWolf`,
    }),
    node(`${QD}_SetJournal_QuestFinish`, {
      NodeType: "EQuestNodeType::SetJournal",
      Launchers: getLaunchers([{ SID: `${QD}_SetJournal_ReturnDone` }]),
      JournalEntity: "EJournalEntity::Quest",
      JournalAction: "EJournalAction::Finish",
      JournalQuestSID: QD,
    }),
  ];
}

/** The Falcon stash's failsafe: checked once, 10 s after the fill. */
function stashRetry() {
  const R = `${Q}_StashRetry`;
  return [
    node(`${R}_Delay`, {
      NodeType: "EQuestNodeType::Technical",
      Launchers: getLaunchers([{ SID: `${Q}_PopulateStash` }, { SID: `${Q}_PopulateStashHeadless` }]),
      StartDelay: 10,
    }),
    node(`${R}_If_Empty`, {
      NodePrototypeVersion: 1,
      NodeType: "EQuestNodeType::If",
      Launchers: getLaunchers([{ SID: `${R}_Delay` }]),
      Conditions: allOf(
        ["Exoskeleton_Neutral_Armor", "Exoskeleton_Neutral_Armor_headless"].map((item) => itemInContainer(STASH_GUID, item, "Equal", 0)),
      ),
    }),
    node(`${R}_Spawn`, {
      NodeType: "EQuestNodeType::Spawn",
      Launchers: getLaunchers([{ SID: `${R}_If_Empty`, Name: "True" }]),
      TargetQuestGuid: STASH_GUID,
      SpawnHidden: false,
      SpawnNodeExcludeType: "ESpawnNodeExcludeType::SeamlessDespawn",
    }),
    node(`${R}_RevealDelay`, {
      NodeType: "EQuestNodeType::Technical",
      Launchers: getLaunchers([{ SID: `${R}_If_Empty`, Name: "True" }]),
      StartDelay: 1,
    }),
    node(`${R}_Reveal`, {
      NodeType: "EQuestNodeType::GiveCache",
      Launchers: getLaunchers([{ SID: `${R}_RevealDelay` }]),
      TargetQuestGuid: STASH_GUID,
    }),
    node(`${R}_FillDelay`, {
      NodeType: "EQuestNodeType::Technical",
      Launchers: getLaunchers([{ SID: `${R}_Reveal` }]),
      StartDelay: 1,
    }),
    node(`${R}_If_HeadlessArmors`, {
      NodePrototypeVersion: 1,
      NodeType: "EQuestNodeType::If",
      Launchers: getLaunchers([{ SID: `${R}_FillDelay` }]),
      Conditions: allOf([hasEffect(HEADLESS_ARMORS_INSTALLED)]),
    }),
    node(`${R}_Populate`, {
      NodeType: "EQuestNodeType::SetItemGenerator",
      Launchers: getLaunchers([{ SID: `${R}_If_HeadlessArmors`, Name: "False" }]),
      TargetQuestGuid: STASH_GUID,
      ReplaceInventory: false,
      EquipItems: false,
      ItemGeneratorSID: `${Q}_StashReward`,
    }),
    node(`${R}_PopulateHeadless`, {
      NodeType: "EQuestNodeType::SetItemGenerator",
      Launchers: getLaunchers([{ SID: `${R}_If_HeadlessArmors`, Name: "True" }]),
      TargetQuestGuid: STASH_GUID,
      ReplaceInventory: false,
      EquipItems: false,
      ItemGeneratorSID: `${Q}_StashRewardHeadless`,
    }),
  ];
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

    // Wolf's two dialogs belong to RookieVillage_Hub (see transformRookieVillageHub), which re-attaches
    // them along with his own topics. This quest hears how they end.
    onDialogEnding(`${Q}_OnAccepted`, ACCEPT, FALCON_ACCEPTED),
    onDialogEnding(`${Q}_OnHandedIn`, TURNIN, FALCON_GIVE),

    ...deciderNodes(),

    // The Falcon job is offered a day after the Decider hand-in (the hub runs its own timer for the
    // dialog, see transformRookieVillageHub).
    node(`${Q}_FalconOfferTimer`, {
      NodePrototypeVersion: 1,
      NodeType: "EQuestNodeType::SetTimer",
      Launchers: getLaunchers([{ SID: `${QD}_OnHandedIn` }]),
      InGameHours: FALCON_OFFER_DELAY_HOURS,
    }),

    // Side-quest marker on Wolf while the job is on offer: shown once the offer timer runs out,
    // removed (the Excluding launcher, as vanilla E02_SQ01 does) once the job is accepted. A decline
    // keeps it.
    node(`${Q}_SetQuestGiver_Wolf`, {
      NodePrototypeVersion: 1,
      NodeType: "EQuestNodeType::SetQuestGiver",
      Launchers: getLaunchers([
        { SID: `${Q}_FalconOfferTimer` },
        { SID: `${Q}_OnAccepted`, Excluding: true },
      ]),
      TargetQuestGuid: WOLF_GUID,
      MainQuest: false,
      MarkerDescription: "",
    }),

    // 2. Journal: quest start, only once the job is taken
    node(`${Q}_SetJournal_QuestStart`, {
      NodeType: "EQuestNodeType::SetJournal",
      Launchers: getLaunchers([{ SID: `${Q}_OnAccepted` }]),
      JournalEntity: "EJournalEntity::Quest",
      JournalAction: "EJournalAction::Start",
      JournalQuestSID: Q,
      JournalQuestDescriptionIndex: 0,
      SetQuestActive: false,
    }),

    // 3. Journal: find armor stage
    node(`${Q}_SetJournal_FindArmor`, {
      NodeType: "EQuestNodeType::SetJournal",
      Launchers: getLaunchers([{ SID: `${Q}_SetJournal_QuestStart` }]),
      JournalEntity: "EJournalEntity::QuestStage",
      JournalAction: "EJournalAction::Start",
      JournalQuestSID: Q,
      JournalQuestStageSID: `${Q}_FindArmor`,
    }),

    // 4. Listen for item pickup (journal only)
    node(`${Q}_ListenItem`, {
      NodeType: "EQuestNodeType::OnPlayerGetItemEvent",
      Launchers: getLaunchers([{ SID: `${Q}_OnAccepted` }]),
      EventType: "EQuestEventType::OnPlayerGetItem",
      TrackBeforeActive: false,
      ItemPrototypeSID: ITEM,
      ExpectedItemsCount: 1,
      WithEquipped: true,
    }),

    // 5. Journal: find armor done
    node(`${Q}_SetJournal_FindArmorDone`, {
      NodeType: "EQuestNodeType::SetJournal",
      Launchers: getLaunchers([{ SID: `${Q}_ListenItem` }]),
      JournalEntity: "EJournalEntity::QuestStage",
      JournalAction: "EJournalAction::Finish",
      JournalQuestSID: Q,
      JournalQuestStageSID: `${Q}_FindArmor`,
    }),

    // 6. Journal: return to Wolf (with marker)
    returnToWolfStage(`${Q}_SetJournal_ReturnToWolf`, `${Q}_ListenItem`, Q, `${Q}_ReturnToWolf`),

    // 7. Remove armor from player
    node(`${Q}_RemoveArmor`, {
      NodeType: "EQuestNodeType::ItemRemove",
      Launchers: getLaunchers([{ SID: `${Q}_OnHandedIn` }]),
      TargetQuestGuid: PLAYER,
      ItemSID: ITEM,
      ItemsCount: 1,
    }),

    // 8. Money reward
    node(`${Q}_MoneyReward`, {
      NodeType: "EQuestNodeType::SetItemGenerator",
      Launchers: getLaunchers([{ SID: `${Q}_RemoveArmor` }]),
      TargetQuestGuid: PLAYER,
      ReplaceInventory: false,
      EquipItems: false,
      ItemGeneratorSID: `${Q}_MoneyReward`,
    }),

    // 9. Force spawn stash in the world (fire-and-forget, no success output)
    node(`${Q}_SpawnStash`, {
      NodeType: "EQuestNodeType::Spawn",
      Launchers: getLaunchers([{ SID: `${Q}_MoneyReward` }]),
      TargetQuestGuid: STASH_GUID,
      SpawnHidden: false,
      SpawnNodeExcludeType: "ESpawnNodeExcludeType::SeamlessDespawn",
    }),

    // 10. Delay to let stash spawn before giving clue
    node(`${Q}_SpawnStashDelay`, {
      NodeType: "EQuestNodeType::Technical",
      Launchers: getLaunchers([{ SID: `${Q}_MoneyReward` }]),
      StartDelay: 0.1,
    }),

    // 11. Reveal stash on PDA
    node(`${Q}_RevealStash`, {
      NodeType: "EQuestNodeType::GiveCache",
      Launchers: getLaunchers([{ SID: `${Q}_SpawnStashDelay` }]),
      TargetQuestGuid: STASH_GUID,
    }),

    // 12. Populate stash with an exo: HeadlessArmors' headless one when that mod is installed, the
    // full suit otherwise. HeadlessArmors puts its flag effect on the player on every world load, so the
    // If checks the player for it: True gives the headless one, False the full suit
    // (see DesignDocs/DetectInstalledModSpec.md).
    // A moment after the stash is revealed, so it has spawned before it is filled.
    node(`${Q}_StashFillDelay`, {
      NodeType: "EQuestNodeType::Technical",
      Launchers: getLaunchers([{ SID: `${Q}_RevealStash` }]),
      StartDelay: 1,
    }),
    node(`${Q}_If_HeadlessArmors`, {
      NodePrototypeVersion: 1,
      NodeType: "EQuestNodeType::If",
      Launchers: getLaunchers([{ SID: `${Q}_StashFillDelay` }]),
      Conditions: new Struct({
        0: new Struct({
          0: new Struct({
            ConditionType: "EQuestConditionType::Effect",
            ConditionComparance: "EConditionComparance::Equal",
            TargetCharacter: PLAYER,
            EffectPrototypeSID: HEADLESS_ARMORS_INSTALLED,
            RequiredSquadMembers: "ERequiredSquadMembers::AllMembers",
          }),
        }),
      }),
    }),
    node(`${Q}_PopulateStash`, {
      NodeType: "EQuestNodeType::SetItemGenerator",
      Launchers: getLaunchers([{ SID: `${Q}_If_HeadlessArmors`, Name: "False" }]),
      TargetQuestGuid: STASH_GUID,
      ReplaceInventory: false,
      EquipItems: false,
      ItemGeneratorSID: `${Q}_StashReward`,
    }),
    node(`${Q}_PopulateStashHeadless`, {
      NodeType: "EQuestNodeType::SetItemGenerator",
      Launchers: getLaunchers([{ SID: `${Q}_If_HeadlessArmors`, Name: "True" }]),
      TargetQuestGuid: STASH_GUID,
      ReplaceInventory: false,
      EquipItems: false,
      ItemGeneratorSID: `${Q}_StashRewardHeadless`,
    }),

    // 12b. A second try, if the stash still holds neither exo 10 s on: spawn, reveal and fill it again.
    ...stashRetry(),

    // 13. Journal: return stage done
    node(`${Q}_SetJournal_ReturnDone`, {
      NodeType: "EQuestNodeType::SetJournal",
      Launchers: getLaunchers([{ SID: `${Q}_PopulateStash` }, { SID: `${Q}_PopulateStashHeadless` }]),
      JournalEntity: "EJournalEntity::QuestStage",
      JournalAction: "EJournalAction::Finish",
      JournalQuestSID: Q,
      JournalQuestStageSID: `${Q}_ReturnToWolf`,
    }),

    // 14. Journal: quest finish
    node(`${Q}_SetJournal_QuestFinish`, {
      NodeType: "EQuestNodeType::SetJournal",
      Launchers: getLaunchers([{ SID: `${Q}_SetJournal_ReturnDone` }]),
      JournalEntity: "EJournalEntity::Quest",
      JournalAction: "EJournalAction::Finish",
      JournalQuestSID: Q,
    }),

    // 15. Both jobs finished, whichever finishes last: the hub reads this node (If_QuestEnded). A
    // Technical: an End node excludes every node of the quest, and an excluded Spawn node despawns
    // what it spawned, which took the Falcon's stash a moment after it appeared. Vanilla's reward
    // quests that spawn a stash (EQ155_P) have no End either. Older saves ran a real End here.
    node(`${Q}_If_DeciderFinished`, {
      NodePrototypeVersion: 1,
      NodeType: "EQuestNodeType::If",
      Launchers: getLaunchers([{ SID: `${Q}_SetJournal_QuestFinish` }]),
      Conditions: hasRun(`${QD}_SetJournal_QuestFinish`),
    }),
    node(`${QD}_If_FalconFinished`, {
      NodePrototypeVersion: 1,
      NodeType: "EQuestNodeType::If",
      Launchers: getLaunchers([{ SID: `${QD}_SetJournal_QuestFinish` }]),
      Conditions: hasRun(`${Q}_SetJournal_QuestFinish`),
    }),
    node(`${Q}_End`, {
      NodeType: "EQuestNodeType::Technical",
      Launchers: getLaunchers([
        { SID: `${Q}_If_DeciderFinished`, Name: "True" },
        { SID: `${QD}_If_FalconFinished`, Name: "True" },
      ]),
    }),

    // Job 3, Cover Story: a quest of its own (see ./cover.mts).
    ...coverNodes(),
  ];
};
transformQuestNodes.files = ["/QuestNodePrototypes/SQ86.cfg"];
