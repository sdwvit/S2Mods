import { Struct } from "s2cfgtojson";
import { getLaunchers } from "../../src/struct-utils.mts";
import { installedEffectSid } from "../../src/announce-installed.mts";
import { FALCON_GIVE, TURNIN, lastLineSID } from "./dialog.mts";
import {
  COVER_ACCEPT,
  COVER_ACCEPTED,
  COVER_PAYOFF,
  COVER_TURNIN,
  FAVOR,
  FAVOR_ACCEPTED,
  HOOK,
  HOOK_COMMENT,
  MEETING,
  MEETING_INTEL,
  MEETING_LOUD,
} from "./coverDialog.mts";
import {
  COVER_OFFER_DELAY_HOURS,
  DEALER_NOTE,
  CREW,
  DEALER_PDA,
  DEALERS,
  DECIDER_ITEM,
  DIE,
  GUARDS,
  GUID,
  HOOK_NOTE,
  HOOK_PDA,
  NAME_NOTE,
  POS,
  QC,
  RARE_WARD_BADGE,
  ROLLS,
  VAR,
  WARD_BADGE,
} from "./cover.mts";
import { PLAYER_GUID, allOf, globalVar, hasEffect, itemCount, nearNPC, nearPoint } from "./conditions.mts";
import { Q, WOLF_GUID, hasRun, onDialogEnding, questNode, ran, setDialog } from "./nodes.mts";

const node = (SID: string, fields: Record<string, unknown>) => questNode(QC, SID, fields);
type Launch = Parameters<typeof getLaunchers>[0];

const technical = (SID: string, launchers: Launch, StartDelay = 0) =>
  node(SID, { NodeType: "EQuestNodeType::Technical", Launchers: getLaunchers(launchers), StartDelay });

/** A checkpoint save, as vanilla's `EQ50_SaveGame_StartEQ`. */
const saveGame = (SID: string, launchers: Launch) =>
  node(SID, { NodePrototypeVersion: 1, NodeType: "EQuestNodeType::SaveGame", Launchers: getLaunchers(launchers) });

const ifNode = (SID: string, launchers: Launch, Conditions: Struct) =>
  node(SID, { NodePrototypeVersion: 1, NodeType: "EQuestNodeType::If", Launchers: getLaunchers(launchers), Conditions });

const setVar = (SID: string, launchers: Launch, variable: string, value: number, mode: "Set" | "Add" = "Set") =>
  node(SID, {
    NodePrototypeVersion: 2,
    NodeType: "EQuestNodeType::SetGlobalVariable",
    Launchers: getLaunchers(launchers),
    GlobalVariablePrototypeSID: variable,
    ChangeValueMode: `EChangeValueMode::${mode}`,
    VariableValue: value,
  });

const spawn = (SID: string, launchers: Launch, guid: string) =>
  node(SID, {
    NodeType: "EQuestNodeType::Spawn",
    Launchers: getLaunchers(launchers),
    TargetQuestGuid: guid,
    IgnoreDamageType: "EIgnoreDamageType::None",
    SpawnHidden: false,
    SpawnNodeExcludeType: "ESpawnNodeExcludeType::SeamlessDespawn",
  });

const despawn = (SID: string, launchers: Launch, guid: string) =>
  node(SID, {
    NodePrototypeVersion: 1,
    NodeType: "EQuestNodeType::Despawn",
    Launchers: getLaunchers(launchers),
    TargetQuestGuid: guid,
    SpawnNodeExcludeType: "ESpawnNodeExcludeType::SeamlessDespawn",
    SpecificItemDespawn: false,
  });

const itemAdd = (SID: string, launchers: Launch, guid: string, item: string) =>
  node(SID, {
    NodePrototypeVersion: 1,
    NodeType: "EQuestNodeType::ItemAdd",
    Launchers: getLaunchers(launchers),
    TargetQuestGuid: guid,
    ItemSID: item,
    ItemsCount: 1,
    AddToPlayerStash: false,
  });

