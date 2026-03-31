import type { MetaType } from "../../src/meta-type.mts";
import type { ItemGeneratorPrototype } from "s2cfgtojson";
import { Struct } from "s2cfgtojson";

const medicGenerators = new Set([
  "MedicUniversal_TradeItemGenerator",
  "MedicNoon_TradeItemGenerator",
]);

const pillsByRank: Record<string, { Chance: number; MinCount: number; MaxCount: number }> = {
  "ERank::Newbie": { Chance: 0.3, MinCount: 1, MaxCount: 1 },
  "ERank::Experienced": { Chance: 0.5, MinCount: 1, MaxCount: 2 },
  "ERank::Veteran": { Chance: 0.8, MinCount: 1, MaxCount: 3 },
  "ERank::Master": { Chance: 1, MinCount: 2, MaxCount: 4 },
};

const pills = ["Cinnamon", "Hercules", "PSYBlocker"];

function transformTrade(struct: ItemGeneratorPrototype) {
  if (!medicGenerators.has(struct.SID)) return;

  const fork = struct.fork();
  const ItemGenerator = struct.ItemGenerator.map(([_k, e]) => {
    const rank = pillsByRank[e.PlayerRank as string];
    if (!rank) return;
    const entryFork = e.fork();
    entryFork.PossibleItems = e.PossibleItems.fork();
    for (const pill of pills) {
      entryFork.PossibleItems[pill] = new Struct({
        ItemPrototypeSID: pill,
        Chance: rank.Chance,
        MinCount: rank.MinCount,
        MaxCount: rank.MaxCount,
      });
    }
    return entryFork;
  });

  if (!ItemGenerator.entries().length) return;
  ItemGenerator.__internal__.bpatch = true;
  ItemGenerator.__internal__.useAsterisk = false;
  return Object.assign(fork, { ItemGenerator });
}
transformTrade.files = ["/DynamicItemGenerator.cfg"];

export const meta: MetaType<ItemGeneratorPrototype> = {
  structTransformers: [transformTrade],
  description: `Adds Cinnamon, Hercules, and PSYBlocker pills to every medic's trade inventory across the Zone.
[hr][/hr]
Pills scale with player rank — rare at Newbie, guaranteed at Master.`,
  changenote: "Initial release",
};
