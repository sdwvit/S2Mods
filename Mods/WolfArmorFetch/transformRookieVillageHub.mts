import { Struct } from "s2cfgtojson";
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
import { Q, hasRun, questNode, setDialog } from "./nodes.mts";

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

const QD = `${Q}_Decider`;
const If = (SID: string, launchers: { SID: string; Name?: string }[], condition: string) =>
  node(SID, {
    NodePrototypeVersion: 1,
    NodeType: "EQuestNodeType::If",
    Repeatable: true,
    Launchers: getLaunchers(launchers),
    Conditions: hasRun(condition),
  });

let once = false;

/**
 * Wolf's offer and hand-in dialogs for both jobs, as RookieVillage_Hub nodes. Which one he gets is
 * decided at each re-attach from WolfArmorFetch's own progress: the Decider first, then the Falcon a
 * day later.
 * A save that accepted the Falcon before the Decider existed finishes the Falcon first, then gets the
 * Decider. WolfArmorFetch reacts to how they end with `OnInfotopicFinishEvent` listeners (see
 * transformQuestNodes).
 */
export const transformRookieVillageHub: StructTransformer<Struct> = () => {
  if (once) return;
  once = true;

  return [
    If(`${H}_If_FalconAccepted`, WOLF_TOPIC_TRIGGERS.map((SID) => ({ SID })), `${Q}_OnAccepted`),
    If(`${H}_If_FalconDone`, [{ SID: `${H}_If_FalconAccepted`, Name: "True" }], `${Q}_OnHandedIn`),
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
    // A day after the Decider hand-in, the Falcon offer, unless the Falcon was taken already. The
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
  ];
};
transformRookieVillageHub.files = ["/QuestNodePrototypes/RookieVillage_Hub.cfg"];
