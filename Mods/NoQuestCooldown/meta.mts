import { Entries } from "s2cfgtojson";

export const meta = {
  interestingFiles: [
    "BodyParts_Malahit.cfg",
    "RSQ01.cfg",
    "RSQ04.cfg",
    "RSQ05.cfg",
    "RSQ06_C00___SIDOROVICH.cfg",
    "RSQ07_C00_TSEMZAVOD.cfg",
    "RSQ08_C00_ROSTOK.cfg",
    "RSQ09_C00_MALAHIT.cfg",
    "RSQ10_C00_HARPY.cfg",
  ],
  interestingContents: [],
  prohibitedIds: [],
  interestingIds: [],
  description:
    "This mode does only one thing: completely eliminates (well, brings it down to about 30 sec - engine limitation) cooldown between barkeep/vendor/mechanic quests. --- Because Waiting Is for the Weak. --- It is meant to be used in other collections of mods. Does not conflict with anything.",
  changenote: "Update to 1.5.2",
  entriesTransformer: (entries: Entries) => {
    if (entries.InGameHours) {
      return { InGameHours: 0 };
    }
    return null;
  },
};
