import type { QuestNodePrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType<QuestNodePrototype> = {
  description:
    `This mod does only one thing: completely eliminates cooldown between barkeep/vendor/mechanic quests.[hr][/hr]Because Waiting Is for the Weak.[hr][/hr]It is meant to be used in other collections of mods. Modifies recurring quest node InGameHours. [hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.`,
  changenote: "Added support for Honta mutant loot turn-in quests.",
  structTransformers: [noQuestCooldownTransformer],
};

function noQuestCooldownTransformer(struct: QuestNodePrototype) {
  const inGameHours = (struct as any).InGameHours;
  if (typeof inGameHours === "number" && inGameHours > 0) {
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
  "/QuestNodePrototypes/SQ94_P.cfg",
];
