import { MetaType } from "../../src/meta-type.mts";
import { Struct, TradePrototype } from "s2cfgtojson";

export const meta: MetaType<TradePrototype> = {
  description: `
This mod makes traders refuse to purchase Weapons.
[hr][/hr]  
bPatches TradePrototypes.cfg
   `,
  changenote: "Initial release",
  structTransformers: [entriesTransformer],
};

function entriesTransformer(struct: TradePrototype) {
  if (!struct.TradeGenerators) {
    return null;
  }
  const fork = struct.fork();
  fork.TradeGenerators = struct.TradeGenerators.map(([k, e]) => {
    const fork = e.fork();
    fork.BuyLimitations = new Struct() as any;
    fork.BuyLimitations.addNode("EItemType::Weapon");
    return fork;
  });

  return fork;
}

entriesTransformer.files = ["/TradePrototypes.cfg"];
