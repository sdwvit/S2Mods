import { Struct } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";

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
  ];
};
transformRewards.files = ["/ItemGeneratorPrototypes/QuestRewardsPrototypes/SQ87_Reward.cfg"];
