import { C } from "./coverText.mts";
import { npc, player, type Branch, type Label, type Next, type Picker, type Topic } from "./dialog.mts";
import { attackAction, getItemAction, globalVar, itemCount, setVarAction } from "./conditions.mts";
import { BAGOR, COVER_REWARD, DEALER_PDA, DECIDER_ITEM, NAME_NOTE, ROLLS, SULTAN_CHARACTER, VAR, WARD_CHARACTER } from "./cover.mts";
import type { TemplateByLanguage } from "../../src/localization/text.mts";

// Wolf's offer.

export const COVER_ACCEPTED: Label = {
  name: "Accepted",
  option: C.acceptedOption,
  lines: [player(C.accepted), npc(C.acceptedWolf1), npc(C.acceptedWolf2)],
};
export const COVER_DECLINED: Label = {
  name: "Declined",
  option: C.declinedOption,
  lines: [player(C.declined), npc(C.declinedWolf)],
};
const coverJob: Picker = { name: "WaitForReply", choices: [] };
coverJob.choices.push(
  {
    name: "Name",
    option: C.nameOption,
    // Wolf writes the name down; the note in Skif's pocket is what the dealers' name check needs.
    lines: [player(C.name1), npc(C.name2, { actions: [getItemAction(NAME_NOTE)] })],
    info: true,
    next: coverJob,
  },
  { name: "HowIn", option: C.howInOption, lines: [player(C.howIn1), npc(C.howIn2), npc(C.howIn3)], info: true, next: coverJob },
  COVER_ACCEPTED,
  COVER_DECLINED,
);

/** The prisoners didn't know the sniper's post, but they knew who his crew sells to. */
export const COVER_ACCEPT: Topic = {
  name: "Cover_Accept",
  title: C.offerTopic,
  opening: {
    name: "Offer",
    option: C.offerTopic,
    lines: [npc(C.offer1), player(C.offer2), npc(C.offer3), npc(C.offer4), player(C.offer5), npc(C.offer6)],
    next: coverJob,
  },
};

// Wolf's hand-in: what the lead said, or the dealers' PDA after a fight. Same pay either way.

export const COVER_PAYOFF: Label = {
  name: "Payoff",
  option: C.intelOption,
  lines: [npc(C.payoff1), npc(C.payoff2, { money: COVER_REWARD }), player(C.payoff3), npc(C.payoff4)],
};
export const COVER_NOT_YET: Label = {
  name: "NotYet",
  option: C.notYetOption,
  lines: [player(C.notYet), npc(C.notYetWolf)],
};

export const COVER_TURNIN: Topic = {
  name: "Cover_TurnIn",
  title: C.turnInTopic,
  opening: {
    name: "Ask",
    option: C.turnInTopic,
    lines: [npc(C.ask)],
    // Whether the lead talked decides which hand-in Skif gets; a dialog `If`, as vanilla branches on
    // global variables (reply conditions on them showed both replies).
    next: {
      name: "IfIntel",
      when: [globalVar(VAR.intel, "Equal", 1)],
      then: {
        name: "IntelReply",
        choices: [{ name: "Intel", option: C.intelOption, lines: [player(C.intel)], next: COVER_PAYOFF }, COVER_NOT_YET],
      },
      else: {
        name: "PDAReply",
        choices: [
          { name: "PDA", option: C.pdaOption, lines: [player(C.pda)], needsItem: DEALER_PDA, next: COVER_PAYOFF },
          COVER_NOT_YET,
        ],
      },
    },
  },
};

// The Sultan's favor: two of his lads wait outside the meeting.

export const FAVOR_ACCEPTED: Label = {
  name: "Accepted",
  option: C.favorAcceptedOption,
  lines: [player(C.favorAccepted), npc(C.favorAcceptedSultan)],
};
export const FAVOR_DECLINED: Label = {
  name: "Declined",
  option: C.favorDeclinedOption,
  lines: [player(C.favorDeclined), npc(C.favorDeclinedSultan)],
};

export const FAVOR: Topic = {
  name: "Cover_Favor",
  title: C.favorTopic,
  character: SULTAN_CHARACTER,
  opening: {
    name: "Ask",
    option: C.favorTopic,
    lines: [player(C.favor1), npc(C.favor2), player(C.favor3), npc(C.favor4)],
    next: { name: "WaitForReply", choices: [FAVOR_ACCEPTED, FAVOR_DECLINED] },
  },
};

