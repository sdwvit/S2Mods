import type { ObjPrototype, QuestObjPrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";

type LootingNpcPrototype = ObjPrototype | QuestObjPrototype;

export const meta: MetaType<LootingNpcPrototype> = {
  description:
    "This mod prevents NPCs from looting corpses.[hr][/hr]Prevents situations where when you loot a body you find 15 armors and 25 weapons on them.",
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
