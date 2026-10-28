import { Struct } from "s2cfgtojson";
import { isCreated } from "./conditions.mts";
import type { StructTransformer } from "../../src/meta-type.mts";
import { getLaunchers } from "../../src/struct-utils.mts";
import {
  ACCEPT,
  DECIDER_ACCEPT,
  DECIDER_DECLINED,
  DECIDER_DOUBT,
  DECIDER_NOT_YET,
  DECIDER_TURNIN,
  DECIDER_ACCEPTED,
  FALCON_ACCEPTED,
  FALCON_DECLINED,
  FALCON_GIVE,
  FALCON_NOT_YET,
  FALCON_OFFER_DELAY_HOURS,
  TURNIN,
  lastLineSID,
} from "./dialog.mts";
import { FALCON_ACCEPTED_RAN, FALCON_HANDED_IN_RAN, Q, WOLF_GUID, hasRun, hasRunAny, questNode, setDialog } from "./nodes.mts";
import {
  COVER_ACCEPT,
  COVER_ACCEPTED,
  COVER_DECLINED,
  COVER_NOT_YET,
  COVER_PAYOFF,
  COVER_TURNIN,
  MEETING,
  MEETING_INTEL,
} from "./coverDialog.mts";
import { COVER_OFFER_CHECK, DEALER_PDA, QC } from "./cover.mts";
import { DECIDER_SPARE_CHECK } from "./transformQuestNodes.mts";

const HUB = "RookieVillage_Hub";
/** Our nodes live in the hub quest, so their SIDs carry its prefix. */
const H = `${HUB}_${Q}`;
const node = (SID: string, fields: Record<string, unknown>) => questNode(HUB, SID, fields);

/**
 * The hub nodes that (re)attach Wolf's own Info topic. The hub owns Wolf: it spawns him (twice -
 * once per phase) and resets his dialogs from these, so a topic attached from any other quest goes
 * missing. Attaching ours from the same triggers keeps it alongside his.
 * - phase 1: his creation (`InfoTopic_1`)
 * - phase 2: his re-creation, `Phase2` (`InfoTopic_2`) and `Technical_13` (`InfoTopic_3`)
 */
const WOLF_TOPIC_TRIGGERS = [
  `${HUB}_OnNPCCreateEvent_BP_NPC_RookieVillageGuider`,
  `${HUB}_OnNPCCreateEvent_BP_NPC_RookieVillageGuider_1`,
  `${HUB}_Phase2`,
  `${HUB}_Technical_13`,
];

/**
 * Started on every world load by the mod's announce blueprint (`XStartQuestNodeBySID`), for saves where
 * Wolf was created before the mod was installed: none of the triggers above runs again there. It
 * re-runs the same re-attach as they do, once Wolf exists (`IsCreated`, as vanilla checks him). A Bridge
 * condition on any of the triggers above came out False on a save past them (2026-10-25): vanilla never
 * reads those nodes' state, only their outputs.
 */
export const ON_WORLD_LOAD = `${Q}_OnWorldLoad`;
const WOLF_RETRY_SECONDS = 5;
const WORLD_LOAD_LATE_SECONDS = 30;

const QD = `${Q}_Decider`;
const If = (SID: string, launchers: { SID: string; Name?: string }[], condition: string | string[]) =>
  node(SID, {
    NodePrototypeVersion: 1,
    NodeType: "EQuestNodeType::If",
    Repeatable: true,
    Launchers: getLaunchers(launchers),
    Conditions: typeof condition === "string" ? hasRun(condition) : hasRunAny(condition),
  });

let once = false;

/** Where the hub starts listening for Skif's return: on accepting, and at each re-attach until then. */
const coverListenFrom = [
  { SID: `${H}_If_CoverReturned`, Name: "False" },
  { SID: `${H}_CoverAcceptDialog`, Name: lastLineSID(COVER_ACCEPT, COVER_ACCEPTED) },
];

