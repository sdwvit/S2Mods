import { dialogTopic, phraseSID, type TemplateByLanguage } from "../../src/localization/text.mts";
import { T } from "./dialogText.mts";
import { D } from "./deciderText.mts";

export const MOD = "WolfArmorFetch";
export const WOLF_CHARACTER = "volk_1";
/** The player's lines; the editor leaves a phrase's speaker as `None` until one is picked. */
const PLAYER_CHARACTER = "None";

export const FALCON_ITEM = "HeavyBattle_Spark_Armor";
/** In-game hours between the Decider hand-in and Wolf offering the Falcon job. */
export const FALCON_OFFER_DELAY_HOURS = 24;
export const DECIDER_ITEM = "Gun_Decider_AR";
/** Wolf's "I'll pay you well", paid with his "this is for you". */
export const DECIDER_REWARD = 10000;

/** A spoken line; `money` pays the player that many coupons as it plays. */
type Line = { by: "wolf" | "player"; text: TemplateByLanguage; money?: number };
/** A reply picker: the player chooses one of `choices`. */
export type Picker = { name: string; choices: Label[] };
/**
 * A label: a reply option and the lines spoken after it, in order. Then the dialog goes on to `next`:
 * a picker, another label's lines (a branch rejoining shared lines), or nowhere, which ends it.
 * `needsItem` hides the option unless the player carries that item. An `info` option is a side question:
 * drawn white, and gone once asked.
 */
export type Label = {
  name: string;
  option: TemplateByLanguage;
  lines: Line[];
  needsItem?: string;
  info?: boolean;
  next?: Picker | Label;
};
/** A topic: Wolf's opening label, and whatever it leads to. */
export type Topic = { name: string; title: TemplateByLanguage; opening: Label };

const wolf = (text: TemplateByLanguage, money?: number): Line => ({ by: "wolf", text, ...(money ? { money } : {}) });
const player = (text: TemplateByLanguage): Line => ({ by: "player", text });

export const isPicker = (next: Picker | Label): next is Picker => "choices" in next;

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

export const TOPICS = [DECIDER_ACCEPT, DECIDER_TURNIN, ACCEPT, TURNIN];

/** The dialog chain SID, which is also the dialog asset's topic SID. */
export const chainSID = (topic: Topic) => `${MOD}_${topic.name}`;
/** Line `index` of a label: its `DialogPrototype` SID and `TextToolPhraseSID`. */
export const lineSID = (topic: Topic, label: Label, index: number) => phraseSID(MOD, topic.name, label.name, index);
/** A label's last line - the dialog ending quest nodes listen for. */
export const lastLineSID = (topic: Topic, label: Label) => lineSID(topic, label, label.lines.length - 1);
export const pickerSID = (topic: Topic, picker: Picker) => `${chainSID(topic)}_${picker.name}`;
/** Where the dialog goes after `label`'s last line: a picker, a label's first line, or "" (the end). */
export const nextSID = (topic: Topic, label: Label) =>
  !label.next ? "" : isPicker(label.next) ? pickerSID(topic, label.next) : lineSID(topic, label.next, 0);

/** Every label and picker of a topic, each once, in the order the dialog reaches them. */
export function walk(topic: Topic) {
  const labels: Label[] = [];
  const pickers: Picker[] = [];
  const visit = (label: Label) => {
    if (labels.includes(label)) return;
    labels.push(label);
    if (!label.next) return;
    if (!isPicker(label.next)) return visit(label.next);
    if (pickers.includes(label.next)) return;
    pickers.push(label.next);
    label.next.choices.forEach(visit);
  };
  visit(topic.opening);
  return { labels, pickers };
}

/** Every topic as the dialog asset holds it. */
export const dialogTopics = () =>
  TOPICS.map((topic) =>
    dialogTopic(
      MOD,
      topic.name,
      topic.title,
      [WOLF_CHARACTER],
      walk(topic).labels.map((label) => ({
        name: label.name,
        text: label.option,
        phrases: label.lines.map((line) => ({
          character: line.by === "wolf" ? WOLF_CHARACTER : PLAYER_CHARACTER,
          text: line.text,
        })),
      })),
    ),
  );
