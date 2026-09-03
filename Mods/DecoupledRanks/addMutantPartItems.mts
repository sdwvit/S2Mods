import { Struct } from "s2cfgtojson";
import type { MutantLootPrototype } from "s2cfgtojson";

// XP = MaxHP / 10 (rounded)
export const MutantLootDefinitions = [
  { SID: "TushkanLoot", questSID: "TushkanLoot_Quest", xp: 2 },       // 19 HP
  { SID: "BlinddogLoot", questSID: "BlinddogLoot_Quest", xp: 6 },    // 63 HP
  { SID: "SnorkLoot", questSID: "SnorkLoot_Quest", xp: 15 },         // 150 HP
  { SID: "FleshLoot", questSID: "FleshLoot_Quest", xp: 28 },         // 280 HP
  { SID: "BoarLoot", questSID: "BoarLoot_Quest", xp: 30 },           // 300 HP
  { SID: "PseudodogLoot", questSID: "PseudodogLoot_Quest", xp: 30 }, // 300 HP
  { SID: "BurerLoot", questSID: "BurerLoot_Quest", xp: 40 },         // 400 HP
  { SID: "CatLoot", questSID: "CatLoot_Quest", xp: 40 },             // 400 HP
  { SID: "PoltergeistLoot", questSID: "PoltergeistLoot_Quest", xp: 40 }, // 400 HP
  { SID: "BloodsuckerLoot", questSID: "BloodsuckerLoot_Quest", xp: 50 }, // 500 HP
  { SID: "ControllerLoot", questSID: "ControllerLoot_Quest", xp: 50 },   // 500 HP
  { SID: "DeerLoot", questSID: "DeerLoot_Quest", xp: 60 },           // 600 HP
  { SID: "ChimeraLoot", questSID: "ChimeraLoot_Quest", xp: 140 },    // 1400 HP
  { SID: "PseudogiantLoot", questSID: "PseudogiantLoot_Quest", xp: 250 }, // 2500 HP
] as const;

let once = false;

export function addMutantPartItems() {
  if (once) return;
  once = true;

  return MutantLootDefinitions.map(
    ({ SID, questSID }) =>
      new Struct({
        __internal__: { refkey: SID, rawName: questSID, isRoot: true },
        SID: questSID,
        // Without this the clone keeps the vanilla loot item's `LocalizationSID` and shows its
        // name. This variant never survives pickup - the quest graph swaps it for the vanilla
        // part - so it gets text of its own, saying only how much XP it is worth.
        LocalizationSID: questSID,
      }),
  ) as MutantLootPrototype[];
}

addMutantPartItems.files = ["/MutantLootPrototypes.cfg"];
