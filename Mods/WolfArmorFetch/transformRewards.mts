import { Struct } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { DECIDER_ITEM, QC } from "./cover.mts";
import { DEALER_PROTOTYPES, dealerGenerator } from "./coverPrototypes.mts";

let once = false;

/** A stash generator holding one body armor at `durability`. */
function stashReward(SID: string, item: string, durability: number) {
  const PossibleItems = new Struct();
  PossibleItems.addNode(
    new Struct({
      ItemPrototypeSID: item,
      MinCount: 1,
      MaxCount: 1,
      MinDurability: durability,
      MaxDurability: durability,
      Chance: 1,
    }),
  );
  const ItemGenerator = new Struct();
  ItemGenerator.addNode(new Struct({ Category: "EItemGenerationCategory::BodyArmor", PossibleItems }));
  return new Struct({ __internal__: { rawName: SID, isRoot: true }, SID, ItemGenerator });
}

/** An item generator of `categories`, each `[Category, PossibleItems entries]`. */
function generator(SID: string, categories: [string, Record<string, unknown>[]][]) {
  const ItemGenerator = new Struct();
  for (const [category, items] of categories) {
    const PossibleItems = new Struct();
    items.forEach((item) => PossibleItems.addNode(new Struct(item)));
    ItemGenerator.addNode(new Struct({ Category: `EItemGenerationCategory::${category}`, PossibleItems }));
  }
  return new Struct({ __internal__: { rawName: SID, isRoot: true }, SID, ItemGenerator });
}

/** A weapon, carried with ammo for it, the way vanilla's quest NPC generators hand them out. */
const weapon = (item: string, ammo = 150) => ({
  ItemPrototypeSID: item,
  Weight: 1,
  MinDurability: 0.8,
  MaxDurability: 0.95,
  AmmoMinCount: ammo,
  AmmoMaxCount: ammo,
});
const one = (item: string) => ({ ItemPrototypeSID: item, Weight: 1 });
const medicine = () => [{ ItemPrototypeSID: "Bandage", Chance: 1, MinCount: 2, MaxCount: 4 }, { ItemPrototypeSID: "Medkit", Chance: 0.6, MinCount: 1, MaxCount: 1 }];

/** Each dealer's kit: the lead's assault rifle, the gunner's RPM-74 and exoskeleton, an SMG. */
const DEALER_KITS: Record<string, [string, string, string | null]> = {
  WolfArmorFetch_Dealer_Lead: ["GunFora_ST", "Battle_Varta_Armor", "Heavy_Varta_Helmet"],
  WolfArmorFetch_Dealer_Gunner: ["GunPKP_MG", "BattleExoskeleton_Varta_Armor", null],
  WolfArmorFetch_Dealer_Smg: ["GunViper_PP", "Battle_Varta_Armor", "Heavy_Varta_Helmet"],
};

/**
 * The Decider Wolf hands over for Cover Story: whole, with the upgrades and attachments a careful owner
 * would fit, as vanilla's ARG01_QSBIG_SuperStash fits a gun (Upgrades/Attaches on the item entry, every
 * one listed taken). Upgrades from Gun_Decider_AR_GS's list, compatible with each other; it stays 5.45.
 */
function deciderGift() {
  const upgrades = [
    "GunFora_Upgrade_Attachment_Grip",
    "GunFora_Upgrade_Handguard_1",
    "GunFora_Upgrade_Handguard_2_1",
    "GunFora_Upgrade_Body_1",
    "GunFora_Upgrade_Body_2_2",
    "GunFora_Upgrade_Barrel_1",
    "GunFora_Upgrade_Barrel_2",
  ];
  const attaches = ["EN_X4Scope_1", "EN_Silen_3", "EN_Grip_1", "GunFora_MagIncreased"];
  const all = (list: string[]) => new Struct({ MinCount: list.length, MaxCount: list.length, Chance: 1, PossibleItems: list.join(", ") });
  return generator(`${QC}_DeciderGift`, [
    [
      "WeaponPrimary",
      [{ ItemPrototypeSID: DECIDER_ITEM, Chance: 1, MinDurability: 1, MinCount: 1, Upgrades: all(upgrades), Attaches: all(attaches) }],
    ],
    ["Ammo", [{ ItemPrototypeSID: "A545D", Chance: 1, MinCount: 120, MaxCount: 120, bRequireWeapon: false }]],
  ]);
}

export const transformRewards: StructTransformer<Struct> = () => {
  if (once) return;
  once = true;

  const moneyReward = new Struct({
    __internal__: { rawName: "WolfArmorFetch_MoneyReward", isRoot: true },
    SID: "WolfArmorFetch_MoneyReward",
    MoneyGenerator: new Struct({ MinCount: 5000, MaxCount: 5000 }),
  });

  return [
    moneyReward,
    stashReward("WolfArmorFetch_StashReward", "Exoskeleton_Neutral_Armor", 0.3),
    // HeadlessArmors' exo, given instead when that mod is installed (see transformQuestNodes).
    stashReward("WolfArmorFetch_StashRewardHeadless", "Exoskeleton_Neutral_Armor_headless", 0.4),

    // Cover Story (job 3).
    deciderGift(),
    ...DEALER_PROTOTYPES.map(({ SID }) => {
      const [gun, armor, helmet] = DEALER_KITS[SID];
      return generator(dealerGenerator(SID), [
        ["WeaponPrimary", [weapon(gun, gun === "GunPKP_MG" ? 300 : 180)]],
        ["BodyArmor", [one(armor)]],
        ...(helmet ? [["Head", [one(helmet)]] as [string, Record<string, unknown>[]]] : []),
        ["Consumable", medicine()],
      ]);
    }),
    // The Sultan's lads keep their own looks; this only puts an SMG in their hands.
    generator(`${QC}_GuardLoadout`, [["WeaponPrimary", [weapon("GunIntegral_PP", 180)]]]),
  ];
};
transformRewards.files = ["/ItemGeneratorPrototypes/QuestRewardsPrototypes/SQ87_Reward.cfg"];