// Hook (Vasyan Bariga), the Sultan's go-between: a word to the stalker his lads just robbed, then one to
// Skif, and he goes for him. The PDA comes off his body.

export const HOOK_COMMENT: Topic = {
  name: "Cover_HookComment",
  title: C.hookCorpse,
  character: BAGOR,
  comment: true,
  opening: { name: "Corpse", option: C.hookCorpse, lines: [npc(C.hookCorpse)], terminate: true },
};

export const HOOK: Topic = {
  name: "Cover_Hook",
  title: C.hookGreet,
  character: BAGOR,
  opening: {
    name: "Greet",
    option: C.hookGreet,
    lines: [npc(C.hookGreet, { actions: [attackAction()] })],
    terminate: true,
  },
};

// The meeting. Rolls and slips branch through dialog `If` nodes (see Branch in ./dialog.mts), so the
// player sees one reply per choice. The first slip costs the lead's patience (Strike = 1), the second
// blows the cover.

/**
 * Blown cover: the lead's accusation, then the order to fire, which closes the dialog and starts the
 * fight. Two lines, so the accusation stays on screen long enough to read.
 */
export const MEETING_LOUD: Label = {
  name: "Loud",
  option: C.loud,
  lines: [npc(C.loud), npc(C.loudFire, { actions: [attackAction()] })],
  terminate: true,
};
/** The lead gives up the sniper's post. */
export const MEETING_INTEL: Label = {
  name: "Intel",
  option: C.intelLead1,
  lines: [npc(C.intelLead1), npc(C.intelLead2)],
  terminate: true,
};

/** A slip: the first one is the lead's warning (`line`), then `next`; the second blows the cover. */
const slip = (name: string, line: TemplateByLanguage, next: Next): Branch => ({
  name: `${name}_IfFirstSlip`,
  when: [globalVar(VAR.strike, "Equal", 0)],
  then: { name: `${name}_Slip`, option: line, lines: [npc(line, { actions: [setVarAction(VAR.strike, 1)] })], next },
  else: MEETING_LOUD,
});

/** A bluff's outcome: passes when the roll (bonus included) meets its difficulty, else slips. */
const roll = (name: string, r: (typeof ROLLS)[number], pass: Next, fail: Next): Branch => ({
  name: `${name}_IfRoll`,
  when: [globalVar(r.variable, "GreaterOrEqual", r.dc)],
  then: pass,
  else: fail,
});

/** A wrong quiz answer: no roll, always a slip. */
const wrong = (name: string, option: TemplateByLanguage, line: TemplateByLanguage, warning: TemplateByLanguage, next: Next): Label => ({
  name,
  option,
  lines: [player(line)],
  next: slip(name, warning, next),
});

const [HOOK_ROLL, FISH_ROLL, FISH2_ROLL] = ROLLS;

// Built back to front: each step is the next one's `next`.

const fish2: Label = {
  name: "Fish2",
  option: C.fishFail,
  lines: [npc(C.fishFail, { actions: [setVarAction(VAR.strike, 1)] })],
  next: {
    name: "Fish2Reply",
    choices: [
      {
        name: "Fish2Try",
        option: C.fish2Option,
        lines: [player(C.fish2Line)],
        // The last chance: passing gives the post, failing blows the cover.
        next: roll("Fish2", FISH2_ROLL, MEETING_INTEL, MEETING_LOUD),
      },
    ],
  },
};

const fishPass: Label = {
  name: "FishPass",
  option: C.fishPassLead,
  lines: [npc(C.fishPassLead), player(C.fishPassLine)],
  next: MEETING_INTEL,
};

const fish: Label = {
  name: "Fish",
  option: C.fish,
  lines: [npc(C.fish)],
  next: {
    name: "FishReply",
    choices: [
      {
        name: "FishTry",
        option: C.fishOption,
        lines: [player(C.fishLine)],
        // A pass: the lead owns up to the marksman and Skif asks where, before the post.
        next: roll("Fish", FISH_ROLL, fishPass, {
          name: "Fish_IfFirstSlip",
          when: [globalVar(VAR.strike, "Equal", 0)],
          then: fish2,
          else: MEETING_LOUD,
        }),
      },
    ],
  },
};

