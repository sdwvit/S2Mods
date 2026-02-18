import { ArmorPrototype, Struct } from "s2cfgtojson";
import { allDefaultArmorPrototypesRecord } from "../../src/consts.mts";
import { backfillDef } from "../../src/backfill-def.mts";
import { deepMerge } from "../../src/deep-merge.mts";
import { logger } from "../../src/logger.mts";
import { getGdocsArmorData } from "./gdocs-armors.mts";

let once = false;

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
export async function transformArmorPrototypes() {
  if (once) {
    return;
  }

  once = true;

  const extraStructs: ArmorPrototype[] = [];
  const seenSIDs = new Set<string>();
  const gdocsData = await getGdocsArmorData();
  const referenceMap = { ...allDefaultArmorPrototypesRecord, ...gdocsData.overrides };
  gdocsData.descriptors.forEach((d) => seenSIDs.add(d.SID));

  gdocsData.descriptors.forEach(({ SID }) => {
    const newArmor = createNewArmor(SID, referenceMap);
    if (!newArmor) {
      logger.warn(`Couldn't create new armor due to no ref? ${SID}`);
      return;
    }

    fixUpgradePrototypeSIDs(newArmor);
    dedupeUpgradePrototypeSIDs(newArmor);

    const clone = newArmor.clone();
    clone.__internal__.isRoot = true;
    extraStructs.push(clone);

    // Generate dedicated equip-only variant so equipped item SID differs from droppable SID.
    if (!SID.startsWith("NPC_")) {
      const npcSID = `NPC_${SID}`;
      if (!seenSIDs.has(npcSID)) {
        seenSIDs.add(npcSID);
        const npcClone = newArmor.clone();
        npcClone.SID = npcSID;
        npcClone.Invisible = true;
        npcClone.__internal__.isRoot = true;
        npcClone.__internal__.rawName = npcSID;
        extraStructs.push(npcClone);
      }
    }
  });
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

function createNewArmor(SID: string, referenceMap: Record<string, ArmorPrototype>) {
  const override = referenceMap[SID];
  const refkey = override.__internal__.refkey;
  const referenceArmor = referenceMap[refkey];
  if (!referenceArmor) {
    return;
  }
  if (!referenceArmor.SID.toLowerCase().includes("helmet") && SID.toLowerCase().includes("helmet")) {
    logger.warn(`referenceArmor.SID '${referenceArmor.SID}' is not a helmet, even though SID '${SID}' points to a helmet`);
  }
  const s = new Struct() as ArmorPrototype;

  const backfilled = backfillDef(s, referenceMap, referenceArmor.SID).filter(([k]) => !!s[k]);

  deepMerge(backfilled, override);
  backfilled.__internal__.rawName = SID;
  return backfilled;
}
