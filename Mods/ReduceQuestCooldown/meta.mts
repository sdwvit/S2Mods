import { QuestNodePrototype } from "s2cfgtojson";
import { MetaType } from "../../src/metaType.mjs";

export const meta: MetaType<QuestNodePrototype> = {
  description:
    "This mod does only one thing: reduces cooldown between barkeep/vendor/mechanic quests to 3 in-game hours. [hr][/hr] Because Waiting Is for the Weak. [hr][/hr] It is meant to be used in other collections of mods. Modifies recurring quest node InGameHours.",
  changenote: "Update with bpatch for higher compatibility.",
  structTransformers: [reduceQuestCooldownTransformer],
};

function reduceQuestCooldownTransformer(struct: QuestNodePrototype) {
  if (struct.InGameHours) {
    return Object.assign(struct.fork(), { InGameHours: Math.min(struct.InGameHours, 3) });
  }
  return null;
}

reduceQuestCooldownTransformer.files = [
  "/QuestNodePrototypes/BodyParts_Malahit.cfg",
  "/QuestNodePrototypes/RSQ01.cfg",
  "/QuestNodePrototypes/RSQ04.cfg",
  "/QuestNodePrototypes/RSQ05.cfg",
  "/QuestNodePrototypes/RSQ06_C00___SIDOROVICH.cfg",
  "/QuestNodePrototypes/RSQ07_C00_TSEMZAVOD.cfg",
  "/QuestNodePrototypes/RSQ08_C00_ROSTOK.cfg",
  "/QuestNodePrototypes/RSQ09_C00_MALAHIT.cfg",
  "/QuestNodePrototypes/RSQ10_C00_HARPY.cfg",
];
