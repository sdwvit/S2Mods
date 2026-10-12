import { Struct } from "s2cfgtojson";
import { getLaunchers } from "../../src/struct-utils.mts";
import { chainSID, lastLineSID, type Label, type Topic } from "./dialog.mts";

export const Q = "WolfArmorFetch";
export const WOLF_GUID = "927B9C2A43F721EC11E6C486D0DDFA0F";
export const PLAYER_GUID = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

export type LauncherConfig = { SID: string; Name?: string; Excluding?: boolean }[];

/** A new quest node of `questSID`. */
export const questNode = (questSID: string, SID: string, fields: Record<string, unknown>) =>
  new Struct({ __internal__: { rawName: SID, isRoot: true }, SID, QuestSID: questSID, ...fields });

/** "Has quest node `SID` run?" - a Bridge condition, which vanilla also points across quests. */
export const hasRun = (SID: string) =>
  new Struct({
    0: new Struct({
      0: new Struct({
        ConditionType: "EQuestConditionType::Bridge",
        ConditionComparance: "EConditionComparance::Equal",
        LinkedNodePrototypeSID: SID,
        CompletedNodeLauncherNames: new Struct({ 0: "" }),
      }),
    }),
  });

/**
 * A `SetDialog` putting `topic` on Wolf. `endings` are the labels whose last line ends it; one with
 * `finish: false` leaves the topic on Wolf afterwards (a decline, a "not yet"), the way vanilla keeps
 * hub topics and Sidorovich's job offer around.
 */
export function setDialog(
  questSID: string,
  SID: string,
  launchers: LauncherConfig,
  topic: Topic,
  endings: { label: Label; finish: boolean }[],
) {
  const LastPhrases = new Struct();
  for (const { label, finish } of endings)
    LastPhrases.addNode(new Struct({ FinishNode: finish, LastPhraseSID: lastLineSID(topic, label) }));

  const DialogMembers = new Struct();
  DialogMembers.addNode(WOLF_GUID);
  const TalkThroughRadio = new Struct();
  TalkThroughRadio.addNode(false);
  const DialogObjectLocation = new Struct();
  DialogObjectLocation.addNode(new Struct({ X: 0, Y: 0, Z: 0 }));

  // One output pin per ending, then Interrupt - the vanilla layout (a single-ending hub topic has
  // [End, Interrupt]; Sidorovich's job dialog has End_Quest_1..9 plus Interrupt).
  const OutputPinNames = new Struct();
  endings.forEach((_, i) => OutputPinNames.addNode(i === 0 ? "End" : `End_${i}`));
  OutputPinNames.addNode("Interrupt");

  return questNode(questSID, SID, {
    NodePrototypeVersion: 2,
    // Re-attached whenever the hub re-attaches Wolf's own topics.
    Repeatable: true,
    NodeType: "EQuestNodeType::SetDialog",
    OutputPinNames,
    Launchers: getLaunchers(launchers),
    LastPhrases,
    DialogChainPrototypeSID: chainSID(topic),
    DialogMembers,
    TalkThroughRadio,
    DialogObjectLocation,
    NPCToStartDialog: -1,
    StartForcedDialog: false,
    WaitAllDialogEndingsToFinish: false,
    IsComment: false,
    // `None` adds a quest topic next to Wolf's own, as Sidorovich's job offer (RSQ06) and E02_SQ01's
    // quest dialog do; `Info` is Wolf's single info slot, which the hub fills with his own topic.
    OverrideDialogTopic: "EOverrideDialogTopic::None",
    CanExitAnytime: false,
    ContinueThroughRadio: false,
    CallPlayer: false,
    SeekPlayer: false,
    CallPlayerRadius: 1000,
  });
}

/** Fires once when a dialog ends on `label`'s last line - how this quest hears a hub-owned dialog. */
export const onDialogEnding = (SID: string, topic: Topic, label: Label) =>
  questNode(Q, SID, {
    NodePrototypeVersion: 1,
    NodeType: "EQuestNodeType::OnInfotopicFinishEvent",
    LaunchOnQuestStart: true,
    EventType: "EQuestEventType::OnDialogFinished",
    TrackBeforeActive: false,
    InfotopicLastPhrases: new Struct({ 0: new Struct({ LastPhraseSID: lastLineSID(topic, label) }) }),
  });
