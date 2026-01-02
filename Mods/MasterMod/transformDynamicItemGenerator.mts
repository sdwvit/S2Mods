import { DynamicItemGenerator, Struct } from "s2cfgtojson";
import { ALL_RANKS_SET, generalTradersTradeItemGenerators } from "../../src/consts.mts";
import { semiRandom } from "../../src/semi-random.mts";
import { precision } from "../../src/precision.mts";
import { adjustArmorItemGenerator } from "./adjustArmorItemGenerator.mts";

function transformTrade(struct: DynamicItemGenerator) {
  const fork = struct.fork();
  if (!struct.RefreshTime) {
    fork.RefreshTime = "1d";
  }
  const ItemGenerator = struct.ItemGenerator.map(([_k, e]) => {
    // noinspection FallThroughInSwitchStatementJS
    switch (e.Category) {
      case "EItemGenerationCategory::Attach":
        if (generalTradersTradeItemGenerators.has(struct.SID)) {
          return Object.assign(e.fork(), { ReputationThreshold: 1000000 });
        }
        if (struct.SID === "Trader_Attachments_T4_ItemGenerator") {
          return Object.assign(e.fork(), {
            PossibleItems: Object.assign(e.PossibleItems.fork(), {
              RU_X4Scope_1: new Struct({ ItemPrototypeSID: "RU_X4Scope_1", Chance: 0.7, MinCount: 1, MaxCount: 1 }),
              RU_X8Scope_1: new Struct({ ItemPrototypeSID: "RU_X8Scope_1", Chance: 0.3, MinCount: 1, MaxCount: 1 }),
              EN_X8Scope_1: new Struct({ ItemPrototypeSID: "EN_X8Scope_1", Chance: 0.3, MinCount: 1, MaxCount: 1 }),
            }),
          });
        }
        break;
      case "EItemGenerationCategory::BodyArmor":
      case "EItemGenerationCategory::Head":
      case "EItemGenerationCategory::WeaponPrimary":
      case "EItemGenerationCategory::WeaponPistol":
      case "EItemGenerationCategory::WeaponSecondary":
        return Object.assign(e.fork(), { ReputationThreshold: 1000000 });
      case "EItemGenerationCategory::SubItemGenerator": {
        const PossibleItems = (e.PossibleItems as DynamicItemGenerator["ItemGenerator"]["0"]["PossibleItems"]).map(([_k, pi]) => {
          if (
            generalTradersTradeItemGenerators.has(struct.SID) &&
            (pi.ItemGeneratorPrototypeSID?.includes("Attach") ||
              pi.ItemGeneratorPrototypeSID?.includes("Cosnsumables") ||
              pi.ItemGeneratorPrototypeSID?.includes("Consumables"))
          ) {
            return Object.assign(pi.fork(), { Chance: 0 }); // Disable attachments and consumables sell for general traders
          }
          if (pi.ItemGeneratorPrototypeSID?.includes("Gun")) {
            return Object.assign(pi.fork(), { Chance: 0 }); // Disable gun sell
          }
        });
        if (struct.SID === "YanovTrader_TradeItemGenerator") {
          PossibleItems.addNode(
            new Struct({
              ItemGeneratorPrototypeSID: "Trader_T2_Ammo_ItemGenerator",
              Chance: 1,
            }),
            "Trader_T2_Ammo_ItemGenerator",
          );
        }
        if (!PossibleItems.entries().length) {
          return;
        }
        PossibleItems.__internal__.bpatch = true;
        return Object.assign(e.fork(), { PossibleItems });
      }
    }
  });
  if (!ItemGenerator.entries().length) {
    return;
  }
  ItemGenerator.__internal__.bpatch = true;
  return Object.assign(fork, { ItemGenerator });
}

function transformConsumables(e: DynamicItemGenerator["ItemGenerator"]["0"], i: number) {
  const fork = e.fork();
  const PossibleItems = e.PossibleItems.filter(([_k, pi]) => !pi.ItemPrototypeSID.toLowerCase().includes("key")).map(([_k, pi], j) => {
    let chance = semiRandom(i + j); // Randomize
    while (chance > 0.02) {
      chance /= 2;
    }
    chance = precision(chance);
    return Object.assign(pi.fork(), { Chance: chance });
  });
  if (!PossibleItems.entries().length) {
    return;
  }
  PossibleItems.__internal__.bpatch = true;
  return Object.assign(fork, { PossibleItems });
}

