import type { MetaType } from "../../src/meta-type.mts";
import { Struct } from "s2cfgtojson";
import type { QuestNodePrototype } from "s2cfgtojson";
import { getLaunchers } from "../../src/struct-utils.mts";

/**
 * Mutant loot turn-in ("body parts") orders exist in two places:
 *
 *  - BodyParts_Malahit — Viktoria Doroznuk (ScientistViktoriaDoroznuk, Faction = Scientists)
 *    at Malachite. Dialog chain EQ197_QD_Orders, driven by the SetDialog node
 *    BodyParts_Malahit_SetDialog_EQ197_QD_Orders.
 *  - SQ94_P — Gonta (Faction = Neutrals). Dialog chain SQ94_QD_Gonta_Orders, driven by TWO
 *    SetDialog nodes: SQ94_P_SetDialog_SQ94_QD_Gonta_Orders and the ..._STD119736 variant.
 *
 * In vanilla the payout for a completed order lives entirely inside the dialog, as
 * EDialogAction::GetMoney / ::Reward. EDialogAction has no relationship action, so the
 * reputation cannot be attached to the dialog itself — it has to be a quest node.
 *
 * Approach: add ChangeRelationships nodes under NEW SIDs, each launched from every "Done"
 * last-phrase output of the relevant SetDialog node, kept in the mod's own quest (see
 * QUEST_SID below). No vanilla struct is modified — the money reward is untouched, this is
 * purely additive.
 *
 * Node shape is copied from the vanilla RSQ06/RSQ04/RSQ07 courier rewards, which are the
 * game's own "finish a repeatable job, gain faction standing" nodes:
 * FirstTargetSID = the player GUID, delta value, no preset.
 */

const PLAYER_SID = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

/** Vanilla courier jobs grant 30. These orders are infinitely repeatable, so grant less. */
const RELATIONSHIP_DELTA = 10;

/** Every "order complete" ending of EQ197_QD_Orders (Malachite / Viktoria). */
const MALAHIT_DONE_PHRASES = [
  "EQ197_QD_Orders_Done_73061",
  "EQ197_QD_Orders_Done_73061_1",
  "EQ197_QD_Orders_Done_73061_2",
  "EQ197_QD_Orders_Done_73061_3",
  "EQ197_QD_Orders_Done_73061_4",
  "EQ197_QD_Orders_Done2_73167",
  "EQ197_QD_Orders_Done2_73167_1",
  "EQ197_QD_Orders_Done2_73167_2",
  "EQ197_QD_Orders_Done2_73167_3",
  "EQ197_QD_Orders_Done2_73167_4",
  "EQ197_QD_Orders_Done3_73169",
  "EQ197_QD_Orders_Done3_73169_1",
  "EQ197_QD_Orders_Done3_73169_2",
  "EQ197_QD_Orders_Done3_73169_3",
];

/**
 * Wiring (2026-11-19, tested via NodeBridge). Since the 2026-09-11 game update, a node a mod adds
 * is never launched off a named output (`Name = <phrase SID>` on a SetDialog, `Name = True` on a
 * Condition). Plain launchers (`Name =` empty) between nodes in a running vanilla quest work. So:
 *
 *  - Gonta: vanilla SQ94_P_Technical_Done_* nodes run only on a hand-in; the reputation node
 *    launches off them.
 *  - Viktoria: nothing vanilla runs only on a hand-in (SetGlobalVariable_MutantLootQuest* also run
 *    on a refusal). Her "Done" lines raise a flag through a SetGlobalVariable dialog action; a
 *    Condition node after SetGlobalVariable_MutantLootQuest* passes only while it is set, then the
 *    reputation node runs and clears it.
 *
 * Everything lives inside the vanilla quests: a quest of the mod's own is not running after a load,
 * so its nodes could not be started from these hooks.
 */
const MALAHIT_FLAG = "MutantLootReputationMalahitDone";

/**
 * The player's hand-in replies: they carry vanilla GiveItem (parts) and GetMoney (coupons), and the
 * dialog closes right after them, so Viktoria's closing "Done" line never runs its actions.
 */
const MALAHIT_REPLY_LINES = [
  "EQ197_QD_Orders_Done_73060",
  "EQ197_QD_Orders_Done2_73166",
  "EQ197_QD_Orders_Done3_73168",
  "EQ197_QD_Orders_Done_73060_1",
  "EQ197_QD_Orders_Done2_73166_1",
  "EQ197_QD_Orders_Done3_73168_1",
  "EQ197_QD_Orders_Done_73060_2",
  "EQ197_QD_Orders_Done2_73166_2",
  "EQ197_QD_Orders_Done3_73168_2",
  "EQ197_QD_Orders_Done_73060_3",
  "EQ197_QD_Orders_Done2_73166_3",
  "EQ197_QD_Orders_Done3_73168_3",
  "EQ197_QD_Orders_Done_73060_4",
  "EQ197_QD_Orders_Done2_73166_4",
];

