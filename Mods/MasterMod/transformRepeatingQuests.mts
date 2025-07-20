/**
 * Removes timeout for repeating quests.
 */
export function transformRepeatingQuests(entries: { InGameHours: number }, { file }: { file: string }) {
  if (!repeatingQuests.some((q) => file.includes(q))) {
    return entries;
  }
  return { InGameHours: 0 };
}

export const repeatingQuests = [
  "QuestNodePrototypes/BodyParts_Malahit.cfg",
  "QuestNodePrototypes/RSQ01.cfg",
  "QuestNodePrototypes/RSQ04.cfg",
  "QuestNodePrototypes/RSQ05.cfg",
  "QuestNodePrototypes/RSQ06_C00___SIDOROVICH.cfg",
  "QuestNodePrototypes/RSQ07_C00_TSEMZAVOD.cfg",
  "QuestNodePrototypes/RSQ08_C00_ROSTOK.cfg",
  "QuestNodePrototypes/RSQ09_C00_MALAHIT.cfg",
  "QuestNodePrototypes/RSQ10_C00_HARPY.cfg",
];
