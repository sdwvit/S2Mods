import type { Struct } from "s2cfgtojson";
import { dialogTopic, phraseSID, type TemplateByLanguage } from "../../src/localization/text.mts";
import { T } from "./dialogText.mts";
import { D } from "./deciderText.mts";

export const MOD = "WolfArmorFetch";
export const WOLF_CHARACTER = "volk_1";
/**
 * The player's lines: vanilla's `sid_character_PC`. With `None` (the editor's default until a speaker is
 * picked) the editor drops the phrases from the chain's `_Voiceover` runtime data on load.
 */
const PLAYER_CHARACTER = "PC";

export const FALCON_ITEM = "HeavyBattle_Spark_Armor";
/** In-game hours between the Decider hand-in and Wolf offering the Falcon job. */
export const FALCON_OFFER_DELAY_HOURS = 1;
export const DECIDER_ITEM = "Gun_Decider_AR";
/** Wolf's "I'll pay you well", paid with his "this is for you". */
export const DECIDER_REWARD = 10000;

/**
 * A spoken line; `money` pays the player that many coupons as it plays, `actions` are more
 * `DialogActions` it runs (see `./conditions.mts`). `by: "npc"` is the topic's NPC.
 */
export type Line = { by: "npc" | "player"; text: TemplateByLanguage; money?: number; actions?: Struct[] };
/** A reply picker: the player chooses one of `choices`. */
export type Picker = { name: string; choices: Label[] };
/**
 * A branch the player never sees: vanilla's dialog `If` node (RSQ05_Dialog_Sich_C11_Finish_If_1). The
 * dialog goes on to `then` when all of `when` hold, else to `else`. Vanilla branches on global
 * variables this way, never through reply conditions.
 */
export type Branch = { name: string; when: Struct[]; then: Next; else: Next };
/** Where a label goes after its lines. */
export type Next = Picker | Label | Branch;
/**
 * A label: a reply option and the lines spoken after it, in order. Then the dialog goes on to `next`:
 * a picker, another label's lines (a branch rejoining shared lines), or nowhere, which ends it.
 * `needsItem` hides the option unless the player carries that item, and `conditions` (all of them) hide
 * it unless they hold. An `info` option is a side question: drawn white, and gone once asked.
 */
export type Label = {
  name: string;
  option: TemplateByLanguage;
  lines: Line[];
  needsItem?: string;
  conditions?: Struct[];
  info?: boolean;
  next?: Next;
  /** Close the dialog after the last line (`Terminate = true`), as vanilla's attack lines do (SQ92_Dialog_AfterFight). */
  terminate?: boolean;
};
/**
 * A topic: the NPC's opening label, and whatever it leads to. `character` is the NPC's dialog member
 * name (`sid_character_<name>`), Wolf's unless set.
 */
export type Topic = {
  name: string;
  title: TemplateByLanguage;
  opening: Label;
  character?: string;
  /**
   * The speaker the editor's text asset records for the NPC's lines, when `character` is a dialog member of the
   * mod's own: the editor drops the voice of a speaker missing from its character database at cook.
   */
  textToolCharacter?: string;
  /** Said aloud with no dialog window and no player, as vanilla's `*_Comment_*` chains (SQ18). */
  comment?: boolean;
};

/** A line spoken by the topic's NPC. */
export const npc = (text: TemplateByLanguage, extra: Partial<Line> = {}): Line => ({ by: "npc", text, ...extra });
export const player = (text: TemplateByLanguage, extra: Partial<Line> = {}): Line => ({ by: "player", text, ...extra });
const wolf = (text: TemplateByLanguage, money?: number): Line => npc(text, money ? { money } : {});

export const isPicker = (next: Next): next is Picker => "choices" in next;
export const isBranch = (next: Next): next is Branch => "when" in next;

// Falcon: the second job.

