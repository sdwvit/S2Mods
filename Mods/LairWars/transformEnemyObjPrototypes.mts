import type { ObjPrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { buildEnemyClone, enemyCloneFileSuffixes, enemyClonesByArchetype } from "./lairTiers.mts";

/**
 * Bayun and Pseudodog expand in packs: they move from MutantGenericNeedsNoExpansionPreset (the big loners, squads
 * of 1-3, transformNPCNeedsPresetPrototypes.mts) to MutantGenericNeedsPreset (squads of 2-4). The two vanilla
 * presets differ only in the Expansion need. Their variants and tier clones inherit it.
 */
const PACK_NEEDS_PRESET = "MutantGenericNeedsPreset";
const PACK_MUTANTS = new Set(["Bayun", "PseudoDogBase"]);

function packNeeds(struct: ObjPrototype) {
  const fork = struct.fork();
  fork.__internal__.bpatch = true;
  fork.NeedsPresetSID = PACK_NEEDS_PRESET;
  return fork;
}

/** Emits the tier lairs' enemies (`<Archetype>_LT<Rank>T<n>`, mutants `_LT<n>`) after their archetype. */
export const transformEnemyObjPrototypes: StructTransformer<ObjPrototype> = (struct) => {
  const rawName = struct.__internal__.rawName;
  const out = [
    ...(PACK_MUTANTS.has(rawName) ? [packNeeds(struct)] : []),
    ...(enemyClonesByArchetype[rawName]?.map(buildEnemyClone) ?? []),
  ];
  return out.length ? out : null;
};

transformEnemyObjPrototypes.files = enemyCloneFileSuffixes;
transformEnemyObjPrototypes.inheritDuplicates = true;
