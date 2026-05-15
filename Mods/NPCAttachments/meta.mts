import { Refs, Struct } from "s2cfgtojson";
import type {
  ItemGeneratorPrototype,
  WeaponGeneralSetupPrototype,
  ItemGeneratorPrototypeItemGeneratorItem,
  WeaponGeneralSetupPrototypePreinstalledAttachmentsItemPrototypeSIDsItem,
  WeaponPrototype,
} from "s2cfgtojson";
import type { MetaContext, MetaType } from "../../src/meta-type.mts";
import { waitFor } from "../../src/wait-for.mts";
import {
  allDefaultDroppableAttachments,
  allDefaultWeaponPrototypesRecord,
  getCorePrototype,
  guessAttachmentSlot,
  allUniqueWeaponGeneralSetupPrototypesSIDs,
} from "../../src/consts.mts";
import type { DeeplyPartial } from "../../src/consts.mts";
const finishedTransformers = new Set<string>();

export const meta: MetaType = {
  description: `
Adds all 357 possible weapons with attachments combos to NPCs. 
[hr][/hr]
Way more variety to what NPCs wield on the battlefield. That being friend or foe. 
[h1][/h1]
Attachments are still rare: 1-attachment weapons are 10x rarer than base, each extra attachment is 10x rarer than the previous (so 2 attachments = 100x rarer, 3 = 1000x rarer than base).
`,
  changenote:
    "Fix looted NPC weapons missing upgrade slots / available attachments in weapon workshop (CompatibleAttachments and UpgradePrototypeSIDs now properly reference base weapon data); rework attachment rarity to geometric scaling: 1-attachment weapons are 10x rarer than base, each additional attachment is 10x rarer than the previous",
  structTransformers: [
    createWeaponParamsWithPreinstalledAttachments,
    createWeapons,
    addNewWeaponsToDynamicItemGenerators,
  ],
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

const newlyCreatedWeaponParamsWithPreinstalledAttachments: Record<
  string,
  WeaponGeneralSetupPrototype[]
> = {};
const requiredUpgradesRecord: Record<string, string[]> = {};

const newWeaponAttachCount: Record<string, number> = {};
/**
 * 1
 */
function createWeaponParamsWithPreinstalledAttachments(
  struct: WeaponGeneralSetupPrototype,
  context: MetaContext<WeaponGeneralSetupPrototype>,
) {
  if (!struct.CompatibleAttachments || allUniqueWeaponGeneralSetupPrototypesSIDs.has(struct.SID)) {
    return;
  }

  const compatibleDroppableAttachments = struct.CompatibleAttachments.filter(([_, a]) =>
    allDefaultDroppableAttachments.has(a.AttachPrototypeSID),
  );
  if (!compatibleDroppableAttachments.entries().length) {
    return;
  }
  const extraStructs = [];
  const compatibleDroppableAttachmentsRecord = Object.fromEntries(
    compatibleDroppableAttachments.entries().map((e) => [e[1].AttachPrototypeSID, e[1]]),
  );
  // Build lookup: attachment SID → set of upgrade IDs that block it
  const blockingUpgradesByAttach = new Map<string, Set<string>>();
  struct.CompatibleAttachments.entries().forEach(([_, a]) => {
    if (a.BlockingUpgradeIds) {
      blockingUpgradesByAttach.set(
        a.AttachPrototypeSID,
        new Set(a.BlockingUpgradeIds.entries().map((e) => e[1])),
      );
    }
  });
  const combos = getCombinations(
    compatibleDroppableAttachments.entries().map((e) => e[1].AttachPrototypeSID),
  );
  combos.forEach(({ items }) => {
    const requiredUpgrades = items
      .map((a) =>
        compatibleDroppableAttachmentsRecord[a].RequiredUpgradeIDs?.entries().map((e) => e[1]),
      )
      .flat()
      .filter((e) => !!e);
    const requiredUpgradesSet = new Set(requiredUpgrades);
    const newSID = `${struct.SID}_with_${items.join("_")}`;

    // Filter out base preinstalled attachments that are blocked by required upgrades
    const basePreinstalled = (
      struct.PreinstalledAttachmentsItemPrototypeSIDs?.entries().map((e) => e[1]) || []
    ).filter((a) => {
      const blocking = blockingUpgradesByAttach.get(a.AttachSID);
      if (!blocking) return true;
      for (const u of requiredUpgradesSet) {
        if (blocking.has(u)) return false;
      }
      return true;
    });

    const toTransfer = struct
      .entries()
      .filter(([k, e]) => {
        if (e instanceof Struct && e.__internal__.bskipref) {
          return true;
        }
      })
      .map(([k]) => k);

    let CompatibleAttachments;
    CompatibleAttachments = struct.CompatibleAttachments.clone();
    CompatibleAttachments.__internal__ = new Refs(CompatibleAttachments.__internal__.rawName);
    let UpgradePrototypeSIDs;
    UpgradePrototypeSIDs = struct.UpgradePrototypeSIDs?.clone();
    if (UpgradePrototypeSIDs) {
      UpgradePrototypeSIDs.__internal__ = new Refs(UpgradePrototypeSIDs.__internal__.rawName);
    }

    const newWeaponSetup = new Struct({
      __internal__: {
        refkey: struct.SID,
        refurl: "../" + context.fileName,
        isRoot: true,
        rawName: newSID,
      },
      ...toTransfer.reduce((mem, e) => {
        mem[e] = (struct[e] as Struct).clone();
        mem[e].__internal__ = new Refs(mem[e].__internal__.rawName);
        return mem;
      }, {}),
      SID: newSID,
      PreinstalledAttachmentsItemPrototypeSIDs: [
        ...items.map((AttachSID) => {
          return {
            AttachSID,
            bHiddenInInventory: false,
          } as Partial<WeaponGeneralSetupPrototypePreinstalledAttachmentsItemPrototypeSIDsItem>;
        }),
        ...basePreinstalled,
      ],
    } as DeeplyPartial<WeaponGeneralSetupPrototype>) as WeaponGeneralSetupPrototype;
    newWeaponAttachCount[newWeaponSetup.SID] = items.length;
    newlyCreatedWeaponParamsWithPreinstalledAttachments[struct.SID] ||= [];
    newlyCreatedWeaponParamsWithPreinstalledAttachments[struct.SID].push(newWeaponSetup);
    requiredUpgradesRecord[newWeaponSetup.SID] = requiredUpgrades;
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
  newlyCreatedWeaponParamsWithPreinstalledAttachments[struct.GeneralWeaponSetup].forEach(
    (newlyCreatedWeaponParamsWithPreinstalledAttachment) => {
      const newSID = `${struct.SID}_withGWS_${newlyCreatedWeaponParamsWithPreinstalledAttachment.SID}`;
      const newWeapon = new Struct({
        __internal__: {
          refkey: struct.SID,
          isRoot: true,
          rawName: newSID,
        },
        LocalizationSID: struct.LocalizationSID || struct.SID,
        GeneralWeaponSetup: newlyCreatedWeaponParamsWithPreinstalledAttachment.SID,
        PreinstalledUpgrades:
          requiredUpgradesRecord[newlyCreatedWeaponParamsWithPreinstalledAttachment.SID],
        SID: newSID,
      } as DeeplyPartial<WeaponPrototype>) as WeaponPrototype;
      if (!requiredUpgradesRecord[newlyCreatedWeaponParamsWithPreinstalledAttachment.SID].length) {
        delete newWeapon.PreinstalledUpgrades;
      }
      newlyCreatedWeaponsWithPreinstalledAttachments[struct.SID] ||= [];
      newlyCreatedWeaponsWithPreinstalledAttachments[struct.SID].push(newWeapon);
      const refCost = getCorePrototype(
        struct.SID,
        allDefaultWeaponPrototypesRecord,
        (item) => item.Cost,
      );

      const attachCount =
        newWeaponAttachCount[newlyCreatedWeaponParamsWithPreinstalledAttachment.SID];
      newlyCreatedWeaponsRarity[newWeapon.SID] = 1 / (10 * Math.pow(10, attachCount - 1));
      extraStructs.push(newWeapon);
    },
  );

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
      fork.ItemGenerator.__internal__.useAsterisk = false;
      fork.ItemGenerator[k1] ||= struct.ItemGenerator[
        k1
      ].fork() as ItemGeneratorPrototypeItemGeneratorItem;
      // fork.ItemGenerator[k1].bAllowSameCategoryGeneration = true;
      const baseChance = struct.ItemGenerator[k1].PossibleItems[k2].Chance;
      const baseWeight = struct.ItemGenerator[k1].PossibleItems[k2].Weight;

      newWeapons.forEach((weapon) => {
        const rarity = newlyCreatedWeaponsRarity[weapon.SID];

        const newOption = struct.ItemGenerator[k1].PossibleItems[k2].clone();
        if (baseWeight > 0) {
          newOption.Weight = rarity * baseWeight;
        } else if (baseChance > 0) {
          newOption.Weight = rarity * baseChance;
        }
        newOption.ItemPrototypeSID = weapon.SID;

        fork.ItemGenerator[k1].PossibleItems ||= struct.ItemGenerator[k1].PossibleItems.fork();
        fork.ItemGenerator[k1].PossibleItems.__internal__.useAsterisk = false;

        fork.ItemGenerator[k1].PossibleItems.addNode(newOption, weapon.SID);
      });
    });
  });
  if (fork.entries().length) {
    return fork;
  }
}

addNewWeaponsToDynamicItemGenerators.files = ["/DynamicItemGenerator.cfg"];
