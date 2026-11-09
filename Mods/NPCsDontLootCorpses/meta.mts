import type { MetaContext, MetaType } from "../../src/meta-type.mts";
import { isHumanNpc, type NpcPrototype } from "../../src/human-npc-prototypes.mts";

export const meta: MetaType<NpcPrototype> = {
  description:
    `[b]Known issue:[/b] due to some circumstances, NPCs still loot bodies at times. I've asked GSC to look into it; no ETA was given, and it's a low-priority fix.[hr][/hr]This mod prevents NPCs from looting corpses.[hr][/hr]Prevents situations where when you loot a body you find 15 armors and 25 weapons on them.`,
  changenote:
    "Added a known-issue note: NPCs can still loot bodies in some cases, and GSC has been asked to look into it.",
  structTransformers: [transformNpcCorpseProcessing],
};

function transformNpcCorpseProcessing(struct: NpcPrototype, context: MetaContext<NpcPrototype>) {
  if (!isHumanNpc(struct, context)) return;
  const fork = struct.fork() as NpcPrototype;
  fork.CanProcessCorpses = false;
  return fork;
}

transformNpcCorpseProcessing.files = ["ObjPrototypes"];
transformNpcCorpseProcessing.contains = true;
