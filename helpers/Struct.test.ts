import { describe, test, expect } from "vitest";
import { Struct } from "./Struct";
class ChimeraHPFix extends Struct {
  refurl = "../Chimera.cfg";
  refkey = "Chimera.VitalParams";
  MaxHP = 750;
  isRoot = true;
}
class TradersDontBuyWeaponsArmor extends Struct {
  refurl = "../TradePrototypes.cfg";
  refkey = 0;
  isRoot = true;
  TradeGenerators = new TradeGenerators();
}
class TradeGenerators extends Struct {
  "*" = new TradeGenerator();
}
class TradeGenerator extends Struct {
  BuyLimitations = new BuyLimitations();
}
class BuyLimitations extends Struct {
  [0] = "EItemType::Weapon";
  [1] = "EItemType::Armor";
}

describe("Struct", () => {
  test("toString()", () => {
    expect(new ChimeraHPFix().toString()).toBe(
      `ChimeraHPFix : struct.begin {refurl=../Chimera.cfg;refkey=Chimera.VitalParams}
   MaxHP = 750
struct.end`,
    );

    expect(new TradersDontBuyWeaponsArmor().toString()).toBe(
      `TradersDontBuyWeaponsArmor : struct.begin {refurl=../TradePrototypes.cfg;refkey=[0]}
   TradeGenerators : struct.begin
      [*] : struct.begin
         BuyLimitations : struct.begin
            [0] = EItemType::Weapon
            [1] = EItemType::Armor
         struct.end
      struct.end
   struct.end
struct.end`,
    );
  });

  test("pad()", () => {
    expect(Struct.pad("test")).toBe("   test");
    expect(Struct.pad(Struct.pad("test"))).toBe("      test");
  });

  test("fromString()", () => {
    const chimeraText = new ChimeraHPFix().toString();

    expect(Struct.fromString(chimeraText).toString()).toBe(chimeraText);
  });
});
