import { Struct } from "s2cfgtojson";
import type { TradePrototype } from "s2cfgtojson";

import type { StructTransformer } from "../../src/meta-type.mts";
import { bartendersTradePrototypes, generalTradersTradePrototypes, medicsTradePrototypes, technicianTradePrototypes } from "../../src/consts.mts";
import { precision } from "../../src/precision.mts";
import { semiRandom } from "../../src/semi-random.mts";

const oncePerFile = new Set<string>();
/**
 * Restrict what each trader category can buy, and create Guide_TradePrototype.
 */
export const transformTradePrototypes: StructTransformer<TradePrototype> = async (struct, context) => {
  const extraStructs: TradePrototype[] = [];
  if (!oncePerFile.has(context.filePath)) {
    oncePerFile.add(context.filePath);
    extraStructs.push(getGuideTp());
  }

  if (!struct.TradeGenerators || ignoreSIDs.has(struct.SID)) {
    return extraStructs.length ? extraStructs : null;
  }
  const fork = struct.fork();

  applyGeneralNPCMoney(fork, struct, context.index);

  const TradeGenerators = struct.TradeGenerators.map(([_k, tg]) => {
    const fork = tg.fork();
    fork.BuyLimitations = tg.BuyLimitations?.fork?.() || (new Struct({ __internal__: { isArray: true, bpatch: true } }) as any);

    buildTradeGeneratorLimitations(struct.SID).forEach((l) => fork.BuyLimitations.addNode(l));

    if (generalNPCTradePrototypesMoneyMult.has(struct.SID)) {
      fork.ArmorSellMinDurability = 0.99;
      fork.WeaponSellMinDurability = 0.99;
      fork.BuyLimitations = new Struct() as any;
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

export const ignoreSIDs = new Set(["BaseTraderNPC_Template", "BasicTrader", "TraderNPC", "AllTraderNPC", "RC_TraderNPC", "TradeTest"]);

export function applyGeneralNPCMoney(fork: TradePrototype, struct: TradePrototype, index: number, scale = 1): void {
  if (!generalNPCTradePrototypesMoneyMult.has(struct.SID)) return;
  fork.Money = precision(
    generalNPCTradePrototypesMoneyMult.get(struct.SID)! * scale * (struct.Money ?? 1000) * (semiRandom(index) + 1),
    1,
  );
}

// mult = armor_cost × 0.06 / vanilla_base (700) — ensures min money roll covers faction's top armor
export const generalNPCTradePrototypesMoneyMult = new Map([
  ["GeneralNPC_TradePrototype_Bandit", 2.06],   // Middle_Bandit_Armor 24k
  ["GeneralNPC_TradePrototype", 4.11],           // SEVA_Neutral_Armor 48k
  ["GeneralNPC_TradePrototype_Militaries", 3.94],// Heavy2_Military_Armor 46k
  ["GeneralNPC_TradePrototype_Scientists", 4.63],// SciSEVA_Scientific_Armor 54k
  ["GeneralNPC_TradePrototype_Spark", 4.59],     // HeavyBattle_Spark_Armor 53.5k
  ["GeneralNPC_TradePrototype_Corpus", 5.36],    // BattleExoskeleton_Varta_Armor 62.5k
  ["GeneralNPC_TradePrototype_Mercenary", 5.40], // Exoskeleton_Mercenaries_Armor 63k
  ["GeneralNPC_TradePrototype_Duty", 7.71],      // Exoskeleton_Dolg_Armor 90k
  ["GeneralNPC_TradePrototype_Freedom", 8.14],   // Exoskeleton_Svoboda_Armor 95k
]);

export function buildTradeGeneratorLimitations(structSID: string): string[] {
  const limitations = ["EItemType::MutantLoot"];

  if (bartendersTradePrototypes.has(structSID)) {
    limitations.push(
      ...[
        "EItemType::Armor",
        "EItemType::Artifact",
        "EItemType::Weapon",
        "EItemType::Ammo",
        "EItemType::Attach",
        "EItemType::Detector",
        "EItemType::Grenade",
        "EItemType::NightVisionGoggles",
      ],
    );
  }

  if (medicsTradePrototypes.has(structSID)) {
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

  if (generalTradersTradePrototypes.has(structSID)) {
    limitations.push(
      ...[
        "EItemType::Armor",
        "EItemType::Weapon",
        "EItemType::Ammo",
        "EItemType::Attach",
        "EItemType::Consumable",
        "EItemType::Detector",
        "EItemType::Grenade",
        "EItemType::Other",
        "EItemType::NightVisionGoggles",
      ],
    );
  }

  if (technicianTradePrototypes.has(structSID)) {
    limitations.push(
      ...["EItemType::Artifact", "EItemType::Armor", "EItemType::Weapon", "EItemType::Ammo", "EItemType::Consumable", "EItemType::Other"],
    );
  }

  return limitations;
}

export function getGuideTp() {
  return new Struct({
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
        SellModifier: 10 * 2.5,
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
  }) as TradePrototype;
}
