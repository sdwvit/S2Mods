import type { Struct } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { abilityCloneFileSuffixes, abilityClonesByAbility, buildAbilityClone } from "./lairTiers.mts";

/** Emits `<Ability>_LT<Rank>` (shorter cooldowns) after each mutant ability a tier lair's mutants use. */
export const transformAbilityPrototypes: StructTransformer<Struct> = (struct) =>
  abilityClonesByAbility[struct.__internal__.rawName]?.map(buildAbilityClone) ?? null;

transformAbilityPrototypes.files = abilityCloneFileSuffixes;
