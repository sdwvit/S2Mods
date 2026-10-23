import { Struct } from "s2cfgtojson";
import { modName } from "../../src/base-paths.mts";

const kharodDniproSharedAddMeshes = new Struct({
  __internal__: {
    isArray: true,
    useAsterisk: true,
  },
  0: new Struct({
    MeshPrototypeSID: "Ironsights_02_Front_Close",
    Socket: "IronSightFront",
  }),
});

type ScopeLevel = 8 | 16;
type ScopeAttachmentFamily = "EN" | "UA";
type ScopeCompatibilityDef = {
  family: ScopeAttachmentFamily;
  WeaponSpecificIcon: string;
  AdditionalMeshes?: Struct;
  /** null drops the template's requirement (a gun that ships with the rail but can't take its upgrade). */
  RequiredUpgradeIDs?: Struct | null;
  /**
   * AttachPrototypeSID of the gun's own vanilla CompatibleAttachments entry (its X4 or X8 scope) whose
   * AdditionalMeshes, RequiredUpgradeIDs and aim VFX sockets this scope reuses, unless set above.
   * Looked up on the parent setups too, for unique guns that replaced it.
   */
  template?: string;
};

const vanillaIcon = (folder: string, name: string) =>
  `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/${folder}/${name}.${name}'`;
/** Icons drawn for this mod (editor/icon_fit), imported next to the vanilla folder layout by editor/xn_import_icons.py. */
const modIcon = (folder: string, name: string) =>
  `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/${folder}/${name}.${name}'`;

/** Same family and template at both levels, one icon per level. */
const levels = (
  family: ScopeAttachmentFamily,
  x8Icon: string,
  x16Icon: string,
  template: string,
  extra: Partial<ScopeCompatibilityDef> = {},
) => ({
  8: { family, WeaponSpecificIcon: x8Icon, template, ...extra },
  16: { family, WeaponSpecificIcon: x16Icon, template, ...extra },
});

const g37RailRequiredUpgradeIDs = new Struct({ 0: "GunG37_Upgrade_Attachment_Rail" });

export const xNCompatibleScopeByWeapon: Record<
  string,
  Partial<Record<ScopeLevel, ScopeCompatibilityDef>>
