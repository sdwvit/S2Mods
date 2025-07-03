import { describe, test, expect } from "vitest";
import { Entries, Struct, Value } from "./Struct.ts";
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
  _id = "ChimeraHPFix";
  bskipref = true;
  entries = { MaxHP: 750 };
  isRoot = true;
}
class TradersDontBuyWeaponsArmor extends Struct {
  _id = "TradersDontBuyWeaponsArmor";
  refurl = "../TradePrototypes.cfg";
  refkey = 0;
  isRoot = true;
  entries = { TradeGenerators: new TradeGenerators() };
}
class TradeGenerators extends Struct {
  _id = "TradeGenerators";
  entries = { "*": new TradeGenerator() };
}
class TradeGenerator extends Struct {
  _id = "TradeGenerator";
  entries = { BuyLimitations: new BuyLimitations() };
}
class BuyLimitations extends Struct {
  _id = "BuyLimitations";
  entries = { [0]: "EItemType::Weapon", [1]: "EItemType::Armor" };
}

describe("Struct", () => {
  test("toString()", () => {
    expect(new ChimeraHPFix().toString()).toBe(
      `ChimeraHPFix : struct.begin {bskipref}
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
      const read = Struct.fromString(
        fs.readFileSync(
          "/home/sdwvit/MX500-900/games/stalker-modding/Output/Exports/Stalker2/Content/GameLite/GameData/ItemGeneratorPrototypes/DynamicItemGenerator.cfg",
          "utf-8",
        ),
      );

      const prohibitedCategories = new Set([
        "EItemGenerationCategory::WeaponPrimary",
        "EItemGenerationCategory::BodyArmor",
        "EItemGenerationCategory::WeaponPistol",
        "EItemGenerationCategory::WeaponSecondary",
        "EItemGenerationCategory::Head",
      ]);
      const modified = read
        .filter(
          (s) =>
            s._id.toLowerCase().includes("trade") &&
            s.entries.ItemGenerator &&
            s.entries.ItemGenerator.entries?.filter &&
            s.entries.ItemGenerator.entries.find((e) =>
              prohibitedCategories.has(e.entries.Category),
            ),
        )
        .map((s) => {
          const useAsterisk = s.entries.ItemGenerator.entries._useAsterisk;
          s.entries.ItemGenerator.entries = s.entries.ItemGenerator.entries
            .filter((e) => !prohibitedCategories.has(e.entries.Category))
            .map((e) => {
              // e.bskipref = true;
              //   if (e.entries.PossibleItems)
              // e.entries.PossibleItems.bskipref = true;
              return e;
            });
          s.entries.ItemGenerator.entries._useAsterisk = useAsterisk;
          s.entries.ItemGenerator.bskipref = true;
          s.refurl = "../DynamicItemGenerator.cfg";
          s.refkey = s._id;
          s._id = `TradersDontSellWeaponsArmor_${s._id}`;
          return s;
        });
      fs.writeFileSync(
        "/home/sdwvit/MX500-900/games/stalker-modding/Output/Exports/Mods/GlassCannon/Stalker2/Content/GameLite/GameData/ItemGeneratorPrototypes/DynamicItemGenerator/TradersDontSellWeaponsArmor.cfg",
        modified.map((s) => s.toString()).join("\n\n"),
      );
    }, 150060);
  });
});
