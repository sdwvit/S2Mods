import { Struct, type ERank, type ItemGeneratorPrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import {
  ensureArmorCombos,
  getArmorEntriesByRank,
  resetCss,
  shouldProcessStruct,
} from "../HeadlessArmors/meta.mts";
import { buildRankItemGenerator, rankedGenerators, RANKS } from "../LairWars/lairTiers.mts";

ensureArmorCombos();

/**
 * LairWars/LairTiers give tier humans `<Gen>_LT<Rank>` clones of their vanilla generators. Clones are built from
 * vanilla cfgs, so HeadlessArmors' bpatch on the vanilla generator does not reach them. This bpatches each rank
 * clone the way HeadlessArmors patches the vanilla one: vanilla suit/helmet entries removed, and the armor entry
 * of the clone's rank added without PlayerRank (the clone is already per rank). The patch file sorts after
 * `_patch_LairWars` / `_patch_LairTiers`.
 */
export const transformItemGeneratorPrototypes: StructTransformer<ItemGeneratorPrototype> = (struct) => {
  if (!rankedGenerators.has(struct.__internal__.rawName) || !shouldProcessStruct(struct)) return null;
  const armorEntries = getArmorEntriesByRank(struct);
  if (!armorEntries) return null;
  const patches = RANKS.map((rank) => {
    const entry = armorEntries.find(([r]) => r === (`ERank::${rank}` as ERank))?.[1];
    const clone = buildRankItemGenerator(struct, rank);
    const fork = clone.fork();
    Object.assign(fork.__internal__, { rawName: clone.__internal__.rawName, isRoot: true, bpatch: true });
    fork.ItemGenerator = new Struct().fork() as typeof fork.ItemGenerator;
    resetCss(clone, fork);
    if (entry) delete entry.PlayerRank;
    if (entry) fork.ItemGenerator.addNode(entry, `Armors_for_${rank}`);
    return fork.ItemGenerator.entries().length ? fork : null;
  }).filter(Boolean) as ItemGeneratorPrototype[];
  return patches.length ? patches : null;
};

transformItemGeneratorPrototypes.files = ["/ItemGeneratorPrototypes.cfg", "/DynamicItemGenerator.cfg"];
