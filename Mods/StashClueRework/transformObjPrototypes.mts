import type { MetaContext, StructTransformer } from "../../src/meta-type.mts";
import { isHumanNpc, type NpcPrototype } from "../../src/human-npc-prototypes.mts";

/**
 * The game ignores inherited patches, so patching only `NPCBase` & friends left most NPCs
 * still generating vanilla stash clues. Every human NPC prototype is patched directly instead.
 */
export const transformObjPrototypes: StructTransformer<NpcPrototype> = async (
  struct,
  context: MetaContext<NpcPrototype>,
) => {
  if (!isHumanNpc(struct, context)) return;
  const fork = struct.fork() as NpcPrototype;
  fork.ShouldGenerateStashClues = false;
  return fork;
};
transformObjPrototypes.files = ["ObjPrototypes"];
transformObjPrototypes.contains = true;
