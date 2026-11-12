import path from "node:path";
import type { ItemGeneratorPrototype, WeaponGeneralSetupPrototype, WeaponPrototype } from "s2cfgtojson";
import type { MetaContext } from "../../src/meta-type.mts";
import { dlcCfgDir } from "../../src/base-paths.mts";
import { getOrUpdateFromL1GlobalCache } from "../../src/cache/l1global-cache.mts";
import { allDefaultWeaponGeneralSetupPrototypes, allDefaultWeaponPrototypes } from "../../src/consts.mts";
import {
  addAttachmentVariants,
  getAttachmentCombos,
  getAttachmentRarity,
  type AttachmentVariant,
} from "../NPCAttachments/attachment-variants.mts";

const dlc1Dir = path.join(dlcCfgDir, "DLC1");
const [dlc1Items, dlc1WeaponSetups] = await Promise.all([
  getOrUpdateFromL1GlobalCache<WeaponPrototype>(path.join(dlc1Dir, "ItemPrototypes.cfg")),
  getOrUpdateFromL1GlobalCache<WeaponGeneralSetupPrototype>(
    path.join(dlc1Dir, "WeaponData", "WeaponGeneralSetupPrototypes.cfg"),
  ),
]);

/** Base and DLC1 weapon setups by SID; DLC1 wins on a clash. */
const weaponSetupsBySID: Record<string, WeaponGeneralSetupPrototype> = Object.fromEntries(
  [...allDefaultWeaponGeneralSetupPrototypes, ...dlc1WeaponSetups].map((s) => [s.SID, s]),
);

/** Attachment variants for every base and DLC1 weapon, keyed like NPCAttachments keys them. */
const attachmentVariantsByWeaponSID: Record<string, AttachmentVariant[]> = {};
[...allDefaultWeaponPrototypes, ...dlc1Items].forEach((weapon) => {
  const setup = weapon.GeneralWeaponSetup && weaponSetupsBySID[weapon.GeneralWeaponSetup];
  if (!setup) {
    return;
  }
  const variants = getAttachmentCombos(setup).map(({ attaches, upgrades }) => ({
    key: `${weapon.SID}_withGWS_${setup.SID}_with_${attaches.join("_")}`,
    rarity: getAttachmentRarity(attaches.length),
    attaches,
    upgrades,
  }));
  if (variants.length) {
    attachmentVariantsByWeaponSID[weapon.SID] = variants;
  }
});

/**
 * Adds the NPCAttachments weapon variants to the DLC1 NPC generators, which live in
 * DLCGameData/DLC1/ItemGeneratorPrototypes.cfg and hold both base and DLC1 weapons.
 */
export function transformItemGeneratorPrototypes(
  struct: ItemGeneratorPrototype,
  context: MetaContext<ItemGeneratorPrototype>,
) {
  if (!context.filePath.includes(`${path.sep}DLC1${path.sep}`)) {
    return null;
  }
  return addAttachmentVariants(struct, attachmentVariantsByWeaponSID) ?? null;
}

// DLC1 generators point their refurl at GameData/ItemGeneratorPrototypes.cfg or at
// GameData/ItemGeneratorPrototypes/DynamicItemGenerator.cfg (some just DynamicItemGenerator.cfg).
transformItemGeneratorPrototypes.files = ["ItemGeneratorPrototypes", "DynamicItemGenerator.cfg"];
transformItemGeneratorPrototypes.contains = true;
transformItemGeneratorPrototypes.dlc = true;
