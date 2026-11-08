import { Struct, type ObjPrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { meta as noAPForMobs } from "../NoAPForMobs/meta.mts";
import {
  enemyCloneFileSuffixes,
  enemyClones,
  enemyClonesByArchetype,
} from "../LairWars/lairTiers.mts";

/** The mutant cfgs NoAPForMobs patches, e.g. "/Poltergeist.cfg". */
const noAPFiles = noAPForMobs.structTransformers[0].files;
const STRIKE = 0.0001; // NoAPForMobs' value

/**
 * LairWars/LairTiers tier mutants (`<Archetype>_LT<Rank>`, `_LT<Rank>T<n>`) refkey their vanilla archetype and
 * end up with its vanilla Protection: NoAPForMobs' bpatch on the archetype does not reach them. This bpatches
 * Strike on every tier clone of an archetype from a NoAPForMobs file. Patch files sort after `_patch_LairWars` /
 * `_patch_LairTiers`, and this mod's folder after theirs in ~mods.
 */
export const transformMobs: StructTransformer<ObjPrototype> = (struct) => {
  const clones = (enemyClonesByArchetype[struct.__internal__.rawName] ?? []).filter(
    (key) => enemyClones[key].mutant,
  );
  if (!clones.length) return null;
  return clones.map((key) => {
    const patch = new Struct() as ObjPrototype;
    Object.assign(patch.__internal__, { rawName: key, isRoot: true, bpatch: true });
    patch.Protection = new Struct({ Strike: STRIKE }) as ObjPrototype["Protection"];
    patch.Protection.__internal__.bpatch = true;
    return patch;
  });
};

transformMobs.files = enemyCloneFileSuffixes.filter((suffix) =>
  noAPFiles.some((f) => suffix.endsWith(f)),
);
transformMobs.inheritDuplicates = true;
