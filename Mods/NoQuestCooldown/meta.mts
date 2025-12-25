import { QuestNodePrototype } from "s2cfgtojson";
import { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType<QuestNodePrototype> = {
  description:
    "This mod does only one thing: completely eliminates cooldown between barkeep/vendor/mechanic quests.[hr][/hr]Because Waiting Is for the Weak.[hr][/hr]It is meant to be used in other collections of mods. Modifies recurring quest node InGameHours.",
  changenote: "Rebuild for 1.8.1",
  structTransformers: [noQuestCooldownTransformer],
};

function noQuestCooldownTransformer(struct: QuestNodePrototype) {
  if (struct.InGameHours) {
    return Object.assign(struct.fork(), { InGameHours: 0 });
  }
  return null;
}

noQuestCooldownTransformer.files = [
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
