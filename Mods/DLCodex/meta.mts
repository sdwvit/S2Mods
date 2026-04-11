import type { MetaType } from "../../src/meta-type.mts";
import { Struct } from "s2cfgtojson";
import type {GeneralNPCObjPrototype,AmmoPrototype, DifficultyPrototype } from "s2cfgtojson";

export const meta: MetaType = {
  description: ``,
  changenote: ``,
  structTransformers: [
    transformDifficultyPrototypes,
    transformPlayerWeaponSettingsPrototypes,
    transformGeneralNPCObjPrototypes,
    transformAmmoPrototypes,
    transformBurer,
    transformMutantBase,
  ],
};

function transformDifficultyPrototypes(s: DifficultyPrototype) {
  const f = s.fork();
  f.Weapon_BaseDamage = 5;
  if (s.AllowedSaveTypes) {
    f.AllowedSaveTypes = s.AllowedSaveTypes.fork();
    f.AllowedSaveTypes.addNode("empty", "0");
    f.AllowedSaveTypes.__internal__.useAsterisk = false;
  }
  return f;
}

transformDifficultyPrototypes.files = ["/DifficultyPrototypes.cfg"];

function transformPlayerWeaponSettingsPrototypes() {}

transformPlayerWeaponSettingsPrototypes.files = ["/PlayerWeaponSettingsPrototypes.cfg"];

function transformGeneralNPCObjPrototypes(s: GeneralNPCObjPrototype) {
  const f = s.fork();
  f.ArmorDifferenceCoefProjectiles = 1.23;
  f.ArmorDifferenceCoefMeleeAttacks = 2.34;
  return f;

}

transformGeneralNPCObjPrototypes.files = ["/GeneralNPCObjPrototypes.cfg"];

function transformAmmoPrototypes(s: AmmoPrototype) {
  const f = s.fork();
  f.Cost = 666.0;
  f.ArmorPiercingMod = 6.0;
  f.CoverPiercingMod = 5.0;
  f.DamageMod = 7.0;
  return f;
}

transformAmmoPrototypes.files = ["/AmmoPrototypes.cfg"];

function transformBurer() {}

transformBurer.files = ["/Burer.cfg"];

function transformMutantBase() {}

transformMutantBase.files = ["/MutantBase.cfg"];
