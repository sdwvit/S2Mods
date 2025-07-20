import { GetStructType, Struct } from "s2cfgtojson";

/**
 * Don't allow traders to buy weapons and armor.
 */
export function transformTradePrototypes(entries: TraderEntries, { file }: { file: string }) {
  if (!file.includes("TradePrototypes.cfg")) {
    return entries;
  }
  if (entries.SID.includes("Trade") && entries.TradeGenerators?.entries) {
    Object.values(entries.TradeGenerators.entries)
      .filter((tg) => tg.entries)
      .forEach((tg) => {
        tg.entries = { BuyLimitations: tg.entries.BuyLimitations || new BuyLimitations() };
        ["EItemType::Weapon", "EItemType::Armor"].forEach((itemType) => {
          let i = 0;
          while (tg.entries.BuyLimitations[i] && tg.entries.BuyLimitations[i] !== itemType) {
            i++;
          }
          tg.entries.BuyLimitations[i] = itemType;
        });
      });
    return { TradeGenerators: entries.TradeGenerators };
  }
  return null;
}
export type TraderEntries = GetStructType<{
  SID: "BaseTraderNPC_Template";
  TradeGenerators: {
    BuyLimitations: ("EItemType::Weapon" | "EItemType::Armor")[];
  }[];
}>["entries"];

class BuyLimitations extends Struct {
  _id = "BuyLimitations";
  entries: Record<number, string> = { 0: "EItemType::Weapon", 1: "EItemType::Armor" };
}
