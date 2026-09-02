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
  RequiredUpgradeIDs?: Struct;
};

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
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/Gvintar/T_inv_w_gvintar_ru_x8scope_1.T_inv_w_gvintar_ru_x8scope_1'`,
    },
    16: {
      family: "UA",
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/Gvintar/T_inv_w_gvintar_ua_x16scope_1.T_inv_w_gvintar_ua_x16scope_1'`,
    },
  },
  Gun_Merc_AR_GS: {
    8: {
      family: "UA",
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/Gvintar/T_inv_w_gvintar_ru_x8scope_1.T_inv_w_gvintar_ru_x8scope_1'`,
    },
    16: {
      family: "UA",
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/Gvintar/T_inv_w_gvintar_ua_x16scope_1.T_inv_w_gvintar_ua_x16scope_1'`,
    },
  },
  GunLavina_ST: {
    8: {
      family: "UA",
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/Gvintar/T_inv_w_gvintar_ru_x8scope_1.T_inv_w_gvintar_ru_x8scope_1'`,
    },
    16: {
      family: "UA",
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/Gvintar/T_inv_w_gvintar_ua_x16scope_1.T_inv_w_gvintar_ua_x16scope_1'`,
    },
  },
  Gun_Trophy_AR_GS: {
    8: {
      family: "UA",
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/Gvintar/T_inv_w_gvintar_ru_x8scope_1.T_inv_w_gvintar_ru_x8scope_1'`,
    },
    16: {
      family: "UA",
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/Gvintar/T_inv_w_gvintar_ua_x16scope_1.T_inv_w_gvintar_ua_x16scope_1'`,
    },
  },
  Gun_Whip_SR_GS: {
    8: {
      family: "UA",
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/SVU/T_inv_w_svu_ru_x8scope_1.T_inv_w_svu_ru_x8scope_1'`,
    },
    16: {
      family: "UA",
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/SVU/T_inv_w_svu_ua_x16scope_1.T_inv_w_svu_ua_x16scope_1'`,
    },
  },
  GunSVU_SP: {
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
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/SVDM/T_inv_w_lynx_ua_x16scope_1.T_inv_w_lynx_ua_x16scope_1'`,
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
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/M16/T_inv_w_sharpshooter_en_x8scope_1.T_inv_w_sharpshooter_en_x8scope_1'`,
    },
    16: {
      family: "EN",
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/M16/T_inv_w_sharpshooter_en_x16scope_1.T_inv_w_sharpshooter_en_x16scope_1'`,
    },
  },
  Gun_Unknown_AR_GS: {
    8: {
      family: "EN",
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/M16/T_inv_w_sharpshooter_en_x8scope_1.T_inv_w_sharpshooter_en_x8scope_1'`,
    },
    16: {
      family: "EN",
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/M16/T_inv_w_sharpshooter_en_x16scope_1.T_inv_w_sharpshooter_en_x16scope_1'`,
    },
  },
  GunM16_ST: {
    8: {
      family: "EN",
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/M16/T_inv_w_sharpshooter_en_x8scope_1.T_inv_w_sharpshooter_en_x8scope_1'`,
    },
    16: {
      family: "EN",
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/M16/T_inv_w_sharpshooter_en_x16scope_1.T_inv_w_sharpshooter_en_x16scope_1'`,
    },
  },
  Gun_SOFMOD_AR_GS: {
    8: {
      family: "EN",
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/M16/T_inv_w_sharpshooter_en_x8scope_1.T_inv_w_sharpshooter_en_x8scope_1'`,
    },
    16: {
      family: "EN",
      WeaponSpecificIcon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/M16/T_inv_w_sharpshooter_en_x16scope_1.T_inv_w_sharpshooter_en_x16scope_1'`,
    },
  },
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
 */
