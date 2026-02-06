import {
  ItemGeneratorPrototype,
  Struct,
  WeaponGeneralSetupPrototype,
  WeaponGeneralSetupPrototypePreinstalledAttachmentsItemPrototypeSIDsItem,
  WeaponPrototype,
} from "s2cfgtojson";
import { MetaType } from "../../src/meta-type.mts";
import { waitFor } from "../../src/wait-for.mts";
import {
  allDefaultAttachPrototypesRecord,
  allDefaultDroppableAttachments,
  allDefaultWeaponPrototypesRecord,
  DeeplyPartial,
  getCorePrototype,
  getRecordByKey,
  guessAttachmentSlot,
  UniqueWeaponGeneralSetupPrototypesSIDs,
} from "../../src/consts.mts";
import { precision } from "../../src/precision.mts";

const finishedTransformers = new Set<string>();

export const meta: MetaType = {
  description: `
Adds all 357 possible weapons with attachments combos to NPCs. 
[hr][/hr]
Way more variety to what NPCs wield on the battlefield. That being friend or foe. 
[h1][/h1]
Attachments are still rare: probability of meeting such NPC is 1/100 - 1/50.
`,
  changenote: "Initial release",
  structTransformers: [createWeaponParamsWithPreinstalledAttachments, createWeapons, addNewWeaponsToDynamicItemGenerators],
  onTransformerFinish(transformer) {
    finishedTransformers.add(transformer.name);
  },
};

/**
 * I need to create WeaponGeneralSetupPrototypes for each weapon-attachment combo
 * Then I need to create Weapon items with corresponding WeaponGeneralSetupPrototype
 * Then I need to modify DynamicItemGeneratorPrototypes to add these new weapons to NPCs
 */

function getCombinations(items: string[]) {
  const result: { slots: Set<string>; items: string[] }[] = [];

  const currentItems: string[] = [];
  const usedSlots = new Set<string>();

  function build(startIndex: number) {
    for (let i = startIndex; i < items.length; i++) {
      const item = items[i];

      const slot = guessAttachmentSlot(item);
      if (!slot) continue;
      if (usedSlots.has(slot)) continue;

      // choose
      currentItems.push(item);
      usedSlots.add(slot);

      // record snapshot
      result.push({
        items: [...currentItems],
        slots: new Set(usedSlots),
      });

      // explore
      build(i + 1);

      // un-choose
      usedSlots.delete(slot);
      currentItems.pop();
    }
  }

  build(0);
  return result;
}

const newlyCreatedWeaponParamsWithPreinstalledAttachments: Record<string, WeaponGeneralSetupPrototype[]> = {};
const requiredUpgradesRecord: Record<string, string[]> = {};

const newWeaponSetupCost: Record<string, number> = {};
/**
 * 1
 */
function createWeaponParamsWithPreinstalledAttachments(struct: WeaponGeneralSetupPrototype) {
  if (!struct.CompatibleAttachments || UniqueWeaponGeneralSetupPrototypesSIDs.has(struct.SID)) {
    return;
  }

  const compatibleDroppableAttachments = struct.CompatibleAttachments.filter(([_, a]) => allDefaultDroppableAttachments.has(a.AttachPrototypeSID));
  if (!compatibleDroppableAttachments.entries().length) {
    return;
  }
  const extraStructs = [];
  const compatibleDroppableAttachmentsRecord = getRecordByKey(
    compatibleDroppableAttachments.entries().map((e) => e[1]),
    "AttachPrototypeSID",
  );
  const combos = getCombinations(compatibleDroppableAttachments.entries().map((e) => e[1].AttachPrototypeSID));
  combos.forEach(({ items }) => {
    const requiredUpgrades = items
      .map((a) => compatibleDroppableAttachmentsRecord[a].RequiredUpgradeIDs?.entries().map((e) => e[1]))
      .flat()
      .filter((e) => !!e);
    const newSID = `${struct.SID}_with_${items.join("_")}`;

    const newWeaponSetup = new Struct({
      __internal__: {
        refkey: struct.SID,
        isRoot: true,
        rawName: newSID,
      },
      SID: newSID,
      CompatibleAttachments: struct.CompatibleAttachments,
      UpgradePrototypeSIDs: struct.UpgradePrototypeSIDs,
      PreinstalledAttachmentsItemPrototypeSIDs: [
        ...items.map((AttachSID) => {
          return {
            AttachSID,
            bHiddenInInventory: false,
          } as Partial<WeaponGeneralSetupPrototypePreinstalledAttachmentsItemPrototypeSIDsItem>;
        }),
        ...(struct.PreinstalledAttachmentsItemPrototypeSIDs?.entries().map((e) => e[1]) || []),
      ],
    } as DeeplyPartial<WeaponGeneralSetupPrototype>) as WeaponGeneralSetupPrototype;
    newWeaponSetupCost[newWeaponSetup.SID] = items.reduce((mem, item) => mem + allDefaultAttachPrototypesRecord[item].Cost, 0);
    newlyCreatedWeaponParamsWithPreinstalledAttachments[struct.SID] ||= [];
    newlyCreatedWeaponParamsWithPreinstalledAttachments[struct.SID].push(newWeaponSetup);
    requiredUpgradesRecord[newWeaponSetup.SID] = requiredUpgrades;
    if (!requiredUpgrades.length) {
      delete newWeaponSetup.UpgradePrototypeSIDs;
    }
    extraStructs.push(newWeaponSetup);
  });

  return extraStructs;
}

