import type { ObjPrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { buildEnemyClone, enemyCloneFileSuffixes, enemyClonesByArchetype } from "./lairTiers.mts";

/** Emits the tier lairs' enemies (`<Archetype>_LT<Rank>T<n>`, mutants `_LT<n>`) after their archetype. */
export const transformEnemyObjPrototypes: StructTransformer<ObjPrototype> = (struct) =>
  enemyClonesByArchetype[struct.__internal__.rawName]?.map(buildEnemyClone) ?? null;

transformEnemyObjPrototypes.files = enemyCloneFileSuffixes;
