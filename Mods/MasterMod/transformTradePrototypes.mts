import { Struct, TradePrototype } from "s2cfgtojson";

import { EntriesTransformer } from "../../src/meta-type.mts";
import { precision } from "../../src/precision.mts";
import { semiRandom } from "../../src/semi-random.mts";
import { bartendersTradePrototypes, generalTradersTradePrototypes, medicsTradePrototypes, technicianTradePrototypes } from "../../src/consts.mts";
import { DIFFICULTY_FACTOR } from "../GlassCannon/meta.mts";

const oncePerFile = new Set<string>();
/**
 * Don't allow traders to buy weapons and armor.
 */
export const transformTradePrototypes: EntriesTransformer<TradePrototype> = async (struct, context) => {
  const extraStructs: TradePrototype[] = [];
  if (!oncePerFile.has(context.filePath)) {
    oncePerFile.add(context.filePath);
    extraStructs.push(
      new Struct({
        __internal__: {
          rawName: "Guide_TradePrototype",
          refkey: "[0]",
          isRoot: true,
        },
        SID: "Guide_TradePrototype",
        TradeTimeLength: 24,
        TradeGenerators: {
          __internal__: { isArray: true },
          0: {
            ConditionSID: "ConstTrue",
            ItemGeneratorPrototypeSID: "empty",
            BuyModifier: 10,
            SellModifier: 10,
            BuyLimitations: {
              __internal__: { isArray: true },
              0: "EItemType::Weapon",
              1: "EItemType::Armor",
              2: "EItemType::Artifact",
              3: "EItemType::Attach",
              4: "EItemType::Consumable",
              5: "EItemType::Detector",
              6: "EItemType::Grenade",
              7: "EItemType::MutantLoot",
              8: "EItemType::Ammo",
              9: "EItemType::NightVisionGoggles",
            },
          },
        },
        BuyDiscounts: {
          __internal__: { isArray: true },
          0: {
            ConditionSID: "PlayerRankExperienced",
            Modifier: 1.15,
          },
          1: {
            ConditionSID: "PlayerRankVeteran",
            Modifier: 1.2,
          },
          2: {
            ConditionSID: "PlayerRankMaster",
            Modifier: 1.25,
          },
        },
        bInfiniteMoney: true,
        RefreshConditionSID: "TradeRegenHoursPassed8",
      }) as TradePrototype,
    );
  }

  if (!struct.TradeGenerators || ignoreSIDs.has(struct.SID)) {
    return extraStructs.length ? extraStructs : null;
  }
  const fork = struct.fork();
  if (GeneralNPCTradePrototypesMoneyMult.has(struct.SID)) {
    fork.Money = precision(
      GeneralNPCTradePrototypesMoneyMult.get(struct.SID) * DIFFICULTY_FACTOR * (struct.Money ?? 1000) * (semiRandom(context.index) + 1),
      1,
    );
  }
  const TradeGenerators = struct.TradeGenerators.map(([_k, tg]) => {
    const fork = tg.fork();
    fork.BuyLimitations = tg.BuyLimitations?.fork?.() || (new Struct({ __internal__: { isArray: true, bpatch: true } }) as any);
    const limitations = ["EItemType::MutantLoot"];

    if (bartendersTradePrototypes.has(struct.SID)) {
      limitations.push(
        ...[
          "EItemType::Armor",
          "EItemType::Artifact",
          "EItemType::Weapon",
          "EItemType::Ammo",
          "EItemType::Attach",
          "EItemType::Detector",
          "EItemType::Grenade",
          "EItemType::MutantLoot",
          "EItemType::NightVisionGoggles",
        ],
      );
    }

    if (medicsTradePrototypes.has(struct.SID)) {
      fork.BuyModifier = 0.7;
      limitations.push(
        ...[
          "EItemType::Armor",
          "EItemType::Artifact",
          "EItemType::Weapon",
          "EItemType::Ammo",
          "EItemType::Attach",
          "EItemType::Detector",
          "EItemType::Grenade",
          "EItemType::Other",
          "EItemType::NightVisionGoggles",
        ],
      );
    }

    if (generalTradersTradePrototypes.has(struct.SID)) {
      limitations.push(
        ...[
          "EItemType::Armor",
          "EItemType::Consumable",
          "EItemType::Weapon",
          "EItemType::Ammo",
          "EItemType::Detector",
          "EItemType::Grenade",
          "EItemType::Other",
          "EItemType::Attach",
          "EItemType::NightVisionGoggles",
        ],
      );
    }

    if (technicianTradePrototypes.has(struct.SID)) {
      limitations.push(
        ...["EItemType::Artifact", "EItemType::Armor", "EItemType::Weapon", "EItemType::Ammo", "EItemType::Consumable", "EItemType::Other"],
      );
    }

    limitations.forEach((l) => fork.BuyLimitations.addNode(l));

    if (GeneralNPCTradePrototypesMoneyMult.has(struct.SID)) {
      fork.ArmorSellMinDurability = 0.99;
      fork.WeaponSellMinDurability = 0.99;
      fork.BuyLimitations = new Struct() as any;
    }
    if (tg.BuyModifier > 0.3) {
      fork.BuyModifier = 0.3;
    }
    return fork;
  });
  TradeGenerators.__internal__.useAsterisk = struct.TradeGenerators.entries().some(([_k, tg]) => tg.__internal__.rawName === "[*]");
  TradeGenerators.__internal__.bpatch = true;
  Object.assign(fork, { TradeGenerators });
  extraStructs.push(fork);
  return extraStructs;
};

transformTradePrototypes.files = ["/TradePrototypes.cfg"];

export const GeneralNPCTradePrototypesMoneyMult = new Map([
  ["GeneralNPC_TradePrototype_Bandit", 0.8],
  ["GeneralNPC_TradePrototype", 1],
  ["GeneralNPC_TradePrototype_Militaries", 1.1],
  ["GeneralNPC_TradePrototype_Scientists", 1.4],
  ["GeneralNPC_TradePrototype_Duty", 1.8],
  ["GeneralNPC_TradePrototype_Mercenary", 2.1],
  ["GeneralNPC_TradePrototype_Freedom", 2.5],
  ["GeneralNPC_TradePrototype_Spark", 3],
  ["GeneralNPC_TradePrototype_Corpus", 5],
]);

const ignoreSIDs = new Set(["BaseTraderNPC_Template", "BasicTrader", "TraderNPC", "AllTraderNPC", "RC_TraderNPC", "TradeTest"]);
