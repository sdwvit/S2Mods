import { BarbedWirePrototype } from "s2cfgtojson";
import { StructTransformer } from "../../src/meta-type.mts";

/**
 * Remove barbed wire bleeding and armor damage
 */
export const transformBarbedWirePrototypes: StructTransformer<BarbedWirePrototype> = async (struct) => {
  if (struct.SID !== "Empty") return null;
  const fork = struct.fork();

  if (struct.BleedingChance) fork.BleedingChance = 0.0001;
  if (struct.BleedingValue) fork.BleedingValue = 0.0001;
  if (struct.ArmorDamage) fork.ArmorDamage = 0.0001;

  return fork;
};

transformBarbedWirePrototypes.files = ["/BarbedWirePrototypes.cfg"];