const quiz2: Label = {
  name: "Quiz2",
  option: C.quiz2,
  lines: [npc(C.quiz2)],
  next: {
    name: "Quiz2Reply",
    choices: [
      wrong("Quiz2_Wrong1", C.quiz2Wrong1Option, C.quiz2Wrong1, C.quiz2WrongLead, fish),
      wrong("Quiz2_Wrong2", C.quiz2Wrong2Option, C.quiz2Wrong2, C.quiz2WrongLead, fish),
      { name: "Quiz2_Right", option: C.quiz2RightOption, lines: [player(C.quiz2Right), npc(C.quiz2RightLead)], next: fish },
    ],
  },
};

const quiz1: Label = {
  name: "Quiz1",
  option: C.quiz1a,
  lines: [npc(C.quiz1a), npc(C.quiz1b)],
  next: {
    name: "Quiz1Reply",
    choices: [
      wrong("Quiz1_Wrong1", C.quiz1Wrong1Option, C.quiz1Wrong1, C.quiz1WrongLead, quiz2),
      { name: "Quiz1_Right", option: C.quiz1RightOption, lines: [player(C.quiz1Right), npc(C.quiz1RightLead)], next: quiz2 },
      wrong("Quiz1_Wrong2", C.quiz1Wrong2Option, C.quiz1Wrong2, C.quiz1WrongLead, quiz2),
    ],
  },
};

// What Skif brings. The bonus itself is added to the rolls by quest nodes as he walks in (see
// coverNodes.mts); the dialog only says it out loud.
const badge: Branch = {
  name: "IfBadge",
  when: [globalVar(VAR.hasBadge, "Equal", 1)],
  then: { name: "Badge", option: C.badge, lines: [player(C.badge), npc(C.badgeLead)], next: quiz1 },
  else: quiz1,
};
const ifName = (name: string, withName: Label, without: Label): Branch => ({
  name: `${name}_IfName`,
  when: [itemCount(NAME_NOTE)],
  then: withName,
  else: without,
});

const proof: Label = {
  name: "Proof",
  option: C.proof,
  lines: [npc(C.proof)],
  next: {
    name: "ProofReply",
    choices: [
      {
        name: "ShowRifle",
        option: C.rifleOption,
        lines: [player(C.rifle)],
        needsItem: DECIDER_ITEM,
        next: ifName(
          "Rifle",
          { name: "RifleName", option: C.rifleName, lines: [player(C.rifleName), npc(C.rifleNameLead)], next: badge },
          { name: "RifleOnly", option: C.rifleLead, lines: [npc(C.rifleLead)], next: badge },
        ),
      },
      {
        name: "Describe",
        option: C.describeOption,
        lines: [player(C.describe)],
        conditions: [itemCount(DECIDER_ITEM, "Less", 1)],
        next: ifName(
          "Describe",
          { name: "DescribeName", option: C.nameOnly, lines: [player(C.nameOnly), npc(C.nameOnlyLead)], next: badge },
          { name: "DescribeOnly", option: C.describeLead, lines: [npc(C.describeLead)], next: badge },
        ),
      },
    ],
  },
};

const hookPassed: Label = { name: "HookPassed", option: C.hookPass, lines: [npc(C.hookPass)], next: proof };

export const MEETING: Topic = {
  name: "Cover_Meeting",
  title: C.meetingTopic,
  character: WARD_CHARACTER,
  opening: {
    name: "Greet",
    option: C.meetingTopic,
    lines: [npc(C.greet1), npc(C.greet2)],
    next: {
      name: "PasswordReply",
      choices: [
        // No password, no deal.
        { name: "NoPassword", option: C.noPasswordOption, lines: [player(C.noPassword)], next: MEETING_LOUD },
        {
          name: "Password",
          option: C.passwordOption,
          lines: [player(C.password), npc(C.passwordLead)],
          next: {
            name: "HookReply",
            choices: [
              { name: "HookTruth", option: C.hookTruthOption, lines: [player(C.hookTruth)], next: MEETING_LOUD },
              {
                name: "Hook",
                option: C.hookOption,
                lines: [player(C.hook)],
                next: roll("Hook", HOOK_ROLL, hookPassed, slip("Hook", C.hookFail, proof)),
              },
            ],
          },
        },
      ],
    },
  },
};

export const COVER_TOPICS = [COVER_ACCEPT, COVER_TURNIN, FAVOR, HOOK_COMMENT, HOOK, MEETING];