function transformWeapons(e: DynamicItemGenerator["ItemGenerator"]["0"], i: number) {
  const fork = e.fork();
  const minMaxAmmo = (pi, j) => ({
    AmmoMinCount: 0,
    AmmoMaxCount: Math.min(Math.floor(1 + 10 * semiRandom(i + j)), pi.AmmoMaxCount || 1),
  });
  const PossibleItems = e.PossibleItems.map(([_k, pi], j) => Object.assign(pi.fork(), minMaxAmmo(pi, j)));

  // add lavinas
  const [_, gvintarMaybe] = e.PossibleItems.entries().find(([_k, pi]) => pi.ItemPrototypeSID === "GunGvintar_ST") || [];
  if (gvintarMaybe) {
    PossibleItems.addNode(
      new Struct({
        ...gvintarMaybe,
        ...minMaxAmmo(gvintarMaybe, PossibleItems.entries().length),
        ItemPrototypeSID: "GunLavina_ST",
      }),
      "GunLavina_ST",
    );
  }

  if (!PossibleItems.entries().length) {
    return;
  }
  PossibleItems.__internal__.bpatch = true;
  return Object.assign(fork, { PossibleItems });
}

function transformCombat(struct: DynamicItemGenerator) {
  const fork = struct.fork();
  if (!struct.ItemGenerator) {
    return;
  }
  const categories = new Set(struct.ItemGenerator.entries().map(([_k, ig]) => ig.Category));
  categories.add("EItemGenerationCategory::Head");
  categories.add("EItemGenerationCategory::BodyArmor");

  categories.forEach((Category) => {
    const generators = struct.ItemGenerator.entries().filter(([_k, ig]) => ig.Category === Category);
    const genRanks = new Set(generators.flatMap(([_k, ig]) => (ig.PlayerRank ? ig.PlayerRank.split(",").map((r) => r.trim()) : [])));
    const missingRanks = ALL_RANKS_SET.difference(genRanks);
    if (generators.length) {
      [...missingRanks].forEach((mr) => {
        struct.ItemGenerator.addNode(
          new Struct({
            Category,
            PlayerRank: mr,
            bAllowSameCategoryGeneration: true,
            PossibleItems: new Struct({
              __internal__: { rawName: "PossibleItems", isArray: true },
            }),
            __internal__: {
              rawName: `${Category.replace("EItemGenerationCategory::", "")}_for_${mr.replace("ERank::", "_")}`,
            },
          }),
          `${Category.replace("EItemGenerationCategory::", "")}_for_${mr.replace("ERank::", "_")}`,
        );
      });
    }
  });

  const ItemGenerator = struct.ItemGenerator.map(([_k, itemGenerator], i) => {
    // noinspection FallThroughInSwitchStatementJS
    switch (itemGenerator.Category) {
      /**
       * Control how many consumables are dropped.
       */
      case "EItemGenerationCategory::Ammo":
      case "EItemGenerationCategory::Artifact":
      case "EItemGenerationCategory::Consumable": {
        return transformConsumables(itemGenerator as any, i);
      }
      case "EItemGenerationCategory::WeaponPrimary":
      case "EItemGenerationCategory::WeaponPistol":
      case "EItemGenerationCategory::WeaponSecondary": {
        return transformWeapons(itemGenerator as any, i);
      }
    }
  });

  if (!ItemGenerator.entries().length || !ItemGenerator.filter((e): e is any => !!(e[1].PossibleItems as Struct).entries().length).entries().length) {
    return;
  }
  ItemGenerator.__internal__.bpatch = true;
  return Object.assign(fork, { ItemGenerator });
}

/**
 * Does not allow traders to sell gear.
 * Allows NPCs to drop armor.
 */
export async function transformDynamicItemGenerator(struct: DynamicItemGenerator) {
  /**
   * Does not allow traders to sell gear.
   */
  if (struct.SID.includes("Trade")) {
    return transformTrade(struct);
  }
  return transformCombat(struct);
}

transformDynamicItemGenerator.files = ["/DynamicItemGenerator.cfg", "QuestItemGeneratorPrototypes.cfg"];