function root<T>(sid: string, fields: Record<string, unknown>) {
  const node = new Struct({ SID: sid, ...fields }) as T & Struct;
  node.__internal__.isRoot = true;
  node.__internal__.rawName = sid;
  return node;
}

function newChangeRelationships(sid: string, questSID: string, factionSID: string, launcherSIDs: string[]) {
  const node = root<QuestNodePrototype>(sid, {
    NodePrototypeVersion: 1,
    Repeatable: true,
    QuestSID: questSID,
    NodeType: "EQuestNodeType::ChangeRelationships",
    FirstTargetSID: PLAYER_SID,
    SecondTargetSID: factionSID,
    UseDeltaValue: true,
    UsePreset: false,
    RelationshipValue: RELATIONSHIP_DELTA,
    SetFactionRelationshipAsPersonal: false,
    ShouldLockPersonalRelationship: false,
  });
  node.Launchers = getLaunchers(launcherSIDs.map((SID) => ({ SID })));
  return node;
}

/**
 * One vendor's hand-in hook. Vendor dialog patches add a SetGlobalVariable action (slot [2], next to the
 * vanilla GiveItem [0] and payout [1]) to the player's hand-in replies; a poll loop of the mod's own
 * nodes checks the flag every 3 s, pays reputation and clears it.
 */
interface Vendor {
  key: string; // node/flag name part
  questSID: string; // the vendor quest the nodes belong to
  faction: string;
  flag: string;
  dialogFile: string;
  replyLines: string[];
  nodeFile: string; // the vendor quest's own quest-node cfg
}

const GONTA_REPLY_LINES = [
  "SQ94_QD_Gonta_Orders_Done_80815",
  "SQ94_QD_Gonta_Orders_Done_80815_1",
  "SQ94_QD_Gonta_Orders_Done_80815_2",
  "SQ94_QD_Gonta_Orders_Done_80815_3",
  "SQ94_QD_Gonta_Orders_Done_80815_4",
  "SQ94_QD_Gonta_Orders_DoneSecond_80817",
  "SQ94_QD_Gonta_Orders_DoneSecond_80817_1",
  "SQ94_QD_Gonta_Orders_DoneSecond_80817_2",
  "SQ94_QD_Gonta_Orders_DoneSecond_80817_3",
  "SQ94_QD_Gonta_Orders_DoneSecond_80817_4",
  "SQ94_QD_Gonta_Orders_DoneThird_80819",
  "SQ94_QD_Gonta_Orders_DoneThird_80819_1",
  "SQ94_QD_Gonta_Orders_DoneThird_80819_2",
  "SQ94_QD_Gonta_Orders_DoneThird_80819_3",
];

const VENDORS: Vendor[] = [
  {
    key: "Malahit",
    questSID: "BodyParts_Malahit",
    faction: "Scientists",
    flag: MALAHIT_FLAG,
    dialogFile: "/DialogPrototypes/EQ197_QD_Orders.cfg",
    replyLines: MALAHIT_REPLY_LINES,
    nodeFile: "/QuestNodePrototypes/BodyParts_Malahit.cfg",
  },
  {
    key: "Gonta",
    questSID: "SQ94_P",
    faction: "Neutrals",
    flag: "MutantLootReputationGontaDone",
    dialogFile: "/DialogPrototypes/SQ94_QD_Gonta_Orders.cfg",
    replyLines: GONTA_REPLY_LINES,
    nodeFile: "/QuestNodePrototypes/SQ94_P.cfg",
  },
];

const nodeSID = (v: Vendor, part: string) => `${v.questSID}_MutantLootReputation_${part}`;
/** Started by meta.gameStartCommand on every world load; starts each vendor's poll loop. */
const KICK_SID = nodeSID(VENDORS[0], "Kick");

let flagsAdded = false;
function transformGlobalVariablePrototypes(struct: Struct) {
  if (flagsAdded || struct.__internal__.rawName !== "[0]") return;
  flagsAdded = true;
  return VENDORS.map((v) => root<Struct>(v.flag, { Type: "EGlobalVariableType::Int", DefaultValue: 0 }));
}
transformGlobalVariablePrototypes.files = ["/GlobalVariablePrototypes.cfg"];

function transformVendorDialogs(struct: Struct & { SID?: string }) {
  const v = VENDORS.find((v) => v.replyLines.includes(struct.SID));
  if (!v) return;
  const fork = struct.fork();
  const action = () =>
    new Struct({
      DialogAction: "EDialogAction::SetGlobalVariable",
      GlobalVariablePrototypeSID: v.flag,
      // A counter: several hand-ins between two loop ticks each pay (with Set 1, 50 hand-ins paid 15 times).
      ChangeValueMode: "EChangeValueMode::Add",
      VariableValue: 1,
    });
  // Slot [2] next to vanilla [0]/[1], in both lists (StashClueRework uses [3]). The lists are forked
  // (bpatch) so the vanilla entries stay: a plain new Struct replaced them and the hand-in stopped
  // taking the parts and paying (2026-11-19).
  for (const key of ["DialogActions", "DialogAnswerActions"] as const) {
    const list = (struct as any)[key];
    if (!list?.fork) continue;
    const patched = list.fork();
    patched.__internal__.isArray = true;
    patched.__internal__.useAsterisk = false;
    patched.addNode(action(), 2);
    (fork as any)[key] = patched;
  }
  return fork;
}
transformVendorDialogs.files = [...new Set(VENDORS.map((v) => v.dialogFile))];