const itemRemove = (SID: string, launchers: Launch, item: string) =>
  node(SID, {
    NodeType: "EQuestNodeType::ItemRemove",
    Launchers: getLaunchers(launchers),
    TargetQuestGuid: PLAYER_GUID,
    ItemSID: item,
    ItemsCount: 1,
  });

const onGetItem = (SID: string, launchers: Launch, item: string) =>
  node(SID, {
    NodeType: "EQuestNodeType::OnPlayerGetItemEvent",
    Launchers: getLaunchers(launchers),
    EventType: "EQuestEventType::OnPlayerGetItem",
    TrackBeforeActive: false,
    ItemPrototypeSID: item,
    ExpectedItemsCount: 1,
    WithEquipped: true,
  });

const onDeath = (SID: string, guid: string) =>
  node(SID, {
    NodePrototypeVersion: 1,
    NodeType: "EQuestNodeType::OnNPCDeathEvent",
    LaunchOnQuestStart: true,
    EventType: "EQuestEventType::OnObjDeath",
    TrackBeforeActive: false,
    TargetQuestGuid: guid,
  });

const addNote = (SID: string, launchers: Launch, note: string) =>
  node(SID, {
    NodePrototypeVersion: 1,
    NodeType: "EQuestNodeType::AddNote",
    Launchers: getLaunchers(launchers),
    NotePrototypeSID: note,
    PlayWhenReceived: false,
  });

const setItemGenerator = (SID: string, launchers: Launch, guid: string, generator: string) =>
  node(SID, {
    NodePrototypeVersion: 1,
    NodeType: "EQuestNodeType::SetItemGenerator",
    Launchers: getLaunchers(launchers),
    TargetQuestGuid: guid,
    ReplaceInventory: false,
    EquipItems: true,
    ItemGeneratorSID: generator,
  });

/** A `Condition` pin, re-checked on every tick: the parent launches on `[tick, pin]`. */
const tickPin = (SID: string, Conditions: Struct) =>
  node(SID, {
    NodePrototypeVersion: 1,
    NodeType: "EQuestNodeType::Condition",
    Launchers: getLaunchers([{ SID: `${QC}_OnTick` }]),
    Conditions,
  });
const onTickWhen = (pin: string): Launch => [[{ SID: `${QC}_OnTick`, Name: "" }, { SID: pin }]];

/** An AI behavior, shaped like vanilla SQ50_SetAIBehavior_Kastet_Stay (stay) and EQ88's follow. */
/**
 * `HigherThanALife`: the goal holds against wandering but gives way to a fight. `HigherThanCombat` kept
 * the dealers standing still under fire when the cover was blown.
 * `weaponState`: NPCs who talk stand unarmed (`NoWeapon`, as most vanilla Stay goals): an armed combat
 * stance has no dialog talking animations, so only the head moved.
 */
function aiBehavior(
  SID: string,
  launchers: Launch,
  guid: string,
  behavior: { stay: { x: number; y: number; z: number } } | { follow: string },
  weaponState = "EWeaponState::Combat",
  /** Stay only: how far the NPC looks for a contextual-action spot to use while he waits (vanilla 500-2000). */
  contextualRange?: number,
) {
  const common = {
    NodePrototypeVersion: 8,
    NodeType: "EQuestNodeType::SetAIBehavior",
    Launchers: getLaunchers(launchers),
    TargetQuestGuid: guid,
    GoalPriority: "EGoalPriority::HigherThanALife",
    IgnoreRadiationFeilds: false,
    IgnoreAnomalyFields: false,
    IgnoreEmission: false,
    IgnoreCombat: false,
    IgnoreThreat: false,
    FailureByEmission: false,
    FailureByCombat: false,
    FailureByThreat: false,
    FailureByTargetLost: false,
    FailureByPlayerKill: false,
    FailureByHumanKil: false,
    FailureByMutantKill: false,
    CanBeInterrupted: true,
    WeaponState: weaponState,
    UseSecondaryWeapon: false,
  };
  if ("stay" in behavior) {
    const { x, y, z } = behavior.stay;
    return node(SID, {
      ...common,
      BehaviorType: "EBehaviorType::Stay",
      MovementType: "EMovementBehaviour::Walk",
      IdlePosition: new Struct({ X: x, Y: y, Z: z }),
      LookAt: new Struct({ X: 0, Y: 0, Z: 0 }),
      ContextualActionLookAtPlayerRange: 10000,
      ...(contextualRange ? { ContextualActionRange: contextualRange } : {}),
      CanBeTeleported: true,
    });
  }
  return node(SID, {
    ...common,
    BehaviorType: "EBehaviorType::Follow",
    MovementPose: "EAIMovementPose::Stand",
    MovementType: "EMovementBehaviour::Run",
    FollowStartRange: 300,
    FollowStopRange: 600,
    GoalTargetQuestGuid: behavior.follow,
  });
}