export const FALCON_ACCEPTED: Label = {
  name: "Accepted",
  option: T.acceptedOption,
  lines: [player(T.accepted), wolf(T.acceptedWolf)],
};
export const FALCON_DECLINED: Label = {
  name: "Declined",
  option: T.declinedOption,
  lines: [player(T.declined), wolf(T.declinedWolf)],
};
const falconJob: Picker = { name: "WaitForReply", choices: [] };
falconJob.choices.push(
  {
    name: "WhyFalcon",
    option: T.whyOption,
    lines: [player(T.why1), wolf(T.why2), wolf(T.why3), player(T.why4), wolf(T.why5)],
    info: true,
    next: falconJob,
  },
  {
    name: "Prisoners",
    option: T.prisonersOption,
    lines: [player(T.prisoners1), wolf(T.prisoners2), player(T.prisoners3), wolf(T.prisoners4)],
    info: true,
    next: falconJob,
  },
  {
    name: "Where",
    option: T.whereOption,
    lines: [player(T.where1), wolf(T.where2)],
    info: true,
    next: falconJob,
  },
  FALCON_ACCEPTED,
  FALCON_DECLINED,
);

/** The serial gave Wolf a name and nothing else; his plan needs a Falcon. */
export const ACCEPT: Topic = {
  name: "Dialog_Accept",
  title: T.moreWorkTopic,
  opening: {
    name: "Offer",
    option: T.moreWorkTopic,
    lines: [
      wolf(T.offer1),
      player(T.offer2),
      wolf(T.offer3),
      wolf(T.offer4),
      player(T.offer5),
      wolf(T.offer6),
      wolf(T.offer7),
    ],
    next: falconJob,
  },
};

export const FALCON_GIVE: Label = {
  name: "Give",
  option: T.giveOption,
  lines: [player(T.give), wolf(T.giveWolf1), wolf(T.giveWolf2), player(T.give2), wolf(T.giveWolf3)],
  needsItem: FALCON_ITEM,
};
export const FALCON_NOT_YET: Label = {
  name: "NotYet",
  option: T.notYetOption,
  lines: [player(T.notYet), wolf(T.notYetWolf)],
};

export const TURNIN: Topic = {
  name: "Dialog_TurnIn",
  title: T.turnInTopic,
  opening: {
    name: "Ask",
    option: T.turnInTopic,
    lines: [wolf(T.ask)],
    next: { name: "WaitForReply", choices: [FALCON_GIVE, FALCON_NOT_YET] },
  },
};

// The Decider: the first job.

const deciderJob: Picker = { name: "JobReply", choices: [] };
export const DECIDER_ACCEPTED: Label = {
  name: "Accepted",
  option: D.acceptedOption,
  lines: [player(D.accepted), wolf(D.acceptedWolf1), wolf(D.acceptedWolf2)],
};
export const DECIDER_DECLINED: Label = {
  name: "Declined",
  option: D.declinedOption,
  lines: [player(D.declined), wolf(D.declinedWolf)],
};
deciderJob.choices.push(
  // Side questions: Wolf answers and the same choice comes back, without the one asked.
  {
    name: "WhatFor",
    option: D.whatForOption,
    lines: [player(D.whatFor), wolf(D.whatForWolf1), wolf(D.whatForWolf2)],
    info: true,
    next: deciderJob,
  },
  {
    name: "Where",
    option: D.whereOption,
    lines: [player(D.where), wolf(D.whereWolf1)],
    info: true,
    next: deciderJob,
  },
  DECIDER_ACCEPTED,
  DECIDER_DECLINED,
);

/** Wolf's account of Huron and the Fora, which both "remember" branches rejoin. */
const deciderStory: Label = {
  name: "Story",
  option: T.acceptTopic,
  lines: [wolf(D.story1), wolf(D.story2), wolf(D.story3), wolf(D.story4)],
  next: deciderJob,
};

export const DECIDER_ACCEPT: Topic = {
  name: "Decider_Accept",
  title: T.acceptTopic,
  opening: {
    name: "Offer",
    option: T.acceptTopic,
    lines: [wolf(D.offer)],
    next: {
      name: "MemoryReply",
      choices: [
        { name: "Remember", option: D.rememberOption, lines: [player(D.remember), wolf(D.rememberWolf)], next: deciderStory },
        { name: "Remind", option: D.remindOption, lines: [player(D.remind), wolf(D.remindWolf)], next: deciderStory },
      ],
    },
  },
};

