import type { TradePrototype } from "s2cfgtojson";

import type { StructTransformer } from "../../src/meta-type.mts";
import { DIFFICULTY_FACTOR } from "../GlassCannon/meta.mts";
import { ignoreSIDs } from "../SpecialistMerchants/transformTradePrototypes.mts";

const GAMMA_FACTOR = DIFFICULTY_FACTOR / 1.6;

export const transformTradePrototypes: StructTransformer<TradePrototype> = async (struct, _context) => {
  if (!struct.TradeGenerators || ignoreSIDs.has(struct.SID)) return null;

  const fork = struct.fork();
  const TradeGenerators = struct.TradeGenerators.map(([_k, tg]) => {
    const tgFork = tg.fork();
    tgFork.SellModifier = GAMMA_FACTOR;
    return tgFork;
  });
  TradeGenerators.__internal__.useAsterisk = struct.TradeGenerators.entries().some(([_k, tg]) => tg.__internal__.rawName === "[*]");
  TradeGenerators.__internal__.bpatch = true;
  Object.assign(fork, { TradeGenerators });
  return fork;
};

transformTradePrototypes.files = ["/TradePrototypes.cfg"];
