import { Struct } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";

let once = false;

export const transformRewards: StructTransformer<Struct> = () => {
  if (once) return;
  once = true;

  const moneyReward = new Struct({
    __internal__: { rawName: "WolfArmorFetch_MoneyReward", isRoot: true },
    SID: "WolfArmorFetch_MoneyReward",
    MoneyGenerator: new Struct({ MinCount: 5000, MaxCount: 5000 }),
  });

  const itemEntry = new Struct({
    ItemPrototypeSID: "Exoskeleton_Neutral_Armor",
    MinCount: 1,
    MaxCount: 1,
    MinDurability: 1,
    MaxDurability: 1,
    Chance: 1,
  });
  const PossibleItems = new Struct();
  PossibleItems.addNode(itemEntry);

  const categoryEntry = new Struct({ Category: "EItemGenerationCategory::BodyArmor", PossibleItems });
  const ItemGenerator = new Struct();
  ItemGenerator.addNode(categoryEntry);

  const stashReward = new Struct({
    __internal__: { rawName: "WolfArmorFetch_StashReward", isRoot: true },
    SID: "WolfArmorFetch_StashReward",
    ItemGenerator,
  });

  return [moneyReward, stashReward];
};
transformRewards.files = ["/ItemGeneratorPrototypes/QuestRewardsPrototypes/SQ87_Reward.cfg"];
