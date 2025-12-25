import { Struct, TradePrototype } from "s2cfgtojson";
import { MetaType } from "../../src/meta-type.mts";
type TG = TradePrototype["TradeGenerators"]["0"];
function entriesTransformer(struct: TradePrototype) {
  if (!struct.TradeGenerators) {
    return null;
  }
  const fork = struct.fork();
  fork.TradeGenerators = struct.TradeGenerators.map((_) => {
    const tg = new Struct() as TG;
    tg.BuyLimitations ||= new Struct() as TG["BuyLimitations"];
    tg.BuyLimitations.addNode("EItemType::Weapon");
    tg.BuyLimitations.addNode("EItemType::Armor");
    return tg;
  });
  fork.TradeGenerators.__internal__.bpatch = true;
  return fork;
}

entriesTransformer.files = ["/TradePrototypes.cfg"];

export const meta: MetaType<TradePrototype> = {
  description: `
   This mode does only one thing: traders don't buy Weapons / Helmets / Armor.
[hr][/hr]
No more loot goblin.
[hr][/hr]
Warning: this makes the game more difficult and interesting.[h1][/h1]
Meant to be used in other collections of mods.
   `,
  changenote: "Updated to 1.7.x",
  structTransformers: [entriesTransformer],
};
