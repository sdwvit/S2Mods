import { Struct } from "s2cfgtojson";
import type {
  ItemGeneratorPrototype,
  ItemGeneratorPrototypeItemGeneratorItem,
  WeaponGeneralSetupPrototype,
} from "s2cfgtojson";
import {
  allDefaultDroppableAttachments,
  allUniqueWeaponGeneralSetupPrototypesSIDs,
  guessAttachmentSlot,
} from "../../src/consts.mts";

/**
 * Shared by NPCAttachments (base GameData generators) and NPCAttachmentsDLC1 (DLC1 generators).
 */

/** Every non-empty set of attachments with at most one per slot, in a stable order. */
export function getCombinations(items: string[]) {
  const result: { slots: Set<string>; items: string[] }[] = [];

  const currentItems: string[] = [];
  const usedSlots = new Set<string>();

  function build(startIndex: number) {
    for (let i = startIndex; i < items.length; i++) {
      const item = items[i];

      const slot = guessAttachmentSlot(item);
      if (!slot) continue;
      if (usedSlots.has(slot)) continue;

      currentItems.push(item);
      usedSlots.add(slot);

      result.push({
        items: [...currentItems],
        slots: new Set(usedSlots),
      });

      build(i + 1);

      usedSlots.delete(slot);
      currentItems.pop();
    }
  }

  build(0);
  return result;
}

export type AttachmentCombo = { attaches: string[]; upgrades: string[] };

/**
 * Attachment combos an NPC can roll on a weapon with this setup: droppable compatible
 * attachments, one per slot, plus the upgrades those attachments require.
 * Empty for unique weapons and setups without droppable attachments.
 */
export function getAttachmentCombos(struct: WeaponGeneralSetupPrototype): AttachmentCombo[] {
  if (!struct.CompatibleAttachments || allUniqueWeaponGeneralSetupPrototypesSIDs.has(struct.SID)) {
    return [];
  }
  const compatibleDroppableAttachments = struct.CompatibleAttachments.filter(([_, a]) =>
    allDefaultDroppableAttachments.has(a.AttachPrototypeSID),
  );
  if (!compatibleDroppableAttachments.entries().length) {
    return [];
  }
  const byAttachSID = Object.fromEntries(
    compatibleDroppableAttachments.entries().map((e) => [e[1].AttachPrototypeSID, e[1]]),
  );
  return getCombinations(
    compatibleDroppableAttachments.entries().map((e) => e[1].AttachPrototypeSID),
  ).map(({ items }) => ({
    attaches: items,
    upgrades: items
      .map((a) => byAttachSID[a].RequiredUpgradeIDs?.entries().map((e) => e[1]))
      .flat()
      .filter((e) => !!e),
  }));
}

/** 1 attachment = 10x rarer than the base weapon, each extra one another 10x. */
export const getAttachmentRarity = (attachCount: number) => 1 / (10 * Math.pow(10, attachCount - 1));

export type AttachmentVariant = AttachmentCombo & {
  /** PossibleItems node name of the variant. */
  key: string;
  rarity: number;
};

/**
 * Next to every PossibleItems entry whose weapon has variants, adds one entry per variant:
 * the same weapon, rolled with the variant's attachments (and the upgrades they need)
 * through the vanilla ItemGenerator Attaches/Upgrades system.
 * Returns the fork, or undefined when nothing was added.
 */
export function addAttachmentVariants(
  struct: ItemGeneratorPrototype,
  variantsByWeaponSID: Record<string, AttachmentVariant[]>,
) {
  if (struct.SID.includes("Trade") || !struct.ItemGenerator) {
    return;
  }
  const fork = struct.fork();
  struct.ItemGenerator.forEach(([k1, ig]) => {
    if (!(ig instanceof Struct) || !(ig.PossibleItems instanceof Struct)) {
      return;
    }
    ig.PossibleItems.forEach(([k2, pi]) => {
      const variants = variantsByWeaponSID[pi.ItemPrototypeSID];
      if (!variants?.length) {
        return;
      }
      fork.ItemGenerator ||= struct.ItemGenerator.fork();
      fork.ItemGenerator.__internal__.useAsterisk = false;
      fork.ItemGenerator[k1] ||= struct.ItemGenerator[
        k1
      ].fork() as ItemGeneratorPrototypeItemGeneratorItem;
      const baseChance = struct.ItemGenerator[k1].PossibleItems[k2].Chance;
      const baseWeight = struct.ItemGenerator[k1].PossibleItems[k2].Weight;

      variants.forEach((variant) => {
        if (!variant.attaches.length) {
          return;
        }

        const newOption = struct.ItemGenerator[k1].PossibleItems[k2].clone();
        // Scale whichever field the base entry actually uses: Weight for weighted
        // pick-one lists, Chance for independently rolled entries. Writing Weight on a
        // Chance-based entry leaves the cloned Chance untouched, which would make the
        // variant spawn unconditionally on top of the base weapon.
        if (baseWeight > 0) {
          newOption.Weight = variant.rarity * baseWeight;
        } else if (baseChance > 0) {
          newOption.Chance = variant.rarity * baseChance;
        } else {
          return;
        }
        newOption.ItemPrototypeSID = pi.ItemPrototypeSID;
        newOption.addNode(
          new Struct({
            MinCount: variant.attaches.length,
            MaxCount: variant.attaches.length,
            Chance: 1,
            PossibleItems: variant.attaches.join(", "),
          }),
          "Attaches",
        );
        newOption.Attaches.__internal__.bpatch = true;
        if (variant.upgrades.length) {
          newOption.addNode(
            new Struct({
              MinCount: variant.upgrades.length,
              MaxCount: variant.upgrades.length,
              Chance: 1,
              PossibleItems: variant.upgrades.join(", "),
            }),
            "Upgrades",
          );
          newOption.Upgrades.__internal__.bpatch = true;
        }

        fork.ItemGenerator[k1].PossibleItems ||= struct.ItemGenerator[k1].PossibleItems.fork();
        fork.ItemGenerator[k1].PossibleItems.__internal__.useAsterisk = false;

        fork.ItemGenerator[k1].PossibleItems.addNode(newOption, variant.key);
      });
    });
  });
  if (fork.entries().length) {
    return fork;
  }
}
