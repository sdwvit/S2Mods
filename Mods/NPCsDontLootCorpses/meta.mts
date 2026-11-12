import type { MetaContext, MetaType } from "../../src/meta-type.mts";
import { isHumanNpc, type NpcPrototype } from "../../src/human-npc-prototypes.mts";

export const meta: MetaType<NpcPrototype> = {
  description: `[h1]Deprecated for now[/h1]
[h1][/h1]
NPCs still loot bodies: the game has a second corpse-looting path (A-Life) that ignores the setting this mod changes, so no config mod can fully stop it. The mod will come back if GSC fixes it.[hr][/hr]This mod prevents NPCs from looting corpses.[hr][/hr]Prevents situations where when you loot a body you find 15 armors and 25 weapons on them.`,
  changenote: "Marked as deprecated: the game loots bodies through a second path that ignores this mod's setting.",
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
