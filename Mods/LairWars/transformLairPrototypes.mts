import type { GenericLairPrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { lairPrototypeVariantBase, tierLairPrototypes } from "./lairTiers.mts";

/**
 * Emits `<LairProto>_LT0..9` next to each vanilla lair prototype a lair uses, plus the tier prototypes
 * of its spawn-pool variants (`<LairProto>_<name>_LT0..9`).
 */
export const transformLairPrototypes: StructTransformer<GenericLairPrototype> = (struct) => {
  const name = struct.__internal__.rawName;
  const variants = Object.keys(lairPrototypeVariantBase).filter((v) => lairPrototypeVariantBase[v] === name);
  const out = [name, ...variants].flatMap((sid) => tierLairPrototypes[sid] ?? []);
  return out.length ? out : null;
};

transformLairPrototypes.files = ["/LairPrototypes/GenericLairPrototypes.cfg"];
