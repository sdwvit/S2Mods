import type { ObjPrototype, QuestObjPrototype, Struct } from "s2cfgtojson";

import {
  allDefaultGeneralNPCObjPrototypesRecord,
  allDefaultObjPrototypesRecordByRawName,
  allDefaultQuestObjPrototypesRecord,
  getCorePrototype,
} from "./consts.mts";
import type { MetaContext } from "./meta-type.mts";

/** Anything an `ObjPrototypes` transformer can be handed: plain, general-NPC or quest NPC. */
export type NpcPrototype = ObjPrototype | QuestObjPrototype;

/** Every named prototype a `refkey` can point at, keyed the way `refkey` addresses it. */
const objPrototypesByRefkey = {
  ...allDefaultObjPrototypesRecordByRawName,
  ...allDefaultGeneralNPCObjPrototypesRecord,
  ...allDefaultQuestObjPrototypesRecord,
} as Record<string, NpcPrototype>;

/** The player is an ObjPrototype too, but is never an NPC. */
const EXCLUDED_SIDS = new Set(["Player"]);

/** Inheritance chains are a few levels deep; anything longer means an unresolvable refkey. */
const MAX_INHERITANCE_HOPS = 32;

const collectionsByFile: Record<string, Record<string, NpcPrototype>> = {};
const isMutantFileByPath: Record<string, boolean> = {};

function getCollection(context: MetaContext<NpcPrototype>) {
  return (collectionsByFile[context.filePath] ||= {
    ...objPrototypesByRefkey,
    ...context.structsById,
    ...Object.fromEntries(context.array.map((s) => [s.SID, s])),
  });
}

/**
 * Every mutant creature has its own file inheriting `MutantBase.cfg`, and its structs
 * inherit each other by position (`refkey=[0]`), which no cross-file lookup can resolve.
 * Recognising the file is enough.
 */
function isMutantFile(context: MetaContext<NpcPrototype>) {
  return (isMutantFileByPath[context.filePath] ??= context.array.some((s) =>
    String(s.__internal__.refurl || "").includes("MutantBase"),
  ));
}

/**
 * The inheritance chain is walked up to the first prototype declaring an `AgentType`:
 * humans reach `EAgentType::Human` (declared on the ObjPrototypes root), the odd mutant
 * living among the NPC prototypes stops at `EAgentType::MutantGeneric`. A chain that ends
 * without declaring one still bottoms out at the human root.
 *
 * Needed because the game ignores inherited patches: a property set on a base prototype
 * does not reach its descendants, so every human prototype has to be patched directly.
 */
export function isHumanNpc(struct: NpcPrototype, context: MetaContext<NpcPrototype>) {
  if (EXCLUDED_SIDS.has(String(struct.SID)) || isMutantFile(context)) return false;
  const collection = { ...getCollection(context), [struct.SID]: struct };
  let hops = 0;
  const core = getCorePrototype(struct.SID, collection as Record<string, Struct>, (s) => {
    // getCorePrototype probes one struct past the end of the chain, which may be absent
    if (!s || ++hops > MAX_INHERITANCE_HOPS) return true;
    return (s as NpcPrototype).AgentType;
  }) as NpcPrototype | undefined;
  return !core?.AgentType || core.AgentType === "EAgentType::Human";
}
