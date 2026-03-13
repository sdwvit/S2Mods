import type { ObjPrototype, QuestObjPrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";

type LootingNpcPrototype = ObjPrototype | QuestObjPrototype;

export const meta: MetaType<LootingNpcPrototype> = {
  description: "This mod does only one thing: it prevents NPCs from looting corpses, so they stop taking armor and weapons from dead bodies.",
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
