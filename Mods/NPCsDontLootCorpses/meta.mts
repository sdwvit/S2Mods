import type { MetaContext, MetaType } from "../../src/meta-type.mts";
import { isHumanNpc, type NpcPrototype } from "../../src/human-npc-prototypes.mts";

export const meta: MetaType<NpcPrototype> = {
  description:
    `This mod prevents NPCs from looting corpses.[hr][/hr]Prevents situations where when you loot a body you find 15 armors and 25 weapons on them. [hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.`,
  changenote:
    "Fixed NPCs still looting corpses — the game ignores inherited patches, so every human NPC prototype is now patched directly. Mutants are left alone and keep eating corpses.",
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
