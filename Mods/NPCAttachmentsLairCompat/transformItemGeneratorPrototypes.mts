import type { ItemGeneratorPrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { allDefaultWeaponGeneralSetupPrototypes, allDefaultWeaponPrototypes } from "../../src/consts.mts";
import {
  addAttachmentVariants,
  getAttachmentCombos,
  getAttachmentRarity,
  type AttachmentVariant,
} from "../NPCAttachments/attachment-variants.mts";
import { buildRankItemGenerator, rankedGenerators, RANKS } from "../LairWars/lairTiers.mts";

const weaponSetupsBySID = Object.fromEntries(allDefaultWeaponGeneralSetupPrototypes.map((s) => [s.SID, s]));

/** Attachment variants for every base weapon, keyed like NPCAttachments keys them. */
const attachmentVariantsByWeaponSID: Record<string, AttachmentVariant[]> = {};
allDefaultWeaponPrototypes.forEach((weapon) => {
  const setup = weapon.GeneralWeaponSetup && weaponSetupsBySID[weapon.GeneralWeaponSetup];
  if (!setup) return;
  const variants = getAttachmentCombos(setup).map(({ attaches, upgrades }) => ({
    key: `${weapon.SID}_withGWS_${setup.SID}_with_${attaches.join("_")}`,
    rarity: getAttachmentRarity(attaches.length),
    attaches,
    upgrades,
  }));
  if (variants.length) attachmentVariantsByWeaponSID[weapon.SID] = variants;
});

/**
 * LairWars/LairTiers give tier humans `<Gen>_LT<Rank>` clones of their vanilla generators. Clones are built from
 * vanilla cfgs, so NPCAttachments' bpatch on the vanilla generator does not reach them. This bpatches each rank
 * clone with the same attachment variants. The patch file sorts after `_patch_LairWars` / `_patch_LairTiers`.
 */
export const transformItemGeneratorPrototypes: StructTransformer<ItemGeneratorPrototype> = (struct) => {
  if (!rankedGenerators.has(struct.__internal__.rawName)) return null;
  const patches = RANKS.map((rank) => {
    const clone = buildRankItemGenerator(struct, rank);
    const fork = addAttachmentVariants(clone, attachmentVariantsByWeaponSID);
    if (!fork) return null;
    Object.assign(fork.__internal__, { rawName: clone.__internal__.rawName, isRoot: true, bpatch: true });
    delete fork.__internal__.refkey;
    delete fork.__internal__.refurl;
    return fork;
  }).filter(Boolean) as ItemGeneratorPrototype[];
  return patches.length ? patches : null;
};

transformItemGeneratorPrototypes.files = ["/ItemGeneratorPrototypes.cfg", "/DynamicItemGenerator.cfg"];
