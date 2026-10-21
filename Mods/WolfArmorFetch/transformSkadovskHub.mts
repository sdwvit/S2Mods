import type { Struct } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { getLaunchers } from "../../src/struct-utils.mts";
import { FAVOR, FAVOR_ACCEPTED, FAVOR_DECLINED } from "./coverDialog.mts";
import { QC, SULTAN_GUID } from "./cover.mts";
import { allOf, stageFinished } from "./conditions.mts";
import { hasRun, questNode, setDialog } from "./nodes.mts";

const HUB = "Skadovsk_Hub";
/** Our nodes live in the hub quest, so their SIDs carry its prefix. */
const H = `${HUB}_${QC}`;
const node = (SID: string, fields: Record<string, unknown>) => questNode(HUB, SID, fields);
const If = (SID: string, launchers: { SID: string; Name?: string }[], Conditions: Struct) =>
  node(SID, { NodePrototypeVersion: 1, NodeType: "EQuestNodeType::If", Repeatable: true, Launchers: getLaunchers(launchers), Conditions });

/**
 * The hub nodes that (re)attach the Sultan's own topics: his creation, and story phase 3 (SQ81). The
 * hub owns him the way RookieVillage_Hub owns Wolf, so a topic of ours rides on the same triggers.
 */
const SULTAN_TOPIC_TRIGGERS = [`${HUB}_OnNPCCreateEvent_BP_NPC_Sultan`, `${HUB}_Technical_Stage3`];

let once = false;

/**
 * The Sultan's favor for Cover Story: while the job is on and the meeting hasn't happened, a Skif who
 * brought him his case (SQ50's `SQ50_BringToSultan` stage, finished only by the hand-over) can ask
 * for two of his lads. WolfArmorFetch_Cover hears the answer (see coverNodes.mts).
 */
export const transformSkadovskHub: StructTransformer<Struct> = () => {
  if (once) return;
  once = true;

  return [
    If(`${H}_If_JobOn`, SULTAN_TOPIC_TRIGGERS.map((SID) => ({ SID })), hasRun(`${QC}_OnAccepted`)),
    If(`${H}_If_MetDealers`, [{ SID: `${H}_If_JobOn`, Name: "True" }], hasRun(`${QC}_ListenDealerPDA`)),
    If(`${H}_If_Met`, [{ SID: `${H}_If_MetDealers`, Name: "False" }], hasRun(`${QC}_IntelHeard`)),
    If(`${H}_If_Suitcase`, [{ SID: `${H}_If_Met`, Name: "False" }], allOf([stageFinished("SQ50", "SQ50_BringToSultan")])),
    If(`${H}_If_Asked`, [{ SID: `${H}_If_Suitcase`, Name: "True" }], hasRun(`${QC}_OnFavor`)),
    setDialog(HUB, `${H}_FavorDialog`, [{ SID: `${H}_If_Asked`, Name: "False" }], FAVOR, [
      { label: FAVOR_ACCEPTED, finish: true },
      { label: FAVOR_DECLINED, finish: false },
    ], { npc: SULTAN_GUID }),
  ];
};
transformSkadovskHub.files = ["/QuestNodePrototypes/Skadovsk_Hub.cfg"];