/** The hand-in ends on Wolf's doubt, so it counts as done once that last line is spoken. */
export const DECIDER_DOUBT: Label = {
  name: "Doubt",
  option: D.doubtOption,
  lines: [player(D.doubt), wolf(D.doubtWolf1), wolf(D.doubtWolf2)],
};
export const DECIDER_NOT_YET: Label = {
  name: "NotYet",
  option: D.notYetOption,
  lines: [player(D.notYet), wolf(D.notYetWolf)],
};

export const DECIDER_TURNIN: Topic = {
  name: "Decider_TurnIn",
  title: D.turnInTopic,
  opening: {
    name: "Ask",
    option: D.turnInTopic,
    lines: [wolf(D.ask)],
    next: {
      name: "WaitForReply",
      choices: [
        {
          name: "Give",
          option: D.giveOption,
          lines: [player(D.give), wolf(D.giveWolf1), wolf(D.giveWolf2), wolf(D.giveWolf3, DECIDER_REWARD)],
          needsItem: DECIDER_ITEM,
          next: { name: "DoubtReply", choices: [DECIDER_DOUBT] },
        },
        DECIDER_NOT_YET,
      ],
    },
  },
};

/** Wolf's first two jobs; `./topics.mts` adds the third's. */
export const TOPICS = [DECIDER_ACCEPT, DECIDER_TURNIN, ACCEPT, TURNIN];

/** The dialog chain SID, which is also the dialog asset's topic SID. */
export const chainSID = (topic: Topic) => `${MOD}_${topic.name}`;
/** Line `index` of a label: its `DialogPrototype` SID and `TextToolPhraseSID`. */
export const lineSID = (topic: Topic, label: Label, index: number) => phraseSID(MOD, topic.name, label.name, index);
/** A label's last line - the dialog ending quest nodes listen for. */
export const lastLineSID = (topic: Topic, label: Label) => lineSID(topic, label, label.lines.length - 1);
export const pickerSID = (topic: Topic, picker: Picker | Branch) => `${chainSID(topic)}_${picker.name}`;
/** The SID the dialog goes to for `next`: a picker's or branch's node, or a label's first line. */
export const nextNodeSID = (topic: Topic, next: Next) =>
  isPicker(next) || isBranch(next) ? pickerSID(topic, next) : lineSID(topic, next, 0);
/** Where the dialog goes after `label`'s last line: a picker, a branch, a label's first line, or "" (the end). */
export const nextSID = (topic: Topic, label: Label) => (label.next ? nextNodeSID(topic, label.next) : "");

/** Every label, picker and branch of a topic, each once, in the order the dialog reaches them. */
export function walk(topic: Topic) {
  const labels: Label[] = [];
  const pickers: Picker[] = [];
  const branches: Branch[] = [];
  const visit = (next: Next) => {
    if (isBranch(next)) {
      if (branches.includes(next)) return;
      branches.push(next);
      visit(next.then);
      visit(next.else);
    } else if (isPicker(next)) {
      if (pickers.includes(next)) return;
      pickers.push(next);
      next.choices.forEach(visit);
    } else {
      if (labels.includes(next)) return;
      labels.push(next);
      if (next.next) visit(next.next);
    }
  };
  visit(topic.opening);
  return { labels, pickers, branches };
}

/** The topic's NPC: its dialog member name. */
export const characterOf = (topic: Topic) => topic.character ?? WOLF_CHARACTER;

/** Every topic as the dialog asset holds it. */
export const dialogTopics = (topics: Topic[]) =>
  topics.map((topic) =>
    dialogTopic(
      MOD,
      topic.name,
      topic.title,
      [topic.textToolCharacter ?? characterOf(topic)],
      walk(topic).labels.map((label) => ({
        name: label.name,
        text: label.option,
        phrases: label.lines.map((line) => ({
          character: line.by === "npc" ? (topic.textToolCharacter ?? characterOf(topic)) : PLAYER_CHARACTER,
          text: line.text,
        })),
      })),
    ),
  );
