import { Struct } from "s2cfgtojson";
import type { TradePrototype } from "s2cfgtojson";

import type { StructTransformer } from "../../src/meta-type.mts";
import { bartendersTradePrototypes, medicsTradePrototypes, technicianTradePrototypes } from "../../src/consts.mts";

let oncePerFile = false;
/**
 * Restrict what each trader category can buy, and create Guide_TradePrototype.
 */
export const transformTradePrototypes: StructTransformer<TradePrototype> = async (struct) => {
  const extraStructs: TradePrototype[] = [];
  if (!oncePerFile) {
    oncePerFile = true;
    const guideTP = getGuideTp();
    extraStructs.push(guideTP);
  }

  if (!struct.TradeGenerators || ignoreSIDs.has(struct.SID)) {
    return extraStructs.length ? extraStructs : null;
  }
  const fork = struct.fork();

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
          "EItemType::MutantLoot",
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

    return fork;
  });
  TradeGenerators.__internal__.useAsterisk = struct.TradeGenerators.entries().some(([_k, tg]) => tg.__internal__.rawName === "[*]");
  TradeGenerators.__internal__.bpatch = true;
  Object.assign(fork, { TradeGenerators });
  extraStructs.push(fork);
  return extraStructs;
};

transformTradePrototypes.files = ["/TradePrototypes.cfg"];

const ignoreSIDs = new Set(["BaseTraderNPC_Template", "BasicTrader", "TraderNPC", "AllTraderNPC", "RC_TraderNPC", "TradeTest"]);

function getGuideTp() {
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