createWeaponParamsWithPreinstalledAttachments.files = ["/WeaponGeneralSetupPrototypes.cfg"];

const newlyCreatedWeaponsRarity: Record<string, number> = {};
const newlyCreatedWeaponsWithPreinstalledAttachments: Record<string, WeaponPrototype[]> = {};
/**
 * 2
 */
async function createWeapons(struct: WeaponPrototype) {
  await waitFor(() => finishedTransformers.has(createWeaponParamsWithPreinstalledAttachments.name));

  if (!newlyCreatedWeaponParamsWithPreinstalledAttachments[struct.GeneralWeaponSetup]) {
    return;
  }
  const extraStructs = [];
  newlyCreatedWeaponParamsWithPreinstalledAttachments[struct.GeneralWeaponSetup].forEach((newlyCreatedWeaponParamsWithPreinstalledAttachment) => {
    const newSID = `${struct.SID}_withGWS_${newlyCreatedWeaponParamsWithPreinstalledAttachment.SID}`;
    const newWeapon = new Struct({
      __internal__: {
        refkey: struct.SID,
        isRoot: true,
        rawName: newSID,
      },
      LocalizationSID: struct.LocalizationSID || struct.SID,
      GeneralWeaponSetup: newlyCreatedWeaponParamsWithPreinstalledAttachment.SID,
      PreinstalledUpgrades: requiredUpgradesRecord[newlyCreatedWeaponParamsWithPreinstalledAttachment.SID],
      SID: newSID,
    } as DeeplyPartial<WeaponPrototype>) as WeaponPrototype;
    if (!requiredUpgradesRecord[newlyCreatedWeaponParamsWithPreinstalledAttachment.SID].length) {
      delete newWeapon.PreinstalledUpgrades;
    }
    newlyCreatedWeaponsWithPreinstalledAttachments[struct.SID] ||= [];
    newlyCreatedWeaponsWithPreinstalledAttachments[struct.SID].push(newWeapon);
    const refCost = getCorePrototype(struct.SID, allDefaultWeaponPrototypesRecord, (item) => item.Cost);

    newlyCreatedWeaponsRarity[newWeapon.SID] =
      refCost / (50 * (refCost + newWeaponSetupCost[newlyCreatedWeaponParamsWithPreinstalledAttachment.SID]));
    extraStructs.push(newWeapon);
  });

  return extraStructs;
}

createWeapons.files = ["/WeaponPrototypes.cfg"];

/**
 * 3
 */
async function addNewWeaponsToDynamicItemGenerators(struct: ItemGeneratorPrototype) {
  if (struct.SID.includes("Trade") || !struct.ItemGenerator) {
    return;
  }

  await waitFor(() => finishedTransformers.has(createWeapons.name));
  const fork = struct.fork();
  struct.ItemGenerator.forEach(([k1, ig]) => {
    ig.PossibleItems.forEach(([k2, pi]) => {
      const newWeapons = newlyCreatedWeaponsWithPreinstalledAttachments[pi.ItemPrototypeSID];
      if (!newWeapons?.length) {
        return;
      }
      fork.ItemGenerator ||= struct.ItemGenerator.fork();
      fork.ItemGenerator[k1] ||= struct.ItemGenerator[k1].fork();
      fork.ItemGenerator[k1].PossibleItems ||= struct.ItemGenerator[k1].PossibleItems.fork();
      fork.ItemGenerator[k1].PossibleItems[k2] ||= struct.ItemGenerator[k1].PossibleItems[k2].fork();
      const baseChance = struct.ItemGenerator[k1].PossibleItems[k2].Chance;
      const baseWeight = struct.ItemGenerator[k1].PossibleItems[k2].Weight;

      newWeapons.forEach((weapon) => {
        const rarity = newlyCreatedWeaponsRarity[weapon.SID];

        const newOption = struct.ItemGenerator[k1].PossibleItems[k2].clone();
        if (baseChance) newOption.Chance = precision(rarity * baseChance, 10);
        if (baseWeight) newOption.Weight = precision(rarity * baseWeight, 10);
        newOption.ItemPrototypeSID = weapon.SID;
        fork.ItemGenerator[k1].PossibleItems.addNode(newOption, weapon.SID);
      });
    });
  });
  if (fork.entries().length) {
    return fork;
  }
}

addNewWeaponsToDynamicItemGenerators.files = ["/DynamicItemGenerator.cfg"];
