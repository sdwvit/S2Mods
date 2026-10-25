import { Struct } from "s2cfgtojson";

/**
 * Condition and dialog-action builders, shaped as vanilla writes them. The same condition structs
 * serve quest `If` nodes and dialog reply options (vanilla uses one shape for both).
 */

export const PLAYER_GUID = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

type Comparance = "Equal" | "NotEqual" | "Less" | "LessOrEqual" | "Greater" | "GreaterOrEqual";

/** The player carries `count` of `item` (worn or in the backpack), compared by `comparance`. */
export const itemCount = (item: string, comparance: Comparance = "GreaterOrEqual", count = 1) =>
  new Struct({
    ConditionType: "EQuestConditionType::ItemInInventory",
    ConditionComparance: `EConditionComparance::${comparance}`,
    TargetCharacter: PLAYER_GUID,
    ItemPrototypeSID: new Struct({ VariableType: "EGlobalVariableType::String", VariableValue: item }),
    ItemsCount: new Struct({ VariableType: "EGlobalVariableType::Int", VariableValue: count }),
    WithEquipped: true,
    WithInventory: true,
  });

/** How many of `item` the item container `guid` holds (vanilla's ItemInContainer, e.g. EN_X3Scope_1 `Equal 0`). */
export const itemInContainer = (guid: string, item: string, comparance: Comparance = "GreaterOrEqual", count = 1) =>
  new Struct({
    ConditionType: "EQuestConditionType::ItemInContainer",
    ConditionComparance: `EConditionComparance::${comparance}`,
    TargetItemContainer: guid,
    ItemPrototypeSID: new Struct({ VariableType: "EGlobalVariableType::String", VariableValue: item }),
    ItemsCount: new Struct({ VariableType: "EGlobalVariableType::Int", VariableValue: count }),
  });

/** Global variable `SID` compared with `value` (vanilla always writes `ChangeValueMode = Set` here). */
export const globalVar = (SID: string, comparance: Comparance, value: number) =>
  new Struct({
    ConditionType: "EQuestConditionType::GlobalVariable",
    ConditionComparance: `EConditionComparance::${comparance}`,
    GlobalVariablePrototypeSID: SID,
    ChangeValueMode: "EChangeValueMode::Set",
    VariableValue: value,
  });

/** The player carries effect `SID` (how a mod's presence is announced, see DetectInstalledModSpec). */
export const hasEffect = (SID: string) =>
  new Struct({
    ConditionType: "EQuestConditionType::Effect",
    ConditionComparance: "EConditionComparance::Equal",
    TargetCharacter: PLAYER_GUID,
    EffectPrototypeSID: SID,
    RequiredSquadMembers: "ERequiredSquadMembers::AllMembers",
  });

/** A journal quest stage is finished. */
export const stageFinished = (quest: string, stage: string) =>
  new Struct({
    ConditionType: "EQuestConditionType::JournalState",
    ConditionComparance: "EConditionComparance::Equal",
    JournalEntity: "EJournalEntity::QuestStage",
    JournalState: "EJournalState::Finished",
    JournalQuestSID: quest,
    JournalQuestStageSID: stage,
  });

/**
 * NPC `guid` exists, as vanilla checks for a spawned NPC. Holds whatever a save's history: a Bridge
 * condition on the node that spawned him, or one after it, can stay False (2026-10-25).
 */
export const isCreated = (guid: string) =>
  new Struct({
    ConditionType: "EQuestConditionType::IsCreated",
    ConditionComparance: "EConditionComparance::Equal",
    TargetPlaceholder: guid,
  });

/** The player is within `cm` of NPC `guid`. */
export const nearNPC = (guid: string, cm: number) =>
  new Struct({
    ConditionType: "EQuestConditionType::DistanceToNPC",
    ConditionComparance: "EConditionComparance::LessOrEqual",
    TargetCharacter: PLAYER_GUID,
    TargetNPC: guid,
    NumericValue: cm,
    RequiredSquadMembers: "ERequiredSquadMembers::AllMembers",
  });

/**
 * The player within `cm` of a fixed point, as vanilla's most used distance check. Used for walk-in
 * triggers: `DistanceToNPC` on a quest-spawned NPC passed at ~98 m in the second playtest.
 */
export const nearPoint = (pos: { x: number; y: number; z: number }, cm: number) =>
  new Struct({
    ConditionType: "EQuestConditionType::DistanceToPoint",
    ConditionComparance: "EConditionComparance::LessOrEqual",
    TargetCharacter: PLAYER_GUID,
    NumericValue: cm,
    TargetPoint: new Struct({ X: pos.x, Y: pos.y, Z: pos.z }),
    RequiredSquadMembers: "ERequiredSquadMembers::AllMembers",
  });

/**
 * A `Conditions` struct where all of `conditions` must hold: one group per condition, joined by
 * `ConditionCheckType = And`, as vanilla lays them out (SQ18_SetDialog_SQ18_Comment_Gnutyj_Sum_Coming_Pin_2).
 * Two conditions in one group passed when either held: the meeting started as soon as the dealers spawned.
 */
export function allOf(conditions: Struct[]) {
  const Conditions = new Struct();
  conditions.forEach((c) => Conditions.addNode(new Struct({ 0: c })));
  if (conditions.length > 1) Conditions.ConditionCheckType = "EConditionCheckType::And";
  return Conditions;
}

/** A dialog action setting global variable `SID` to `value` (vanilla E07_SQ01_Dialog_Batya_Done). */
export const setVarAction = (SID: string, value: number) =>
  new Struct({
    DialogAction: "EDialogAction::SetGlobalVariable",
    GlobalVariablePrototypeSID: SID,
    ChangeValueMode: "EChangeValueMode::Set",
    VariableValue: value,
  });

/** A dialog action handing the player `count` of `item` (vanilla's `GetItem`, e.g. a medkit from a medic). */
export const getItemAction = (item: string, count = 1) =>
  new Struct({
    DialogAction: "EDialogAction::GetItem",
    DialogActionParam: new Struct({ VariableType: "EGlobalVariableType::String", VariableValue: item }),
    ItemsCount: new Struct({ VariableType: "EGlobalVariableType::Int", VariableValue: count }),
  });

/** The dialog action vanilla puts on a line that turns a talk into a fight (SQ92_Dialog_AfterFight). */
export const attackAction = () => new Struct({ DialogAction: "EDialogAction::Attack" });
