import type { GenericLairPrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { tierPatch, variantPrototype, variantPrototypeSIDs } from "../LairWars/lairTiers.mts";

let once = false;

/**
 * Tiers inside the vanilla lair prototypes (Mods/LairWars/lairTiers.mts): every player-rank block gets its tier's
 * mix. The first call also emits the spawn-pool variants (the Zaton blind dog lairs), so they come first.
 */
export const transformGenericLairPrototypes: StructTransformer<GenericLairPrototype> = (struct) => {
  const out: GenericLairPrototype[] = [];
  if (!once) {
    once = true;
    out.push(...variantPrototypeSIDs.map(variantPrototype));
  }
  const patch = tierPatch(struct);
  if (patch) out.push(patch);
  return out.length ? out : null;
};

transformGenericLairPrototypes.files = ["/GenericLairPrototypes.cfg"];
transformGenericLairPrototypes.inheritDuplicates = true;
