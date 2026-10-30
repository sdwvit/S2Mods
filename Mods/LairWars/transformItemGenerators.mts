import type { ItemGeneratorPrototype, Struct } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { transformItemGeneratorPrototypes as getFactionPatchFork } from "../FactionPatches/transformItemGeneratorPrototypes.mts";
import { buildRankItemGenerator, rankedGenerators, RANKS } from "./lairTiers.mts";

/**
 * `<Gen>_LT<Rank>` clones of every generator the tier lairs' enemies roll. A top-level NPC generator's
 * faction-patch drop (DecoupledRanks' XP source, which DecoupledRanks adds to the vanilla generator) is
 * added to its clones too, so tier enemies still drop it.
 */
export const transformItemGenerators: StructTransformer<ItemGeneratorPrototype> = (struct, context) => {
  if (!rankedGenerators.has(struct.__internal__.rawName)) return null;
  const factionPatchFork = getFactionPatchFork(struct, context) as ItemGeneratorPrototype | null | undefined;
  // Added under its own key by FactionPatches, so it is not part of the generated ItemGenerator type.
  const factionPatch = (factionPatchFork?.ItemGenerator as unknown as Record<string, Struct> | undefined)?.FactionPatch;
  return RANKS.map((rank) => {
    const clone = buildRankItemGenerator(struct, rank);
    if (factionPatch) clone.ItemGenerator.addNode(factionPatch.clone());
    return clone;
  });
};

transformItemGenerators.files = ["/ItemGeneratorPrototypes.cfg", "/DynamicItemGenerator.cfg"];
