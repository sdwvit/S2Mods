import { ArmorPrototype, Struct } from "s2cfgtojson";
import { MetaContext } from "../../src/meta-type.mts";
import { allDefaultArmorPrototypesRecord, ArmorDescriptor } from "../../src/consts.mts";
import { backfillDef } from "../../src/backfill-def.mts";
import { deepMerge } from "../../src/deep-merge.mts";
import { logger } from "../../src/logger.mts";
import { getGdocsArmorData, GdocsArmorData } from "./gdocs-armors.mts";

let once = false;

const bannedids = new Set([
  "NPC_Richter_Armor",
  "NPC_Korshunov_Armor",
  "NPC_Korshunov_Armor_2",
  "NPC_Dalin_Armor",
  "NPC_Agata_Armor",
  "NPC_Faust_Armor",
  "NPC_Kaymanov_Armor",
  "NPC_Shram_Armor",
  "NPC_Dekhtyarev_Armor",
  "NPC_Sidorovich_Armor",
  "NPC_Barmen_Armor",
  "NPC_Batya_Armor",
  "NPC_Tyotya_Armor",
]);

const UPGRADE_SID_FIXUPS: Record<string, string> = {
  Battle_Monolith_Armor_rad_container_Left_3_2: "Battle_Monolith_Armor_radiationAbsorption_Left_3_2",
  Exoskeleton_Neutral_Armor_protectionChemical_protectionTherma_Left_3_2:
    "Exoskeleton_Neutral_Armor_protectionChemical_protectionElectrical_Left_3_2",
  HeavyExoskeleton_Monolith_Armor_protectionChemical_protectionTherma_Left_3_2:
    "HeavyExoskeleton_Monolith_Armor_protectionChemical_protectionElectrical_Left_3_2",
  Light_Mercenaries_Armor_protectionThermal_protectionElectrical_Left_2_1: "Light_Mercenaries_Armor_protectionChemical_protectionElectrical_Left_2_1",
  SEVA_Dolg_Armor_carryingCapacity_Left_2_2: "SEVA_Dolg_Armor_Backpack_Left_2_2",
};

/**
 * Adds armor that doesn't block head, but also removes any psy protection. Allows player to use helmets.
 */
export async function transformArmorPrototypes(struct: ArmorPrototype, context: MetaContext<ArmorPrototype>) {
  if (bannedids.has(struct.SID)) {
    return null;
  }
  const extraStructs: ArmorPrototype[] = [];

  if (!once) {
    once = true;
    const gdocsData = await getGdocsArmorData();
    const referenceMap = buildReferenceMap(gdocsData);

    gdocsData.descriptors.forEach((descriptor) => {
      const newSID = descriptor.SID;

      const newArmor = createNewArmor(descriptor, referenceMap);
      if (!newArmor) {
        logger.warn(`Couldn't create new armor due to no ref? ${new Struct(descriptor).toString()}`);
        return;
      }
      deepMerge(newArmor, gdocsData.overrides[newSID] || {});
      fixUpgradePrototypeSIDs(newArmor);
      dedupeUpgradePrototypeSIDs(newArmor);

      const clone = newArmor.clone();
      clone.__internal__.isRoot = true;
      extraStructs.push(clone);
    });
  }

  return extraStructs;
}

transformArmorPrototypes.files = ["/ArmorPrototypes.cfg"];

function fixUpgradePrototypeSIDs(armor: ArmorPrototype) {
  const upgrades = armor.UpgradePrototypeSIDs;
  if (!upgrades || typeof upgrades.entries !== "function") {
    return;
  }
  for (const [key, value] of upgrades.entries()) {
    if (typeof value !== "string") {
      continue;
    }
    const replacement = UPGRADE_SID_FIXUPS[value];
    if (replacement && replacement !== value) {
      upgrades[key] = replacement;
    }
  }
}

function dedupeUpgradePrototypeSIDs(armor: ArmorPrototype) {
  const upgrades = (armor as any).UpgradePrototypeSIDs?.fork(true);
  if (!upgrades || typeof upgrades.entries !== "function") {
    return;
  }
  const seen = new Set<string>();
  for (const [key, value] of upgrades.entries()) {
    if (typeof value !== "string") {
      continue;
    }
    if (seen.has(value)) {
      if (typeof upgrades.removeNode === "function") {
        upgrades.removeNode(key);
      } else {
        delete upgrades[key];
      }
      continue;
    }
    seen.add(value);
  }
  armor.UpgradePrototypeSIDs = upgrades;
}

function createNewArmor(descriptor: ArmorDescriptor, referenceMap: Record<string, ArmorPrototype>) {
  const refkey = descriptor.__internal__.refkey;
  const SID = descriptor.SID;
  const referenceArmor = referenceMap[refkey];
  if (!referenceArmor) {
    return;
  }
  if (!referenceArmor.SID.toLowerCase().includes("helmet") && SID.toLowerCase().includes("helmet")) {
    logger.warn(`referenceArmor.SID '${referenceArmor.SID}' is not a helmet, even tho SID '${SID}' points to a helmet`);
  }
  const s = new Struct(descriptor) as ArmorPrototype;

  const backfilled = backfillDef(s, referenceMap, referenceArmor.SID).filter(([k]) => !!s[k]);
  backfilled.__internal__.rawName = SID;
  return backfilled;
}

function buildReferenceMap(data: GdocsArmorData): Record<string, ArmorPrototype> {
  const map: Record<string, ArmorPrototype> = { ...allDefaultArmorPrototypesRecord };
  for (const descriptor of data.descriptors) {
    const sid = descriptor.SID;
    map[sid] = new Struct({ SID: sid, __internal__: { refkey: descriptor.__internal__.refkey }, ...(data.overrides[sid] || {}) }) as ArmorPrototype;
  }
  return map;
}
