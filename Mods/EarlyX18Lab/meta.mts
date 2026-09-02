import type { MetaType } from "../../src/meta-type.mts";
import { Struct } from "s2cfgtojson";
import type { QuestNodePrototype } from "s2cfgtojson";
import { getLaunchers } from "../../src/struct-utils.mts";

/**
 * Vanilla gating of the X18 Lab side quest (SQ103), all of it in the Garbage_L level graph:
 *
 *  Garbage_L_Container_SQ103 — the node that runs the SQ103_P → SQ103 quest.
 *    launcher[0] non-excluding: OnTickEvent_SQ103Start AND Pin_0
 *        Pin_0 = E03_MQ06 Finished AND E08_MQ01 Pending      → the narrow "window"
 *    launcher[1] excluding:     Pin_2 = E08_MQ01 Active OR SQ103 not Active
 *    launcher[2] excluding:     Garbage_L_SetJournal_SQ103_Stage_GetToLab
 *
 *  Garbage_L_SetJournal_SQ103_Stage_GetToLab — Cancels journal quest SQ103 once
 *    E08_MQ01 is Active and SQ103 is Active.
 *
 *  SQ103_OnJournalQuestEvent_E08_MQ01_GetToMalahit (inside the quest itself) — on the
 *    E08_MQ01 "Get to Malachite" stage, cancels SQ103 and shuts the X18 bunker door and
 *    cardlock receivers off.
 *
 * Approach
 * --------
 * The vanilla container and its condition pins are left ENTIRELY untouched. Rewriting its
 * Launchers is what earlier versions did, and it is also the most likely cause of the
 * regression where the radio call stopped firing even inside the trigger volumes.
 *
 * Instead a SECOND, ungated container for SQ103_P is added alongside it, under new SIDs.
 * New SIDs matter for two reasons:
 *   - nothing in the graph can exclude them, since nothing references them; and
 *   - quest node state is persisted per SID in the save, so a brand new SID has no saved
 *     state and starts cleanly on an EXISTING save, where the vanilla container may already
 *     be recorded as excluded and can no longer be revived by editing data.
 *
 * Diod's call itself is deliberately left on its vanilla wiring: it is fired by the seven
 * SQ103_P trigger volumes (Sidorovich, _1.._5, WildIsland), so it still happens when Skif
 * walks into them rather than out of nowhere. SQ103_P's own excluding launcher from
 * SQ103_P_Technical_QuestTakenOrDialogHeard keeps it from firing if it already started.
 *
 * Every remaining edit is a plain scalar field change — no Launchers arrays are rewritten
 * or emptied anywhere in this mod.
 */

const EARLY_ONTICK_SID = "Garbage_L_OnTickEvent_SQ103Start_Early";
const EARLY_CONTAINER_SID = "Garbage_L_Container_SQ103_Early";

/**
 * `refkey` makes the new struct INHERIT the referenced one, so it has to point at a node of
 * the same type — keying the tick node off the container would have handed it the
 * container's excluding launchers and quietly excluded it.
 */
function newRootNode(sid: string, refkey: string, fields: Record<string, unknown>) {
  const node = new Struct(fields) as QuestNodePrototype;
  (node as any).SID = sid;
  node.__internal__.isRoot = true;
  node.__internal__.rawName = sid;
  node.__internal__.refkey = refkey;
  delete (node.__internal__ as any).refurl;
  return node;
}

function transformGarbageL(struct: QuestNodePrototype) {
  // Add the ungated duplicate container. Anchored on the vanilla container purely so this
  // runs once; the vanilla struct itself is NOT modified and is not returned.
  if (struct.SID === "Garbage_L_Container_SQ103") {
    const onTick = newRootNode(EARLY_ONTICK_SID, "Garbage_L_OnTickEvent_SQ103Start", {
      NodePrototypeVersion: 1,
      QuestSID: "Garbage_L",
      NodeType: "EQuestNodeType::OnTickEvent",
      LaunchOnQuestStart: true,
      EventType: "EQuestEventType::OnTick",
      TrackBeforeActive: false,
    });

    const container = newRootNode(EARLY_CONTAINER_SID, "Garbage_L_Container_SQ103", {
      NodePrototypeVersion: 1,
      Repeatable: true,
      QuestSID: "Garbage_L",
      NodeType: "EQuestNodeType::Container",
      OutputPinNames: new Struct({ 0: "SQ103_P_End" }),
      ContaineredQuestPrototypeSID: "SQ103_P",
    });
    container.Launchers = getLaunchers([{ SID: EARLY_ONTICK_SID }]);

    return [onTick, container];
  }

  // Stop the level-side cancel. Flipping the action from Cancel to Start is a scalar edit,
  // so the node's Launchers array is left alone; if SQ103 is already running this is a
  // no-op, and it can no longer yank the quest away when E08_MQ01 begins.
  if (struct.SID === "Garbage_L_SetJournal_SQ103_Stage_GetToLab") {
    const fork = struct.fork();
    fork.JournalAction = "EJournalAction::Start";
    return fork;
  }
}
transformGarbageL.files = ["/Garbage_L.cfg"];

function transformSQ103(struct: QuestNodePrototype) {
  // Stop the in-quest cancel. This is an event node with no Launchers of its own, so
  // clearing LaunchOnQuestStart is what disables it: it never subscribes, and the cancel /
  // door-shutdown / keycard-cleanup chain hanging off it never runs.
  if (struct.SID === "SQ103_OnJournalQuestEvent_E08_MQ01_GetToMalahit") {
    const fork = struct.fork();
    fork.LaunchOnQuestStart = false;
    fork.TrackBeforeActive = false;
    return fork;
  }
}
transformSQ103.files = ["/SQ103.cfg"];

export const meta: MetaType = {
  description: `
Lets you pick up and complete the X18 Lab side quest (SQ103) at any point of the main story.

Vanilla only allows it in a narrow window: Diod's radio call fires after [i]E03_MQ06[/i] is finished and only while [i]E08_MQ01[/i] has not started. The moment [i]E08_MQ01[/i] begins the quest is cancelled outright, and the lab's door and cardlock are switched off.

This mod adds a second, ungated way for the quest to become available, and disables both cancels — the level-side one and the in-quest [i]Get to Malachite[/i] one — so the quest stays available and completable no matter how far into the main quest you are.

Diod's call still works the way it always did: it comes when you enter the same areas of the Garbage / Slag Heap that trigger it in vanilla, and it will not fire if you have already heard it or already taken the quest.

[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote:
    "Reworked for existing saves. The vanilla SQ103 container and its condition pins are now left completely untouched — rewriting them is what stopped the radio call firing even inside its trigger volumes. Instead the mod adds a second, ungated container for the quest under new SIDs, which nothing can exclude and which has no saved state, so it also starts on a save that is already past E08_MQ01. Both cancel paths are disabled via plain field edits. Diod's call keeps its vanilla trigger volumes and still won't fire if the quest already started.",
  structTransformers: [transformGarbageL, transformSQ103],
};