/**
 * Poll loop (2026-11-19): vanilla nodes never launch a mod node in these quests, but mod -> mod launches
 * and launches by SID work. TickA/TickB re-check the flag every 3 s.
 */
function vendorNodes(v: Vendor) {
  const Q = v.questSID;
  const tech = (part: string, delay: number) =>
    root<QuestNodePrototype>(nodeSID(v, part), {
      QuestSID: Q,
      NodeType: "EQuestNodeType::Technical",
      Repeatable: true,
      StartDelay: delay,
    });
  const tickA = tech("TickA", 3);
  const tickB = tech("TickB", 3);
  tickA.Launchers = getLaunchers([{ SID: tickB.SID }]);
  tickB.Launchers = getLaunchers([{ SID: tickA.SID }]);
  const ifDone = root<QuestNodePrototype>(nodeSID(v, "IfDone"), {
    QuestSID: Q,
    NodeType: "EQuestNodeType::Condition",
    Repeatable: true,
    Conditions: new Struct({
      0: new Struct({
        0: new Struct({
          ConditionType: "EQuestConditionType::GlobalVariable",
          ConditionComparance: "EConditionComparance::Greater",
          GlobalVariablePrototypeSID: v.flag,
          ChangeValueMode: "EChangeValueMode::Set",
          VariableValue: 0,
        }),
      }),
      ConditionCheckType: "EConditionCheckType::And",
    }),
  });
  ifDone.Launchers = getLaunchers([{ SID: tickA.SID }]);
  const reputation = newChangeRelationships(nodeSID(v, "Reputation"), Q, v.faction, [ifDone.SID]);
  // One payout per tick: take one hand-in off the counter.
  const clear = root<QuestNodePrototype>(nodeSID(v, "ClearFlag"), {
    QuestSID: Q,
    NodeType: "EQuestNodeType::SetGlobalVariable",
    Repeatable: true,
    GlobalVariablePrototypeSID: v.flag,
    ChangeValueMode: "EChangeValueMode::Subtract",
    VariableValue: 1,
  });
  clear.Launchers = getLaunchers([{ SID: reputation.SID }]);
  return [tickA, tickB, ifDone, reputation, clear];
}

/** The load kick: starts the first vendor's loop directly and the others' through a console command. */
function kickNodes() {
  const first = VENDORS[0];
  const kick = root<QuestNodePrototype>(KICK_SID, {
    QuestSID: first.questSID,
    NodeType: "EQuestNodeType::Technical",
    Repeatable: true,
    StartDelay: 5, // chains started right at world load get dropped
  });
  const nodes: QuestNodePrototype[] = [kick];
  VENDORS.forEach((v, i) => {
    if (i === 0) return;
    const c = root<QuestNodePrototype>(nodeSID(first, `Kick${v.key}`), {
      QuestSID: first.questSID,
      NodeType: "EQuestNodeType::ConsoleCommand",
      Repeatable: true,
      ConsoleCommand: `XStartQuestNodeBySID ${nodeSID(v, "TickA")}`,
    });
    c.Launchers = getLaunchers([{ SID: KICK_SID }]);
    nodes.push(c);
  });
  return nodes;
}

const emitted = new Set<string>();
function transformVendorNodes(_struct: QuestNodePrototype, context: { filePath: string }) {
  const v = VENDORS.find((v) => context.filePath.endsWith(v.nodeFile));
  if (!v || emitted.has(v.key)) return;
  emitted.add(v.key);
  const nodes = vendorNodes(v);
  if (v === VENDORS[0]) {
    // The first vendor's TickA also starts from the kick.
    nodes[0].Launchers = getLaunchers([{ SID: nodeSID(v, "TickB") }, { SID: KICK_SID }]);
    nodes.push(...kickNodes());
  }
  return nodes;
}
transformVendorNodes.files = VENDORS.map((v) => v.nodeFile);

export const meta: MetaType = {
  description: `
Mutant loot turn-in orders now also grant faction reputation on top of the coupons: +${RELATIONSHIP_DELTA} with the [b]Scientists[/b] for Viktoria Doroznuk's orders at Malachite, +${RELATIONSHIP_DELTA} with the [b]Neutrals[/b] for Gonta's. Roughly 21 orders takes a faction from neutral to friendly; money rewards and the orders themselves are untouched.
`,
  changenote: "Fixed mutant loot turn-ins never granting reputation.",
  // Starts the vendors' poll loops on every world load (see kickNodes).
  gameStartCommand: `XStartQuestNodeBySID ${KICK_SID}`,
  structTransformers: [transformGlobalVariablePrototypes, transformVendorDialogs, transformVendorNodes],
};