> = {
  GunG37V2_ST: {
    8: {
      family: "EN",
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/GP37/T_inv_w_gp37_en_x8scope_1.T_inv_w_gp37_en_x8scope_1'`,
    },
    16: {
      family: "EN",
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/GP37/T_inv_w_gp37_en_x16scope_1.T_inv_w_gp37_en_x16scope_1'`,
    },
  },
  GunG37_ST: {
    8: {
      family: "EN",
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/GP37/T_inv_w_gp37_en_x8scope_1.T_inv_w_gp37_en_x8scope_1'`,
      RequiredUpgradeIDs: g37RailRequiredUpgradeIDs,
    },
    16: {
      family: "EN",
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/GP37/T_inv_w_gp37_en_x16scope_1.T_inv_w_gp37_en_x16scope_1'`,
      RequiredUpgradeIDs: g37RailRequiredUpgradeIDs,
    },
  },
  GunKharod_ST: {
    8: {
      family: "EN",
      AdditionalMeshes: kharodDniproSharedAddMeshes,
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/Kharod/T_inv_w_kharod_en_x8scope_1.T_inv_w_kharod_en_x8scope_1'`,
    },
    16: {
      family: "EN",
      AdditionalMeshes: kharodDniproSharedAddMeshes,
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/Kharod/T_inv_w_kharod_en_x16scope_1.T_inv_w_kharod_en_x16scope_1'`,
    },
  },
  GunDnipro_ST: {
    8: {
      family: "EN",
      AdditionalMeshes: kharodDniproSharedAddMeshes,
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/Dnipro/T_inv_w_dnipro_en_x8scope_1.T_inv_w_dnipro_en_x8scope_1'`,
    },
    16: {
      family: "EN",
      AdditionalMeshes: kharodDniproSharedAddMeshes,
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/Dnipro/T_inv_w_dnipro_en_x16scope_1.T_inv_w_dnipro_en_x16scope_1'`,
    },
  },
  Gun_Sotnyk_AR_GS: {
    8: {
      family: "EN",
      AdditionalMeshes: kharodDniproSharedAddMeshes,
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/Dnipro/T_inv_w_sotnyk_en_x8scope_1.T_inv_w_sotnyk_en_x8scope_1'`,
    },
    16: {
      family: "EN",
      AdditionalMeshes: kharodDniproSharedAddMeshes,
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/Dnipro/T_inv_w_sotnyk_en_x16scope_1.T_inv_w_sotnyk_en_x16scope_1'`,
    },
  },
  GunGvintar_ST: {
    8: {
      family: "UA",
      WeaponSpecificIcon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/Gvintar/T_inv_w_gvintar_ru_x8scope_1.T_inv_w_gvintar_ru_x8scope_1'`,
    },
    16: {
      family: "UA",
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/Gvintar/T_inv_w_gvintar_ua_x16scope_1.T_inv_w_gvintar_ua_x16scope_1'`,
    },
  },
  Gun_Merc_AR_GS: {
    8: {
      family: "UA",
      WeaponSpecificIcon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/Gvintar/T_inv_w_gvintar_ru_x8scope_1.T_inv_w_gvintar_ru_x8scope_1'`,
    },
    16: {
      family: "UA",
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/Gvintar/T_inv_w_gvintar_ua_x16scope_1.T_inv_w_gvintar_ua_x16scope_1'`,
    },
  },
  GunLavina_ST: {
    8: {
      family: "UA",
      WeaponSpecificIcon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/Gvintar/T_inv_w_gvintar_ru_x8scope_1.T_inv_w_gvintar_ru_x8scope_1'`,
    },
    16: {
      family: "UA",
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/Gvintar/T_inv_w_gvintar_ua_x16scope_1.T_inv_w_gvintar_ua_x16scope_1'`,
    },
  },
  Gun_Trophy_AR_GS: {
    8: {
      family: "UA",
      WeaponSpecificIcon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/Gvintar/T_inv_w_gvintar_ru_x8scope_1.T_inv_w_gvintar_ru_x8scope_1'`,
    },
    16: {
      family: "UA",
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/Gvintar/T_inv_w_gvintar_ua_x16scope_1.T_inv_w_gvintar_ua_x16scope_1'`,
    },
  },
  Gun_Whip_SR_GS: {
    8: {
      family: "UA",
      WeaponSpecificIcon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/SVU/T_inv_w_svu_ru_x8scope_1.T_inv_w_svu_ru_x8scope_1'`,
    },
    16: {
      family: "UA",
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/SVU/T_inv_w_svu_ua_x16scope_1.T_inv_w_svu_ua_x16scope_1'`,
    },
  },
  GunSVU_SP: {
    8: {
      family: "UA",
      WeaponSpecificIcon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/SVU/T_inv_w_svu_ru_x8scope_1.T_inv_w_svu_ru_x8scope_1'`,
    },
    16: {
      family: "UA",
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/SVU/T_inv_w_svu_ua_x16scope_1.T_inv_w_svu_ua_x16scope_1'`,
    },
  },
  Gun_Lynx_SR_GS: {
    8: {
      family: "UA",
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/SVDM/T_inv_w_svdm_ua_x8scope_1.T_inv_w_svdm_ua_x8scope_1'`,
    },
    16: {
      family: "UA",
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/SVDM/T_inv_w_svdm_ua_x16scope_1.T_inv_w_svdm_ua_x16scope_1'`,
    },
  },
  GunSVDM_SP: {
    8: {
      family: "UA",
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/SVDM/T_inv_w_svdm_ua_x8scope_1.T_inv_w_svdm_ua_x8scope_1'`,
    },
    16: {
      family: "UA",
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/SVDM/T_inv_w_svdm_ua_x16scope_1.T_inv_w_svdm_ua_x16scope_1'`,
    },
  },
  Gun_Sharpshooter_AR_GS: {
    8: {
      family: "EN",
      WeaponSpecificIcon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/M16/T_inv_w_sharpshooter_en_x8scope_1.T_inv_w_sharpshooter_en_x8scope_1'`,
    },
    16: {
      family: "EN",
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/M16/T_inv_w_sharpshooter_en_x16scope_1.T_inv_w_sharpshooter_en_x16scope_1'`,
    },
  },
  Gun_Unknown_AR_GS: {
    8: {
      family: "EN",
      WeaponSpecificIcon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/M16/T_inv_w_sharpshooter_en_x8scope_1.T_inv_w_sharpshooter_en_x8scope_1'`,
    },
    16: {
      family: "EN",
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/M16/T_inv_w_sharpshooter_en_x16scope_1.T_inv_w_sharpshooter_en_x16scope_1'`,
    },
  },
  GunM16_ST: {
    8: {
      family: "EN",
      WeaponSpecificIcon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/M16/T_inv_w_sharpshooter_en_x8scope_1.T_inv_w_sharpshooter_en_x8scope_1'`,
    },
    16: {
      family: "EN",
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/M16/T_inv_w_sharpshooter_en_x16scope_1.T_inv_w_sharpshooter_en_x16scope_1'`,
    },
  },
  Gun_SOFMOD_AR_GS: {
    8: {
      family: "EN",
      WeaponSpecificIcon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/M16/T_inv_w_sharpshooter_en_x8scope_1.T_inv_w_sharpshooter_en_x8scope_1'`,
    },
    16: {
      family: "EN",
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/M16/T_inv_w_sharpshooter_en_x16scope_1.T_inv_w_sharpshooter_en_x16scope_1'`,
    },
  },
  // Mark and SKP take EN_X8Scope_1 in vanilla.
  GunMark_SP: {
    16: { family: "EN", WeaponSpecificIcon: modIcon("Mark", "T_inv_w_mark_en_x16scope_1"), template: "EN_X8Scope_1" },
  },
  GunSKP_DMR_GS: {
    16: { family: "EN", WeaponSpecificIcon: modIcon("SKP", "T_inv_w_skp_en_x16scope_1"), template: "EN_X8Scope_1" },
  },
  GunGP3A_DMR_GS: levels("EN", modIcon("GP3A", "T_inv_w_gp3a_en_x8scope_1"), modIcon("GP3A", "T_inv_w_gp3a_en_x16scope_1"), "EN_X4Scope_1"),
  GunArev_ST_GS: levels("EN", vanillaIcon("Arev", "T_inv_w_arev_precise_x8scope"), modIcon("Arev", "T_inv_w_arev_en_x16scope_1"), "EN_X4Scope_1"),
  // M701 and Arev Precise ship with EN_X8Scope_1 in place of their hidden M701_Scope (makeFixedScopesDetachable in meta.mts).
  GunArevPrecise_AR_GS: levels("EN", vanillaIcon("Arev", "T_inv_w_arev_precise_x8scope"), modIcon("Arev", "T_inv_w_arev_en_x16scope_1"), "M701_Scope"),
  GunM701_SP: levels("EN", vanillaIcon("M701", "T_inv_w_m701_en_x8scope_1"), modIcon("M701", "T_inv_w_m701_en_x16scope_1"), "M701_Scope"),
  // Unique guns that redefine every parent slot, so they don't inherit the parent's X8/X16 entries.
  Gun_Cavalier_SR_GS: levels("EN", vanillaIcon("M701", "T_inv_w_m701_en_x8scope_1"), modIcon("M701", "T_inv_w_m701_en_x16scope_1"), "M701_Scope"),
  // Ships with Mark's top rail but can't take Mark's rail upgrade.
  Gun_Partner_SR_GS: levels("EN", vanillaIcon("Mark", "T_inv_w_mark_en_x8scope_1"), modIcon("Mark", "T_inv_w_mark_en_x16scope_1"), "EN_X8Scope_1", { RequiredUpgradeIDs: null }),
  GunFora_ST: levels("EN", modIcon("Fora", "T_inv_w_fora_en_x8scope_1"), modIcon("Fora", "T_inv_w_fora_en_x16scope_1"), "EN_X4Scope_1"),
  Gun_Decider_AR_GS: levels("EN", modIcon("Fora", "T_inv_w_fora_en_x8scope_1"), modIcon("Fora", "T_inv_w_fora_en_x16scope_1"), "EN_X4Scope_1"),
  GunGrim_ST: levels("EN", modIcon("Grim", "T_inv_w_grim_en_x8scope_1"), modIcon("Grim", "T_inv_w_grim_en_x16scope_1"), "EN_X4Scope_1"),
  Gun_S15_AR: levels("EN", modIcon("Grim", "T_inv_w_grim_en_x8scope_1"), modIcon("Grim", "T_inv_w_grim_en_x16scope_1"), "EN_X4Scope_1"),
  GunAK74_ST: levels("UA", modIcon("AK74", "T_inv_w_ak74_ru_x8scope_1"), modIcon("AK74", "T_inv_w_ak74_ua_x16scope_1"), "RU_X4Scope_1"),
  Gun_Combatant_AR_GS: levels("UA", modIcon("AK74", "T_inv_w_ak74_ru_x8scope_1"), modIcon("AK74", "T_inv_w_ak74_ua_x16scope_1"), "RU_X4Scope_1"),
  Gun_Drowned_AR_GS: levels("UA", modIcon("AK74", "T_inv_w_ak74_ru_x8scope_1"), modIcon("AK74", "T_inv_w_ak74_ua_x16scope_1"), "RU_X4Scope_1"),
};