const resetAI = (SID: string, launchers: Launch, guid: string) =>
  node(SID, { NodePrototypeVersion: 1, NodeType: "EQuestNodeType::ResetAI", Launchers: getLaunchers(launchers), TargetQuestGuid: guid });

/** `first` and `second` become enemies, personally (vanilla SQ92: preset 0 is Enemy). */
const makeEnemies = (SID: string, launchers: Launch, first: string, second: string) =>
  node(SID, {
    NodePrototypeVersion: 1,
    NodeType: "EQuestNodeType::ChangeRelationships",
    Launchers: getLaunchers(launchers),
    FirstTargetSID: first,
    SecondTargetSID: second,
    UseDeltaValue: false,
    UsePreset: true,
    RelationshipValue: 0,
    SetFactionRelationshipAsPersonal: false,
    ShouldLockPersonalRelationship: false,
  });

/** A journal stage of the Cover Story entry, optionally with a marker on `marker`. */
function stage(SID: string, launchers: Launch, name: string, action: "Start" | "Finish", marker?: string) {
  const fields: Record<string, unknown> = {
    NodeType: "EQuestNodeType::SetJournal",
    Launchers: getLaunchers(launchers),
    JournalEntity: "EJournalEntity::QuestStage",
    JournalAction: `EJournalAction::${action}`,
    JournalQuestSID: QC,
    JournalQuestStageSID: `${QC}_${name}`,
  };
  if (marker) {
    const Markers = new Struct();
    Markers.addNode(new Struct({ MarkerTargetQuestGuid: marker, AddOnCondition: false, RemoveOnCondition: false }));
    fields.Markers = Markers;
  }
  return node(SID, fields);
}

/**
 * A d20 into `variable`: a vanilla `Random` node (pins named by number, `PinWeights` the descending
 * cumulative thresholds, RSQ01_C01_Random) with one `SetGlobalVariable` per face.
 */
function rollDie(roll: (typeof ROLLS)[number], launchers: Launch) {
  const random = `${QC}_Random_${roll.name}`;
  const OutputPinNames = new Struct();
  const PinWeights = new Struct();
  for (let face = 0; face < DIE; face++) {
    OutputPinNames.addNode(String(face));
    PinWeights.addNode(Number((1 - (face + 1) / DIE).toFixed(6)));
  }
  return [
    node(random, { NodePrototypeVersion: 1, NodeType: "EQuestNodeType::Random", OutputPinNames, Launchers: getLaunchers(launchers), PinWeights }),
    ...Array.from({ length: DIE }, (_, face) =>
      setVar(`${random}_Face${face + 1}`, [{ SID: random, Name: String(face) }], roll.variable, face + 1),
    ),
  ];
}

/** +1 to every roll, launched by an `If`'s True pin. */
const bonus = (name: string, source: string) =>
  ROLLS.map((roll) => setVar(`${QC}_Bonus_${name}_${roll.name}`, [{ SID: source, Name: "True" }], roll.variable, 1, "Add"));

/**
 * Wolf's third job. Offered a day after the Falcon hand-in (on saves already past it, as soon as the
 * quest starts); Wolf's dialogs live in RookieVillage_Hub, the Sultan's in Skadovsk_Hub (see their
 * transformers), and this quest hears how they end.
 */