/**
 * Wolf's offer and hand-in dialogs for all three jobs, as RookieVillage_Hub nodes. Which one he gets
 * is decided at each re-attach from the quests' own progress: the Decider first, then the Falcon an hour
 * later, then Cover Story (WolfArmorFetch_Cover) a day after the Falcon hand-in.
 * A save that accepted the Falcon before the Decider existed finishes the Falcon first, then gets the
 * Decider. WolfArmorFetch reacts to how they end with `OnInfotopicFinishEvent` listeners (see
 * transformQuestNodes).
 */
export const transformRookieVillageHub: StructTransformer<Struct> = () => {
  if (once) return;
  once = true;

  return [
    node(ON_WORLD_LOAD, {
      NodePrototypeVersion: 1,
      NodeType: "EQuestNodeType::If",
      Repeatable: true,
      Conditions: new Struct({ 0: new Struct({ 0: isCreated(WOLF_GUID) }) }),
    }),
    // Wolf's topics are attached a while after the world loads, never straight away: attached by the
    // world-load command itself they went missing, while the same nodes run a minute later attached them
    // (2026-10-25). Checked 5 s in, then every 5 s until Wolf exists (a save from before his creation
    // waits for the hub to create him), and once more 30 s in, in case 5 s is still too early.
    node(`${H}_WolfRetry`, {
      NodePrototypeVersion: 1,
      NodeType: "EQuestNodeType::Technical",
      Repeatable: true,
      Launchers: getLaunchers([
        { SID: ON_WORLD_LOAD, Name: "True" },
        { SID: ON_WORLD_LOAD, Name: "False" },
        { SID: `${H}_If_WolfCreated`, Name: "False" },
      ]),
      StartDelay: WOLF_RETRY_SECONDS,
    }),
    node(`${H}_WorldLoadLate`, {
      NodePrototypeVersion: 1,
      NodeType: "EQuestNodeType::Technical",
      Repeatable: true,
      Launchers: getLaunchers([
        { SID: ON_WORLD_LOAD, Name: "True" },
        { SID: ON_WORLD_LOAD, Name: "False" },
      ]),
      StartDelay: WORLD_LOAD_LATE_SECONDS,
    }),
    node(`${H}_If_WolfCreatedLate`, {
      NodePrototypeVersion: 1,
      NodeType: "EQuestNodeType::If",
      Repeatable: true,
      Launchers: getLaunchers([{ SID: `${H}_WorldLoadLate` }]),
      Conditions: new Struct({ 0: new Struct({ 0: isCreated(WOLF_GUID) }) }),
    }),
    node(`${H}_If_WolfCreated`, {
      NodePrototypeVersion: 1,
      NodeType: "EQuestNodeType::If",
      Repeatable: true,
      Launchers: getLaunchers([{ SID: `${H}_WolfRetry` }]),
      Conditions: new Struct({ 0: new Struct({ 0: isCreated(WOLF_GUID) }) }),
    }),
    // The jobs' own quests, if rootgraph never started them on this save: the dialogs above live in the
    // hub, so they still showed, but nothing heard them end (a Falcon hand-in paid nothing, 2026-10-25).
    ...[Q, QC].flatMap((quest) => [
      If(
        `${H}_If_${quest}_Started`,
        [
          { SID: ON_WORLD_LOAD, Name: "True" },
          { SID: ON_WORLD_LOAD, Name: "False" },
        ],
        `${quest}_Start`,
      ),
      node(`${H}_Start_${quest}`, {
        NodePrototypeVersion: 1,
        NodeType: "EQuestNodeType::ConsoleCommand",
        Repeatable: true,
        Launchers: getLaunchers([{ SID: `${H}_If_${quest}_Started`, Name: "False" }]),
        ConsoleCommand: `XStartQuestBySID ${quest}`,
      }),
    ]),
    If(
      `${H}_If_FalconAccepted`,
      [
        ...WOLF_TOPIC_TRIGGERS.map((SID) => ({ SID })),
        { SID: `${H}_If_WolfCreated`, Name: "True" },
        { SID: `${H}_If_WolfCreatedLate`, Name: "True" },
      ],
      FALCON_ACCEPTED_RAN,
    ),
    If(`${H}_If_FalconDone`, [{ SID: `${H}_If_FalconAccepted`, Name: "True" }], FALCON_HANDED_IN_RAN),
    // Falcon not taken: the Decider, or the Falcon offer once the Decider is done and a day has passed.
    If(`${H}_If_DeciderDone`, [{ SID: `${H}_If_FalconAccepted`, Name: "False" }], `${QD}_OnHandedIn`),
    If(`${H}_If_FalconOfferReady`, [{ SID: `${H}_If_DeciderDone`, Name: "True" }], `${H}_FalconOfferTimer`),
    // Falcon done first (a save that took it before the Decider existed): the Decider, unless the
    // quest has ended - on both jobs done, or on an older save's Falcon-only End, which stopped the
    // Decider's listeners too.
    If(`${H}_If_QuestEnded`, [{ SID: `${H}_If_FalconDone`, Name: "True" }], `${Q}_End`),
    If(
      `${H}_If_DeciderAccepted`,
      [
        { SID: `${H}_If_DeciderDone`, Name: "False" },
        { SID: `${H}_If_QuestEnded`, Name: "False" },
      ],
      `${QD}_OnAccepted`,
    ),

    // Job open: check whether the Decider can still be had at all (see transformQuestNodes' spareDeciderNodes).
    node(`${H}_DeciderSpareCheck`, {
      NodePrototypeVersion: 1,
      NodeType: "EQuestNodeType::ConsoleCommand",
      Repeatable: true,
      Launchers: getLaunchers([{ SID: `${H}_If_DeciderAccepted`, Name: "True" }]),
      ConsoleCommand: `XStartQuestNodeBySID ${DECIDER_SPARE_CHECK}`,
    }),

    setDialog(HUB, `${H}_DeciderAcceptDialog`, [{ SID: `${H}_If_DeciderAccepted`, Name: "False" }], DECIDER_ACCEPT, [
      { label: DECIDER_ACCEPTED, finish: true },
      { label: DECIDER_DECLINED, finish: false },
    ]),
    setDialog(
      HUB,
      `${H}_DeciderTurnInDialog`,
      [
        { SID: `${H}_If_DeciderAccepted`, Name: "True" },
        // Straight after accepting, without waiting for the next re-attach. A SetDialog's output is
        // named after the ending's last line, as vanilla wires them (RSQ06).
        { SID: `${H}_DeciderAcceptDialog`, Name: lastLineSID(DECIDER_ACCEPT, DECIDER_ACCEPTED) },
      ],
      DECIDER_TURNIN,
      [
        { label: DECIDER_DOUBT, finish: true },
        { label: DECIDER_NOT_YET, finish: false },
      ],
    ),
    // An hour after the Decider hand-in, the Falcon offer, unless the Falcon was taken already. The
    // re-attaches above wait on the same timer.
    If(
      `${H}_If_FalconAcceptedAfterDecider`,
      [{ SID: `${H}_DeciderTurnInDialog`, Name: lastLineSID(DECIDER_TURNIN, DECIDER_DOUBT) }],
      `${Q}_OnAccepted`,
    ),
    node(`${H}_FalconOfferTimer`, {
      NodePrototypeVersion: 1,
      NodeType: "EQuestNodeType::SetTimer",
      Launchers: getLaunchers([{ SID: `${H}_If_FalconAcceptedAfterDecider`, Name: "False" }]),
      InGameHours: FALCON_OFFER_DELAY_HOURS,
    }),

    setDialog(
      HUB,
      `${H}_AcceptDialog`,
      [
        { SID: `${H}_If_FalconOfferReady`, Name: "True" },
        { SID: `${H}_FalconOfferTimer` },
      ],
      ACCEPT,
      [
        { label: FALCON_ACCEPTED, finish: true },
        { label: FALCON_DECLINED, finish: false },
      ],
    ),
    setDialog(
      HUB,
      `${H}_TurnInDialog`,
      [
        { SID: `${H}_If_FalconDone`, Name: "False" },
        { SID: `${H}_AcceptDialog`, Name: lastLineSID(ACCEPT, FALCON_ACCEPTED) },
      ],
      TURNIN,
      [
        { label: FALCON_GIVE, finish: true },
        { label: FALCON_NOT_YET, finish: false },
      ],
    ),

    // Cover Story: once its own quest says it's ready (a day after the Falcon hand-in), the same
    // condition its quest-giver marker on Wolf uses, checked straight from each re-attach. Gating on
    // the Falcon's progress as well left saves with the marker and no topic: WolfArmorFetch's End once,
    // and a save whose Falcon ran while WolfArmorFetch wasn't running, so it recorded nothing (2026-10-25).
    If(
      `${H}_If_CoverAccepted`,
      [
        ...WOLF_TOPIC_TRIGGERS.map((SID) => ({ SID })),
        { SID: `${H}_If_WolfCreated`, Name: "True" },
        { SID: `${H}_If_WolfCreatedLate`, Name: "True" },
      ],
      `${QC}_OnAccepted`,
    ),
    If(`${H}_If_CoverReady`, [{ SID: `${H}_If_CoverAccepted`, Name: "False" }], `${QC}_Ready`),
    If(`${H}_If_CoverDone`, [{ SID: `${H}_If_CoverAccepted`, Name: "True" }], `${QC}_OnHandedIn`),
    // The moment the quest turns ready (and marks Wolf), it starts this check from the console
    // (WolfArmorFetch_Cover's AttachOffer): unless the job is taken already, the offer goes on Wolf.
    // A hub timer racing the quest's own one left the marker and no topic (2026-10-25).
    If(COVER_OFFER_CHECK, [], `${QC}_OnAccepted`),
    setDialog(
      HUB,
      `${H}_CoverAcceptDialog`,
      [
        { SID: `${H}_If_CoverReady`, Name: "True" },
        { SID: COVER_OFFER_CHECK, Name: "False" },
      ],
      COVER_ACCEPT,
      [
        { label: COVER_ACCEPTED, finish: true },
        { label: COVER_DECLINED, finish: false },
      ],
    ),
    // The hand-in shows only once Skif has something to hand in: the lead's word or the dealers' PDA.
    If(`${H}_If_CoverReturned`, [{ SID: `${H}_If_CoverDone`, Name: "False" }], `${QC}_SetJournal_ReturnToWolf`),
    // Not yet: listen for either, so the topic appears without waiting for the next re-attach. Each
    // listener stops the other, so the topic is attached once.
    node(`${H}_OnCoverIntel`, {
      NodePrototypeVersion: 1,
      NodeType: "EQuestNodeType::OnInfotopicFinishEvent",
      Launchers: getLaunchers([...coverListenFrom, { SID: `${H}_OnCoverDealerPDA`, Excluding: true }]),
      EventType: "EQuestEventType::OnDialogFinished",
      TrackBeforeActive: false,
      InfotopicLastPhrases: new Struct({ 0: new Struct({ LastPhraseSID: lastLineSID(MEETING, MEETING_INTEL) }) }),
    }),
    node(`${H}_OnCoverDealerPDA`, {
      NodePrototypeVersion: 1,
      NodeType: "EQuestNodeType::OnPlayerGetItemEvent",
      Launchers: getLaunchers([...coverListenFrom, { SID: `${H}_OnCoverIntel`, Excluding: true }]),
      EventType: "EQuestEventType::OnPlayerGetItem",
      TrackBeforeActive: false,
      ItemPrototypeSID: DEALER_PDA,
      ExpectedItemsCount: 1,
      WithEquipped: true,
    }),
    setDialog(
      HUB,
      `${H}_CoverTurnInDialog`,
      [{ SID: `${H}_If_CoverReturned`, Name: "True" }, { SID: `${H}_OnCoverIntel` }, { SID: `${H}_OnCoverDealerPDA` }],
      COVER_TURNIN,
      [
        { label: COVER_PAYOFF, finish: true },
        { label: COVER_NOT_YET, finish: false },
      ],
    ),
  ];
};
transformRookieVillageHub.files = ["/QuestNodePrototypes/RookieVillage_Hub.cfg"];