/**
 XCreateItemInInventoryByID GunG37V2_ST 0 1 1
 XCreateItemInInventoryByID GunG37_ST 0 1 1
 XCreateItemInInventoryByID GunKharod_ST 0 1 1
 XCreateItemInInventoryByID GunDnipro_ST 0 1 1
 XCreateItemInInventoryByID Gun_Sotnyk_AR_GS 0 1 1
 XCreateItemInInventoryByID GunGvintar_ST 0 1 1
 XCreateItemInInventoryByID Gun_Merc_AR_GS 0 1 1
 XCreateItemInInventoryByID GunLavina_ST 0 1 1
 XCreateItemInInventoryByID Gun_Trophy_AR_GS 0 1 1
 XCreateItemInInventoryByID Gun_Whip_SR_GS 0 1 1
 XCreateItemInInventoryByID GunSVU_SP 0 1 1
 XCreateItemInInventoryByID Gun_Lynx_SR_GS 0 1 1
 XCreateItemInInventoryByID GunSVDM_SP 0 1 1
 XCreateItemInInventoryByID Gun_Sharpshooter_AR_GS 0 1 1
 XCreateItemInInventoryByID Gun_Unknown_AR_GS 0 1 1
 XCreateItemInInventoryByID GunM16_ST 0 1 1
 XCreateItemInInventoryByID Gun_SOFMOD_AR_GS 0 1 1
 XCreateItemInInventoryByID GunMark_SP 0 1 1
 XCreateItemInInventoryByID GunSKP_DMR 0 1 1
 XCreateItemInInventoryByID GunGP3A_DMR 0 1 1
 XCreateItemInInventoryByID GunArev_ST 0 1 1
 XCreateItemInInventoryByID GunArevPrecise_AR 0 1 1
 XCreateItemInInventoryByID GunM701_SP 0 1 1
 XCreateItemInInventoryByID GunFora_ST 0 1 1
 XCreateItemInInventoryByID Gun_Decider_AR 0 1 1
 XCreateItemInInventoryByID GunGrim_ST 0 1 1
 XCreateItemInInventoryByID Gun_S15_AR 0 1 1
 XCreateItemInInventoryByID GunAK74_ST 0 1 1
 XCreateItemInInventoryByID Gun_Combatant_AR 0 1 1
 XCreateItemInInventoryByID Gun_Drowned_AR 0 1 1
 XCreateItemInInventoryByID EN_GLaunch_1 0 1 1
 XCreateItemInInventoryByID RU_GLaunch_1 0 1 1
 XCreateItemInInventoryByID EN_BuckLaunch_1 0 1 1
 */