export function coverNodes() {
  const meetingEndings = [
    { label: MEETING_INTEL, finish: true },
    { label: MEETING_LOUD, finish: true },
  ];
  const meetingInterrupted = (SID: string) => ({ SID, Name: "Interrupt" });

  return [
    node(`${QC}_Start`, { NodeType: "EQuestNodeType::Technical", StartDelay: 0, LaunchOnQuestStart: true }),
    node(`${QC}_OnTick`, {
      NodeType: "EQuestNodeType::OnTickEvent",
      LaunchOnQuestStart: true,
      EventType: "EQuestEventType::OnTick",
      TrackBeforeActive: false,
    }),

    // 1. Ready a day after the Falcon hand-in, or at once on saves that are already past it.
    ifNode(`${QC}_If_FalconDone`, [{ SID: `${QC}_Start` }], hasRun(`${Q}_OnHandedIn`)),
    onDialogEnding(`${QC}_OnFalconHandedIn`, TURNIN, FALCON_GIVE, QC),
    node(`${QC}_OfferTimer`, {
      NodePrototypeVersion: 1,
      NodeType: "EQuestNodeType::SetTimer",
      Launchers: getLaunchers([{ SID: `${QC}_OnFalconHandedIn` }]),
      InGameHours: COVER_OFFER_DELAY_HOURS,
    }),
    technical(`${QC}_Ready`, [{ SID: `${QC}_If_FalconDone`, Name: "True" }, { SID: `${QC}_OfferTimer` }]),
    node(`${QC}_SetQuestGiver_Wolf`, {
      NodePrototypeVersion: 1,
      NodeType: "EQuestNodeType::SetQuestGiver",
      Launchers: getLaunchers([{ SID: `${QC}_Ready` }, { SID: `${QC}_OnAccepted`, Excluding: true }]),
      TargetQuestGuid: WOLF_GUID,
      MainQuest: false,
      MarkerDescription: "",
    }),

    // 2. Accepted: the journal, Wolf's Decider, and Hook out north of Sultansk.
    onDialogEnding(`${QC}_OnAccepted`, COVER_ACCEPT, COVER_ACCEPTED, QC),
    setItemGenerator(`${QC}_GiveDecider`, [{ SID: `${QC}_OnAccepted` }], PLAYER_GUID, `${QC}_DeciderGift`),
    node(`${QC}_SetJournal_QuestStart`, {
      NodeType: "EQuestNodeType::SetJournal",
      Launchers: getLaunchers([{ SID: `${QC}_OnAccepted` }]),
      JournalEntity: "EJournalEntity::Quest",
      JournalAction: "EJournalAction::Start",
      JournalQuestSID: QC,
      JournalQuestDescriptionIndex: 0,
      SetQuestActive: false,
    }),
    // Debug: `XStartQuestNodeBySID WolfArmorFetch_Cover_DebugHook` turns god mode on, teleports Skif 12 m north of Vasyan, spawns
    // him, his lads and the body, then plays his comment and his line to Skif, as if walked in.
    technical(`${QC}_DebugHook`, []),
    node(`${QC}_DebugHookTeleport`, {
      NodeType: "EQuestNodeType::ConsoleCommand",
      ConsoleCommand: `XTeleportTo ${POS.hook.x} ${POS.hook.y + 1200} ${POS.hook.z + 200}`,
      Launchers: getLaunchers([{ SID: `${QC}_DebugHook` }]),
    }),
    node(`${QC}_DebugHookGodMode`, {
      NodeType: "EQuestNodeType::ConsoleCommand",
      ConsoleCommand: "XSetGodMode true",
      Launchers: getLaunchers([{ SID: `${QC}_DebugHook` }]),
    }),
    technical(`${QC}_DebugHookComment`, [{ SID: `${QC}_DebugHook` }], 5),
    ifNode(`${QC}_DebugIfHookTalk`, [{ SID: `${QC}_HookCommentDone` }], hasRun(`${QC}_DebugHook`)),
    spawn(`${QC}_SpawnHook`, [{ SID: `${QC}_OnAccepted` }, { SID: `${QC}_DebugHook` }], GUID.hook),
    technical(`${QC}_HookSpawned`, [{ SID: `${QC}_SpawnHook` }], 1),
    aiBehavior(`${QC}_HookStay`, [{ SID: `${QC}_HookSpawned` }], GUID.hook, { stay: POS.hook }, "EWeaponState::NoWeapon", 500),
    // His lads and the stalker they robbed.
    ...CREW.flatMap((guid, i) => [
      spawn(`${QC}_SpawnCrew${i}`, [{ SID: `${QC}_OnAccepted` }, { SID: `${QC}_DebugHook` }], guid),
      aiBehavior(`${QC}_CrewStay${i}`, [{ SID: `${QC}_HookSpawned` }], guid, { stay: [POS.crew1, POS.crew2][i] }, undefined, 500),
    ]),
    spawn(`${QC}_SpawnCorpse`, [{ SID: `${QC}_OnAccepted` }, { SID: `${QC}_DebugHook` }], GUID.corpse),
    stage(`${QC}_SetJournal_FindGoBetween`, [{ SID: `${QC}_SetJournal_QuestStart` }], "FindGoBetween", "Start", GUID.hook),
    // His PDA goes in once he is surely online - the player close by, as vanilla EQ13 spawns Filimon
    // and fills his pockets - or onto his body if he is shot from further out.
    tickPin(`${QC}_HookPDA_Pin_0`, allOf([nearNPC(GUID.hook, 8000), ran(`${QC}_SpawnHook`)])),
    onDeath(`${QC}_OnHookDeath`, GUID.hook),
    itemAdd(`${QC}_HookPDA`, [...onTickWhen(`${QC}_HookPDA_Pin_0`), { SID: `${QC}_OnHookDeath` }], GUID.hook, HOOK_PDA),

    // Hook is one of the Sultan's (neutral): when Skif walks up he says one line and goes for him.
    // A save on the way in, 30 m out, before he can start anything.
    tickPin(`${QC}_SaveBeforeHook_Pin_0`, allOf([nearPoint(POS.hook, 3000), ran(`${QC}_HookSpawned`)])),
    saveGame(`${QC}_SaveBeforeHook`, onTickWhen(`${QC}_SaveBeforeHook_Pin_0`)),
    // At 10 m he is still busy with the stalker his lads robbed: a comment, his back to Skif. Then, once
    // Skif is at 5 m, he turns to him. A timeout stands in if the comment never reports its end.
    tickPin(`${QC}_HookComment_Pin_0`, allOf([nearPoint(POS.hook, 1000), ran(`${QC}_HookSpawned`)])),
    technical(`${QC}_HookCommentStart`, [...onTickWhen(`${QC}_HookComment_Pin_0`), { SID: `${QC}_DebugHookComment` }]),
    setDialog(QC, `${QC}_HookCommentDialog`, [{ SID: `${QC}_HookCommentStart` }], HOOK_COMMENT, [{ label: HOOK_COMMENT.opening, finish: true }], {
      npc: GUID.hook,
    }),
    technical(`${QC}_HookCommentDone`, [
      { SID: `${QC}_HookCommentDialog`, Name: lastLineSID(HOOK_COMMENT, HOOK_COMMENT.opening) },
      { SID: `${QC}_HookCommentDialog`, Name: "Interrupt" },
      { SID: `${QC}_HookCommentTimeout` },
    ]),
    technical(`${QC}_HookCommentTimeout`, [{ SID: `${QC}_HookCommentStart` }], 6),
    tickPin(`${QC}_HookTalk_Pin_0`, allOf([nearPoint(POS.hook, 500), ran(`${QC}_HookCommentDone`)])),
    technical(`${QC}_HookTalk`, [...onTickWhen(`${QC}_HookTalk_Pin_0`), { SID: `${QC}_DebugIfHookTalk`, Name: "True" }]),
    setDialog(QC, `${QC}_HookDialog`, [{ SID: `${QC}_HookTalk` }], HOOK, [{ label: HOOK.opening, finish: true }], {
      npc: GUID.hook,
      forced: true,
    }),
    // A SetDialog's ending pins are named after the ending's last line (vanilla SQ92's AfterFight).
    onDialogEnding(`${QC}_OnHookGreeted`, HOOK, HOOK.opening, QC),
    technical(`${QC}_HookFight`, [
      { SID: `${QC}_OnHookGreeted` },
      { SID: `${QC}_HookDialog`, Name: lastLineSID(HOOK, HOOK.opening) },
      { SID: `${QC}_HookDialog`, Name: "Interrupt" },
    ]),
    makeEnemies(`${QC}_Hostile_Hook`, [{ SID: `${QC}_HookFight` }], PLAYER_GUID, GUID.hook),
    resetAI(`${QC}_HookRelease`, [{ SID: `${QC}_HookFight` }], GUID.hook),
    ...CREW.flatMap((guid, i) => [
      makeEnemies(`${QC}_Hostile_Crew${i}`, [{ SID: `${QC}_HookFight` }], PLAYER_GUID, guid),
      resetAI(`${QC}_CrewRelease${i}`, [{ SID: `${QC}_HookFight` }], guid),
    ]),

    // 3. Hook's PDA: the meeting place and password; the dealers move in and the dice are cast.
    onGetItem(`${QC}_ListenHookPDA`, [{ SID: `${QC}_OnAccepted` }], HOOK_PDA),
    addNote(`${QC}_AddHookNote`, [{ SID: `${QC}_ListenHookPDA` }], HOOK_NOTE),
    stage(`${QC}_SetJournal_FindGoBetweenDone`, [{ SID: `${QC}_ListenHookPDA` }], "FindGoBetween", "Finish"),
    stage(`${QC}_SetJournal_Meeting`, [{ SID: `${QC}_ListenHookPDA` }], "Meeting", "Start", GUID.lead),
    ...DEALERS.map((guid, i) => spawn(`${QC}_SpawnDealer${i}`, [{ SID: `${QC}_ListenHookPDA` }], guid)),
    technical(`${QC}_DealersSpawned`, [{ SID: `${QC}_ListenHookPDA` }], 1),
    ...DEALERS.map((guid, i) =>
      aiBehavior(`${QC}_DealerStay${i}`, [{ SID: `${QC}_DealersSpawned` }], guid, { stay: [POS.lead, POS.gunner, POS.smg][i] }, i === 0 ? "EWeaponState::NoWeapon" : undefined),
    ),
    ...ROLLS.flatMap((roll) => rollDie(roll, [{ SID: `${QC}_ListenHookPDA` }])),

    // 4. Skif walks in: his bonus goes onto the rolls, then the lead starts talking. The rifle and the
    // name are +1 each; a Ward badge +1, RareNPCDrops' copy only checked behind its installed flag, in
    // a node of its own (DetectInstalledModSpec: without the mod, the unknown item nulls its node).
    // A save 20 m from the lead, before the room and the forced dialog.
    tickPin(`${QC}_SaveBeforeMeeting_Pin_0`, allOf([nearPoint(POS.lead, 2000), ran(`${QC}_DealersSpawned`)])),
    saveGame(`${QC}_SaveBeforeMeeting`, onTickWhen(`${QC}_SaveBeforeMeeting_Pin_0`)),
    tickPin(`${QC}_Approach_Pin_0`, allOf([nearPoint(POS.lead, 500), ran(`${QC}_DealersSpawned`)])),
    technical(`${QC}_Approach`, onTickWhen(`${QC}_Approach_Pin_0`)),
    ifNode(`${QC}_If_Rifle`, [{ SID: `${QC}_Approach` }], allOf([itemCount(DECIDER_ITEM)])),
    ...bonus("Rifle", `${QC}_If_Rifle`),
    ifNode(`${QC}_If_Name`, [{ SID: `${QC}_Approach` }], allOf([itemCount(NAME_NOTE)])),
    ...bonus("Name", `${QC}_If_Name`),
    ifNode(`${QC}_If_Badge`, [{ SID: `${QC}_Approach` }], allOf([itemCount(WARD_BADGE)])),
    setVar(`${QC}_HasBadge`, [{ SID: `${QC}_If_Badge`, Name: "True" }], VAR.hasBadge, 1),
    ifNode(`${QC}_If_RareNPCDrops`, [{ SID: `${QC}_Approach` }], allOf([hasEffect(installedEffectSid("RareNPCDrops"))])),
    ifNode(`${QC}_If_RareBadge`, [{ SID: `${QC}_If_RareNPCDrops`, Name: "True" }], allOf([itemCount(RARE_WARD_BADGE)])),
    setVar(`${QC}_HasRareBadge`, [{ SID: `${QC}_If_RareBadge`, Name: "True" }], VAR.hasBadge, 1),
    technical(`${QC}_BadgeChecked`, [{ SID: `${QC}_Approach` }], 0.5),
    ifNode(`${QC}_If_HasBadge`, [{ SID: `${QC}_BadgeChecked` }], allOf([globalVar(VAR.hasBadge, "Equal", 1)])),
    ...bonus("Badge", `${QC}_If_HasBadge`),
    onDeath(`${QC}_OnLeadDeath`, GUID.lead),
    itemAdd(`${QC}_DealerPDA`, [{ SID: `${QC}_Approach` }, { SID: `${QC}_OnLeadDeath` }], GUID.lead, DEALER_PDA),
    technical(`${QC}_BonusDone`, [{ SID: `${QC}_Approach` }], 1),

    // 5. The meeting: forced as Skif walks in; walked out of, it stays on the lead as a topic.
    setDialog(QC, `${QC}_MeetingDialog`, [{ SID: `${QC}_BonusDone` }], MEETING, meetingEndings, { npc: GUID.lead, forced: true }),
    setDialog(
      QC,
      `${QC}_MeetingDialogAgain`,
      [meetingInterrupted(`${QC}_MeetingDialog`), meetingInterrupted(`${QC}_MeetingDialogAgain`)],
      MEETING,
      meetingEndings,
      { npc: GUID.lead },
    ),
    // Heard both ways: the SetDialog's own ending pins, and the dialog-finished event.
    onDialogEnding(`${QC}_OnIntel`, MEETING, MEETING_INTEL, QC),
    onDialogEnding(`${QC}_OnLoud`, MEETING, MEETING_LOUD, QC),
    technical(`${QC}_IntelHeard`, [
      { SID: `${QC}_OnIntel` },
      { SID: `${QC}_MeetingDialog`, Name: lastLineSID(MEETING, MEETING_INTEL) },
      { SID: `${QC}_MeetingDialogAgain`, Name: lastLineSID(MEETING, MEETING_INTEL) },
    ]),
    technical(`${QC}_WentLoud`, [
      { SID: `${QC}_OnLoud` },
      { SID: `${QC}_MeetingDialog`, Name: lastLineSID(MEETING, MEETING_LOUD) },
      { SID: `${QC}_MeetingDialogAgain`, Name: lastLineSID(MEETING, MEETING_LOUD) },
    ]),
    setVar(`${QC}_SetIntel`, [{ SID: `${QC}_IntelHeard` }], VAR.intel, 1),

    // Blown: every dealer turns on Skif, and on the Sultan's lads if they came.
    ...DEALERS.flatMap((dealer, i) => [
      makeEnemies(`${QC}_Hostile_Player_${i}`, [{ SID: `${QC}_WentLoud` }], PLAYER_GUID, dealer),
      ...GUARDS.map((guard, j) => makeEnemies(`${QC}_Hostile_Guard${j}_${i}`, [{ SID: `${QC}_WentLoud` }], guard, dealer)),
      resetAI(`${QC}_DealerRelease${i}`, [{ SID: `${QC}_WentLoud` }], dealer),
    ]),
    stage(`${QC}_SetJournal_TakeDealerPDA`, [{ SID: `${QC}_WentLoud` }], "TakeDealerPDA", "Start", GUID.lead),

    // The dealers' PDA tells the same, whether looted after a fight or before ever talking.
    onGetItem(`${QC}_ListenDealerPDA`, [{ SID: `${QC}_ListenHookPDA` }], DEALER_PDA),
    addNote(`${QC}_AddDealerNote`, [{ SID: `${QC}_ListenDealerPDA` }], DEALER_NOTE),
    ifNode(`${QC}_If_Loud`, [{ SID: `${QC}_ListenDealerPDA` }], hasRun(`${QC}_WentLoud`)),
    stage(`${QC}_SetJournal_TakeDealerPDADone`, [{ SID: `${QC}_If_Loud`, Name: "True" }], "TakeDealerPDA", "Finish"),

    // 6. Back to Wolf, with the lead's word or the PDA.
    stage(`${QC}_SetJournal_MeetingDone`, [{ SID: `${QC}_IntelHeard` }, { SID: `${QC}_ListenDealerPDA` }], "Meeting", "Finish"),
    stage(`${QC}_SetJournal_ReturnToWolf`, [{ SID: `${QC}_IntelHeard` }, { SID: `${QC}_ListenDealerPDA` }], "ReturnToWolf", "Start", WOLF_GUID),

    // The Sultan's favor: two of his lads hold outside the building until Skif comes, then follow him.
    onDialogEnding(`${QC}_OnFavor`, FAVOR, FAVOR_ACCEPTED, QC),
    ...GUARDS.map((guard, i) => spawn(`${QC}_SpawnGuard${i}`, [{ SID: `${QC}_OnFavor` }], guard)),
    technical(`${QC}_GuardsSpawned`, [{ SID: `${QC}_OnFavor` }], 1),
    ...GUARDS.flatMap((guard, i) => [
      setItemGenerator(`${QC}_ArmGuard${i}`, [{ SID: `${QC}_GuardsSpawned` }], guard, `${QC}_GuardLoadout`),
      aiBehavior(`${QC}_GuardStay${i}`, [{ SID: `${QC}_GuardsSpawned` }], guard, { stay: [POS.guard1, POS.guard2][i] }),
    ]),
    tickPin(`${QC}_GuardsJoin_Pin_0`, allOf([nearPoint(POS.guard1, 2000), ran(`${QC}_GuardsSpawned`)])),
    technical(`${QC}_GuardsJoin`, onTickWhen(`${QC}_GuardsJoin_Pin_0`)),
    ...GUARDS.flatMap((guard, i) => [
      aiBehavior(`${QC}_GuardFollow${i}`, [{ SID: `${QC}_GuardsJoin` }], guard, { follow: PLAYER_GUID }),
      resetAI(`${QC}_GuardRelease${i}`, [{ SID: `${QC}_SetJournal_ReturnToWolf` }], guard),
    ]),

    // 7. The hand-in. Wolf pays in the dialog; the PDAs go, and the job's people with them.
    onDialogEnding(`${QC}_OnHandedIn`, COVER_TURNIN, COVER_PAYOFF, QC),
    itemRemove(`${QC}_RemoveDealerPDA`, [{ SID: `${QC}_OnHandedIn` }], DEALER_PDA),
    itemRemove(`${QC}_RemoveHookPDA`, [{ SID: `${QC}_OnHandedIn` }], HOOK_PDA),
    itemRemove(`${QC}_RemoveNameNote`, [{ SID: `${QC}_OnHandedIn` }], NAME_NOTE),
    ...[...DEALERS, ...GUARDS, GUID.hook, ...CREW, GUID.corpse].map((guid, i) => despawn(`${QC}_Despawn${i}`, [{ SID: `${QC}_OnHandedIn` }], guid)),
    stage(`${QC}_SetJournal_ReturnDone`, [{ SID: `${QC}_OnHandedIn` }], "ReturnToWolf", "Finish"),
    node(`${QC}_SetJournal_QuestFinish`, {
      NodeType: "EQuestNodeType::SetJournal",
      Launchers: getLaunchers([{ SID: `${QC}_SetJournal_ReturnDone` }]),
      JournalEntity: "EJournalEntity::Quest",
      JournalAction: "EJournalAction::Finish",
      JournalQuestSID: QC,
    }),
    node(`${QC}_End`, {
      NodeType: "EQuestNodeType::End",
      Launchers: getLaunchers([{ SID: `${QC}_SetJournal_QuestFinish` }]),
      ExcludeAllNodesInContainer: true,
    }),
  ];
}
