import { Struct } from "s2cfgtojson";
import type { MutantLootPrototype } from "s2cfgtojson";

export const MutantLootDefinitions = [
  { SID: "TushkanLoot", questSID: "TushkanLoot_Quest", xp: 3 },
  { SID: "BlinddogLoot", questSID: "BlinddogLoot_Quest", xp: 5 },
  { SID: "FleshLoot", questSID: "FleshLoot_Quest", xp: 5 },
  { SID: "BoarLoot", questSID: "BoarLoot_Quest", xp: 8 },
  { SID: "PseudodogLoot", questSID: "PseudodogLoot_Quest", xp: 10 },
  { SID: "SnorkLoot", questSID: "SnorkLoot_Quest", xp: 10 },
  { SID: "BloodsuckerLoot", questSID: "BloodsuckerLoot_Quest", xp: 12 },
  { SID: "BurerLoot", questSID: "BurerLoot_Quest", xp: 12 },
  { SID: "ControllerLoot", questSID: "ControllerLoot_Quest", xp: 12 },
  { SID: "PoltergeistLoot", questSID: "PoltergeistLoot_Quest", xp: 15 },
  { SID: "CatLoot", questSID: "CatLoot_Quest", xp: 18 },
  { SID: "DeerLoot", questSID: "DeerLoot_Quest", xp: 20 },
  { SID: "PseudogiantLoot", questSID: "PseudogiantLoot_Quest", xp: 22 },
  { SID: "ChimeraLoot", questSID: "ChimeraLoot_Quest", xp: 25 },
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
      }),
  ) as MutantLootPrototype[];
}

addMutantPartItems.files = ["/MutantLootPrototypes.cfg"];
