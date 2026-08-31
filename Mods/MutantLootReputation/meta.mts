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
 * last-phrase output of the relevant SetDialog node. New SIDs mean nothing in the vanilla
 * graph can exclude them, and they carry no saved state, so the mod also works on an
 * existing save. No vanilla struct is modified — the money reward is untouched, this is
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

/** Every "order complete" ending of SQ94_QD_Gonta_Orders (Gonta). */
const GONTA_DONE_PHRASES = [
  "SQ94_QD_Gonta_Orders_Done_80816",
  "SQ94_QD_Gonta_Orders_Done_80816_1",
  "SQ94_QD_Gonta_Orders_Done_80816_2",
  "SQ94_QD_Gonta_Orders_Done_80816_3",
  "SQ94_QD_Gonta_Orders_Done_80816_4",
  "SQ94_QD_Gonta_Orders_DoneSecond_80818",
  "SQ94_QD_Gonta_Orders_DoneSecond_80818_1",
  "SQ94_QD_Gonta_Orders_DoneSecond_80818_2",
  "SQ94_QD_Gonta_Orders_DoneSecond_80818_3",
  "SQ94_QD_Gonta_Orders_DoneSecond_80818_4",
  "SQ94_QD_Gonta_Orders_DoneThird_80820",
  "SQ94_QD_Gonta_Orders_DoneThird_80820_1",
  "SQ94_QD_Gonta_Orders_DoneThird_80820_2",
  "SQ94_QD_Gonta_Orders_DoneThird_80820_3",
];

/**
 * A brand new root-level quest node. `isRoot` + `rawName` make it serialize as its own
 * top-level struct; no refkey/refurl, since ChangeRelationships nodes are self-contained and
 * inheriting from an unrelated node would drag its launchers along.
 */
function newChangeRelationships(
  sid: string,
  questSID: string,
  factionSID: string,
  launcherSID: string,
  phrases: string[],
) {
  const node = new Struct({
    SID: sid,
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
  }) as QuestNodePrototype;

  node.__internal__.isRoot = true;
  node.__internal__.rawName = sid;
  delete (node.__internal__ as any).refkey;
  delete (node.__internal__ as any).refurl;

  // One launcher per phrase: launchers are OR-ed, connections inside one launcher are AND-ed.
  node.Launchers = getLaunchers(phrases.map((Name) => ({ SID: launcherSID, Name })));

  return node;
}

function transformBodyPartsMalahit(struct: QuestNodePrototype) {
  // Anchored on the SetDialog node purely so this runs exactly once. It is not modified.
  if (struct.SID !== "BodyParts_Malahit_SetDialog_EQ197_QD_Orders") return;

  return newChangeRelationships(
    "BodyParts_Malahit_ChangeRelationships_MutantLootReputation",
    "BodyParts_Malahit",
    "Scientists",
    "BodyParts_Malahit_SetDialog_EQ197_QD_Orders",
    MALAHIT_DONE_PHRASES,
  );
}
transformBodyPartsMalahit.files = ["/BodyParts_Malahit.cfg"];

function transformSQ94P(struct: QuestNodePrototype) {
  // SQ94_P drives Gonta's orders through two separate SetDialog nodes on the same dialog
  // chain, so each one needs its own ChangeRelationships node.
  if (struct.SID !== "SQ94_P_SetDialog_SQ94_QD_Gonta_Orders") return;

  return [
    newChangeRelationships(
      "SQ94_P_ChangeRelationships_MutantLootReputation",
      "SQ94_P",
      "Neutrals",
      "SQ94_P_SetDialog_SQ94_QD_Gonta_Orders",
      GONTA_DONE_PHRASES,
    ),
    newChangeRelationships(
      "SQ94_P_ChangeRelationships_MutantLootReputation_STD119736",
      "SQ94_P",
      "Neutrals",
      "SQ94_P_SetDialog_SQ94_QD_Gonta_Orders_STD119736",
      GONTA_DONE_PHRASES,
    ),
  ];
}
transformSQ94P.files = ["/SQ94_P.cfg"];

export const meta: MetaType = {
  description: `
Mutant loot turn-in orders now also grant faction reputation on top of the coupons: +${RELATIONSHIP_DELTA} with the [b]Scientists[/b] for Viktoria Doroznuk's orders at Malachite, +${RELATIONSHIP_DELTA} with the [b]Neutrals[/b] for Gonta's. Roughly 21 orders takes a faction from neutral to friendly; money rewards and the orders themselves are untouched.

[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Initial release.",
  structTransformers: [transformBodyPartsMalahit, transformSQ94P],
};
