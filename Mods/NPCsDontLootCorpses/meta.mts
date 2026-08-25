import type { ObjPrototype, QuestObjPrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";

type LootingNpcPrototype = ObjPrototype | QuestObjPrototype;

export const meta: MetaType<LootingNpcPrototype> = {
  description:
    `[h1]Deprecated in 2.0[/h1]
[h1][/h1]
With the new game on the new Unreal Engine, mod structure changes — some mods are now part of the base game. Replacements will be released as separate mods. This mod prevents NPCs from looting corpses.[hr][/hr]Prevents situations where when you loot a body you find 15 armors and 25 weapons on them. [hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.`,
  changenote:
    "Patch all current ObjPrototypes entries with CanProcessCorpses and keep NPCBase disabled as a fallback.",
  structTransformers: [transformNpcCorpseProcessing],
};

function transformNpcCorpseProcessing(struct: LootingNpcPrototype) {
  if (struct.CanProcessCorpses || struct.SID === "NPCBase") {
    const fork = struct.fork() as LootingNpcPrototype;
    fork.CanProcessCorpses = false;
    return fork;
  }
}

transformNpcCorpseProcessing.files = ["ObjPrototypes"];
transformNpcCorpseProcessing.contains = true;
