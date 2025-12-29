import { Struct, WeaponGeneralSetupPrototype } from "s2cfgtojson";
import { allDefaultWeaponGeneralSetupPrototypes } from "../../src/consts.mts";

export const uniqueAttachmentsToAlternatives: Record<string, string> = {
  UDP_Deadeye_Colim: "EN_ColimScope_1",
  Gun_Silence_ColimScope: "RU_ColimScope_1",
  Gun_Sledgehummer_GoloScope: "EN_GoloScope_1",
  // Gun_Sotnyk_ColimScope: "RU_X2Scope_1", // has extra effects, so need to keep it separate and adjust all weapons to be compatible with it
  Sharpshooter_Silen: "EN_Silen_3",
  Gun_Silence_Silen: "RU_Silen_2",
  Sofmod_Silen: "EN_Silen_3",
  //GunDrowned_MagPaired: "GunAK_MagPaired", // removing crashes the game on existing save
  Gun_GStreet_MagIncreased: "GunM10_MagIncreased",
  // Gun_Shakh_MagIncreased: "GunViper_MagIncreased", // removing crashes the game on existing save
  GunPKP_Korshunov_MagLarge: "GunPKP_MagLarge",

  M701_Scope: "EN_X8Scope_1",
  M701_Colim_Scope: "EN_ColimScope_1",
  SVDM_Scope: "RU_X4Scope_1",
  Gvintar_Scope: "RU_X4Scope_1",
  SVU_Scope: "RU_X8Scope_1",
};

export const allCompatibleAttachmentDefsByWeaponGeneralSetupPrototypeSID: Record<
  string,
  Record<string, WeaponGeneralSetupPrototype["CompatibleAttachments"]["0"]>
> = {};

export const allCompatibleAttachmentDefs: Record<string, Struct> = {
  RU_X8Scope_1: new Struct({
    AttachPrototypeSID: "RU_X8Scope_1",
    Socket: "X8ScopeSocket",
    IconPosX: 60,
    IconPosY: 0,
    AimMuzzleVFXSocket: "X4ScopeMuzzle",
    AimShellShutterVFXSocket: "X4ScopeShells",
  }),

  EN_X8Scope_1: new Struct({
    AttachPrototypeSID: "EN_X8Scope_1",
    Socket: "X8ScopeSocket",
    IconPosX: 60,
    IconPosY: 0,
    AimMuzzleVFXSocket: "X4ScopeMuzzle",
    AimShellShutterVFXSocket: "X4ScopeShells",
  }),
};

allDefaultWeaponGeneralSetupPrototypes.forEach((struct: WeaponGeneralSetupPrototype) => {
  if (struct.CompatibleAttachments) {
    struct.CompatibleAttachments.forEach(([_k, e]) => {
      const newE = e.clone();
      delete newE.BlockingUpgradeIDs;
      delete newE.RequiredUpgradeIDs;

      allCompatibleAttachmentDefsByWeaponGeneralSetupPrototypeSID[struct.SID] ??= {};
      allCompatibleAttachmentDefsByWeaponGeneralSetupPrototypeSID[struct.SID][newE.AttachPrototypeSID] = newE;
      allCompatibleAttachmentDefs[newE.AttachPrototypeSID] = newE;
    });
  }
});
