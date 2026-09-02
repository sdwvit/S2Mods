import type { ObjPrototype, QuestObjPrototype, Struct } from "s2cfgtojson";
import type { MetaContext, MetaType } from "../../src/meta-type.mts";
import {
  allDefaultGeneralNPCObjPrototypesRecord,
  allDefaultObjPrototypesRecordByRawName,
  allDefaultQuestObjPrototypesRecord,
  getCorePrototype,
} from "../../src/consts.mts";

type LootingNpcPrototype = ObjPrototype | QuestObjPrototype;

export const meta: MetaType<LootingNpcPrototype> = {
  description:
    `This mod prevents NPCs from looting corpses.[hr][/hr]Prevents situations where when you loot a body you find 15 armors and 25 weapons on them. [hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.`,
  changenote:
    "Fixed NPCs still looting corpses — the game ignores inherited patches, so every human NPC prototype is now patched directly. Mutants are left alone and keep eating corpses.",
  structTransformers: [transformNpcCorpseProcessing],
};

/** Every named prototype a `refkey` can point at, keyed the way `refkey` addresses it. */
const objPrototypesByRefkey = {
  ...allDefaultObjPrototypesRecordByRawName,
  ...allDefaultGeneralNPCObjPrototypesRecord,
  ...allDefaultQuestObjPrototypesRecord,
} as Record<string, LootingNpcPrototype>;

/** The player is an ObjPrototype too, and its corpse processing is the player's own looting. */
const EXCLUDED_SIDS = new Set(["Player"]);

/** Inheritance chains are a few levels deep; anything longer means an unresolvable refkey. */
const MAX_INHERITANCE_HOPS = 32;

const collectionsByFile: Record<string, Record<string, LootingNpcPrototype>> = {};
const isMutantFileByPath: Record<string, boolean> = {};

function getCollection(context: MetaContext<LootingNpcPrototype>) {
  return (collectionsByFile[context.filePath] ||= {
    ...objPrototypesByRefkey,
    ...context.structsById,
    ...Object.fromEntries(context.array.map((s) => [s.SID, s])),
  });
}

/**
 * Every mutant creature has its own file inheriting `MutantBase.cfg`, and its structs
 * inherit each other by position (`refkey=[0]`), which no cross-file lookup can resolve.
 * Recognising the file is enough — and mutants are meant to keep eating corpses anyway.
 */
function isMutantFile(context: MetaContext<LootingNpcPrototype>) {
  return (isMutantFileByPath[context.filePath] ??= context.array.some((s) =>
    String(s.__internal__.refurl || "").includes("MutantBase"),
  ));
}

/**
 * The inheritance chain is walked up to the first prototype declaring an `AgentType`:
 * humans reach `EAgentType::Human` (declared on the ObjPrototypes root), the odd mutant
 * living among the NPC prototypes stops at `EAgentType::MutantGeneric`. A chain that ends
 * without declaring one still bottoms out at the human root.
 */
function isHumanNpc(struct: LootingNpcPrototype, context: MetaContext<LootingNpcPrototype>) {
  if (EXCLUDED_SIDS.has(String(struct.SID)) || isMutantFile(context)) return false;
  const collection = { ...getCollection(context), [struct.SID]: struct };
  let hops = 0;
  const core = getCorePrototype(struct.SID, collection as Record<string, Struct>, (s) => {
    // getCorePrototype probes one struct past the end of the chain, which may be absent
    if (!s || ++hops > MAX_INHERITANCE_HOPS) return true;
    return (s as LootingNpcPrototype).AgentType;
  }) as LootingNpcPrototype | undefined;
  return !core?.AgentType || core.AgentType === "EAgentType::Human";
}

function transformNpcCorpseProcessing(
  struct: LootingNpcPrototype,
  context: MetaContext<LootingNpcPrototype>,
) {
  if (!isHumanNpc(struct, context)) return;
  const fork = struct.fork() as LootingNpcPrototype;
  fork.CanProcessCorpses = false;
  return fork;
}

transformNpcCorpseProcessing.files = ["ObjPrototypes"];
transformNpcCorpseProcessing.contains = true;
