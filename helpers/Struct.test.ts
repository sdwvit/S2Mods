import { describe, test, expect } from "vitest";
import { Struct } from "./Struct.ts";
import * as fs from "node:fs";

const bigFile = fs
  .readFileSync(
    "/home/sdwvit/MX500-900/games/stalker-modding/Output/Exports/Stalker2/Content/GameLite/GameData/AbilityPrototypes.cfg",
    "utf-8",
  )
  .split("\n")
  .filter((line) => line.trim())
  .map((line) => line.replace("\r", ""))
  .join("\n");

class ChimeraHPFix extends Struct {
  _id = "Chimera";
  refurl = "../Chimera.cfg";
  refkey = "Chimera.VitalParams";
  MaxHP = 750;
  isRoot = true;
}
class TradersDontBuyWeaponsArmor extends Struct {
  _id: "";
  refurl = "../TradePrototypes.cfg";
  refkey = 0;
  isRoot = true;
  TradeGenerators = new TradeGenerators();
}
class TradeGenerators extends Struct {
  _id: "";
  "*" = new TradeGenerator();
}
class TradeGenerator extends Struct {
  _id: "";
  BuyLimitations = new BuyLimitations();
}
class BuyLimitations extends Struct {
  _id: "";
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

  describe("fromString()", () => {
    test("1", () => {
      const chimeraText = new ChimeraHPFix().toString();

      expect(Struct.fromString(chimeraText)[0].toString()).toBe(chimeraText);
    });

    test("2", () => {
      const complexStructText = `BasePhantomAttack : struct.begin {refkey=BaseAttackAbility}
   TriggeredCooldowns : struct.begin
      [0] : struct.begin
         CooldownTag = Ability.Cooldown.RunAttack
         Duration = 50.f
      struct.end
   struct.end
   Effects : struct.begin
      [0] : struct.begin
         EffectPrototypeSID = MutantMediumAttackCameraShake
         Chance = 1.f
      struct.end
   struct.end
struct.end`;
      expect(Struct.fromString(complexStructText)[0].toString()).toBe(
        complexStructText,
      );
    });

    test("3", () => {
      expect(
        Struct.fromString(bigFile)
          .map((s) => s.toString())
          .join("\n"),
      ).toBe(bigFile);
    });

    test("4", () => {
      const read = Struct.fromString<{
        _id: string;
        ItemGenerator?: { Category?: string };
      }>(
        fs.readFileSync(
          "/home/sdwvit/MX500-900/games/stalker-modding/Output/Exports/GlassCannon/Stalker2/Content/GameLite/GameData/ItemGeneratorPrototypes/DynamicItemGenerator/TradersDontSellWeaponsArmor.cfg",
          "utf-8",
        ),
      );
      const modifiedSet = new Set(read);
      for (const eachStruct of modifiedSet) {
      }
      const modified = [...modifiedSet];
      fs.writeFileSync(
        "/home/sdwvit/MX500-900/games/stalker-modding/Output/Exports/GlassCannon/Stalker2/Content/GameLite/GameData/ItemGeneratorPrototypes/DynamicItemGenerator/TradersDontSellWeaponsArmor.cfg",
        modified.map((s) => s.toString()).join("\n"),
      );
    }, 150060);
  });
});
