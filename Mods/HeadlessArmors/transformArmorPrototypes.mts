import { Struct } from "s2cfgtojson";
import type { ArmorPrototype } from "s2cfgtojson";
import { allDefaultArmorPrototypesRecord } from "../../src/consts.mts";
import { backfillDef } from "../../src/backfill-def.mts";
import { deepMerge } from "../../src/deep-merge.mts";
import { logger } from "../../src/logger.mts";
import { getGdocsArmorData } from "./gdocs-armors.mts";
import { NPC_AVG_DURABILITY } from "./transformItemGenerators.mts";
import type { MetaContext } from "../../src/meta-type.mts";
import { waitFor } from "../../src/wait-for.mts";

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
export async function transformArmorPrototypes(struct: ArmorPrototype, context: MetaContext<ArmorPrototype>) {
  const extraStructs: ArmorPrototype[] = [];

  if (struct.Protection && struct.SID !== "TemplateArmor") {
    const fork = struct.fork();
    fork.Protection = struct.Protection.fork(true);
    overrideProtectionNPCWithProtection(fork);
    fork.ProtectionNPC.__internal__.bpatch = true;
    delete fork.Protection;
    // extraStructs.push(fork);
  }

  if (!once && context.array.length - 1 === context.index) {
    once = true;
    const seenSIDs = new Set<string>();
    const gdocsData = await getGdocsArmorData();
    const referenceMap = { ...allDefaultArmorPrototypesRecord, ...gdocsData.overrides };
    seenSIDs.union(new Set(Object.keys(gdocsData.descriptors)));
    Object.keys(gdocsData.descriptors).forEach((SID) => {
      const newArmor = createArmorPrototype(SID, referenceMap);
      if (!newArmor) {
        logger.warn(`Couldn't create new armor due to no ref? ${SID}`);
        return;
      }

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
      if (upgrades[key] instanceof Struct) {
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

/**
 * Because NPCs sometimes can equip wrong armor, and drop whats intended for equipment, we need to adjust durability in both cases.
 * With dura loss comes protection loss, so adjust protection for npcs upfront to compensate.
 */
export function overrideProtectionNPCWithProtection(armor: ArmorPrototype): void {
  if (!armor?.Protection) {
    return;
  }
  armor.ProtectionNPC = armor.Protection.clone().map(([k, e]) => {
    if (k === "Strike") {
      return Math.min(5, e / NPC_AVG_DURABILITY);
    }
    return Math.min(80, e / NPC_AVG_DURABILITY);
  });
}

export function createArmorPrototype(SID: string, referenceMap: Record<string, ArmorPrototype>) {
  const override = referenceMap[SID];
  const refkey = override.__internal__.refkey;
  const referenceArmor = referenceMap[refkey];
  if (!referenceArmor) {
    return;
  }
  if (!referenceArmor.SID.toLowerCase().includes("helmet") && SID.toLowerCase().includes("helmet")) {
    logger.warn(`referenceArmor.SID '${referenceArmor.SID}' is not a helmet, even though SID '${SID}' points to a helmet`);
  }
  const s = new Struct(override) as ArmorPrototype;

  const backfilled = backfillDef(s, referenceMap, referenceArmor.SID);

  deepMerge(backfilled, override, false);
  overrideProtectionNPCWithProtection(backfilled);
  backfilled.__internal__.rawName = SID;
  return backfilled;
}
