import type { ObjPrototype, QuestObjPrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";

type LootingNpcPrototype = ObjPrototype | QuestObjPrototype;

export const meta: MetaType<LootingNpcPrototype> = {
  description: "This mod prevents NPCs from looting corpses.[hr][/hr]Prevents situations where when you loot a body you find 15 armors and 25 weapons on them.",
  changenote: "Initial release",
  structTransformers: [transformNpcCorpseProcessing],
};

function transformNpcCorpseProcessing(struct: LootingNpcPrototype) {
  if (struct.CanProcessCorpses) {
    const fork = struct.fork() as LootingNpcPrototype;
    fork.CanProcessCorpses = false;
    return fork;
  }
}

transformNpcCorpseProcessing.files = ["/ObjPrototypes.cfg", "/ObjPrototypes/GeneralNPCObjPrototypes.cfg", "/ObjPrototypes/QuestObjPrototypes.cfg"];
