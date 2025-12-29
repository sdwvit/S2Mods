import { MetaType } from "../../src/meta-type.mts";
import { AttachPrototype, DynamicItemGenerator, EffectPrototype, MeshPrototype, Struct, WeaponGeneralSetupPrototype } from "s2cfgtojson";
import { allCompatibleAttachmentDefs } from "../MasterMod/basicAttachments.mts";

export const meta: MetaType = {
  description: `
Adds 2 new X16 Scopes for Gvyntar / Lavina / Merc / Trophy / SVDM / Lynx / SVU3 / Whip / G37 / G37V2 / Kharod / Dnipro / Sotnyk / AR416 / Sharpshooter / Unknown AR416 / SOFMOD.
[hr][/hr]
You can buy these new scopes from T4 attachment traders like the one on Yaniv.
[hr][/hr]
Unfortunately, I don't know how to do animations. You have to attach the scopes in your inventory while NOT holding a hand.[h2][/h2]
bPatches AttachPrototypes, MeshPrototypes, DynamicItemGenerator, QuestItemGeneratorPrototypes, and WeaponGeneralSetupPrototypes.
`,
  changenote: "Add X16Scope compatibility for AR416 variants, Merc / Trophy, G37V2",
  structTransformers: [
    addX16ScopesToWeaponGeneralSetupPrototypes,
    getX16AttachPrototypes,
    transformMeshPrototypes,
    transformTrade,
    transformEffectPrototypes,
  ],
};

let getX16AttachPrototypesOncePerFile = false;

/**
 * Adds two new attachments: EN_X16Scope_1 and UA_X16Scope_1.
 */
export function getX16AttachPrototypes() {
  if (getX16AttachPrototypesOncePerFile) {
    return null;
  }
  getX16AttachPrototypesOncePerFile = true;
  const extraStructs: AttachPrototype[] = [];
  const sharedEffects = new Struct({
    "0": "ScopeIdleSwayXModifierEffect",
    "1": "ScopeIdleSwayYModifierEffect",
    "2": "AimingFOVX16Effect",
    "3": "ScopeAimingTimeNeg20Effect",
    "4": "ScopeAimingMovementNeg10Effect",
    "5": "ScopeRecoilPos20Effect",
  }) as any;
  extraStructs.push(
    new Struct({
      __internal__: { rawName: "EN_X16Scope_1", isRoot: true, refurl: "../AttachPrototypes.cfg", refkey: "EN_X8Scope_1" },
      SID: "EN_X16Scope_1",
      LocalizationSID: "EN_X8Scope_1",
      Cost: 19000.0,
      Weight: 1.0,
      CanHoldBreath: true,
      EffectPrototypeSIDs: sharedEffects,
      MeshPrototypeSID: "EN_X16Scope_1",
      Icon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Attach/T_inv_icon_en_x16scope_1.T_inv_icon_en_x16scope_1'`,
    }) as AttachPrototype,
  );
  extraStructs.push(
    new Struct({
      __internal__: { rawName: "UA_X16Scope_1", isRoot: true, refurl: "../AttachPrototypes.cfg", refkey: "RU_X8Scope_1" },
      CanHoldBreath: true,
      SID: "UA_X16Scope_1",
      ItemGridWidth: 3,
      LocalizationSID: "RU_X8Scope_1",
      Cost: 15000.0,
      Weight: 1.1,
      EffectPrototypeSIDs: sharedEffects,
      MeshPrototypeSID: "UA_X16Scope_1",
      Icon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Attach/T_inv_icon_ua_x16scope.T_inv_icon_ua_x16scope'`,
    }) as AttachPrototype,
  );
  return extraStructs;
}

getX16AttachPrototypes.files = ["/AttachPrototypes.cfg"];

let transformMeshPrototypesOnce = false;

/**
 * Adds x16 scope mesh prototype.
 */
function transformMeshPrototypes() {
  if (transformMeshPrototypesOnce) {
    return null;
  }
  transformMeshPrototypesOnce = true;
  const extraStructs = [];
  extraStructs.push(
    new Struct({
      __internal__: { rawName: "EN_X16Scope_1", isRoot: true, refurl: "../MeshPrototypes.cfg", refkey: "[0]" },
      SID: "EN_X16Scope_1",
      MeshPath: "StaticMesh'/Game/_Stalker_2/weapons/attachments/ss/SM_ss01_en_x16scope_1/SM_ss01_en_x16scope_1.SM_ss01_en_x16scope_1'",
    }) as MeshPrototype,
  );
  extraStructs.push(
    new Struct({
      __internal__: { rawName: "UA_X16Scope_1", isRoot: true, refurl: "../MeshPrototypes.cfg", refkey: "[0]" },
      SID: "UA_X16Scope_1",
      MeshPath: "StaticMesh'/Game/_Stalker_2/weapons/attachments/ss/SM_ss01_ua_x16scope_1/SM_ua_x16scope.SM_ua_x16scope'",
    }) as MeshPrototype,
  );
  return extraStructs;
}

transformMeshPrototypes.files = ["/MeshPrototypes.cfg"];

function transformTrade(struct: DynamicItemGenerator) {
  if (!struct.SID.includes("Trade")) {
    return;
  }
  const fork = struct.fork();
  if (!struct.RefreshTime) {
    fork.RefreshTime = "1d";
  }
  const ItemGenerator = struct.ItemGenerator.map(([_k, e]) => {
    if (!(e.Category === "EItemGenerationCategory::Attach" && struct.SID === "Trader_Attachments_T4_ItemGenerator")) {
      return;
    }
    return Object.assign(e.fork(), {
      PossibleItems: Object.assign(e.PossibleItems.fork(), {
        EN_X16Scope_1: new Struct({ ItemPrototypeSID: "EN_X16Scope_1", Chance: 1, MinCount: 1, MaxCount: 1 }),
        UA_X16Scope_1: new Struct({ ItemPrototypeSID: "UA_X16Scope_1", Chance: 1, MinCount: 1, MaxCount: 1 }),
      }),
    });
  });
  if (!ItemGenerator.entries().length) {
    return;
  }
  ItemGenerator.__internal__.bpatch = true;
  ItemGenerator.__internal__.useAsterisk = false;
  return Object.assign(fork, { ItemGenerator });
}
transformTrade.files = ["/DynamicItemGenerator.cfg", "/QuestItemGeneratorPrototypes.cfg"];

const getCompatibleAttachmentDefinition = (sid: string) =>
  new Struct(allCompatibleAttachmentDefs[sid]) as WeaponGeneralSetupPrototype["CompatibleAttachments"]["0"];

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

export const getXnCompatibleScope = (struct: WeaponGeneralSetupPrototype, X: number) => {
  const enCompatibleAttachment = getCompatibleAttachmentDefinition(`EN_X${X}Scope_1`);
  const uaCompatibleAttachment = getCompatibleAttachmentDefinition(`${X === 8 ? "RU" : "UA"}_X${X}Scope_1`);

  switch (struct.SID) {
    case "GunG37V2_ST":
      return Object.assign(enCompatibleAttachment, {
        WeaponSpecificIcon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/GP37/T_inv_w_gp37_en_x${X}scope_1.T_inv_w_gp37_en_x${X}scope_1'`,
      });
    case "GunG37_ST":
      return Object.assign(enCompatibleAttachment, {
        WeaponSpecificIcon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/GP37/T_inv_w_gp37_en_x${X}scope_1.T_inv_w_gp37_en_x${X}scope_1'`,
        RequiredUpgradeIDs: new Struct({ 0: "GunG37_Upgrade_Attachment_Rail" }),
      });
    case "GunKharod_ST":
      return Object.assign(enCompatibleAttachment, {
        AdditionalMeshes: kharodDniproSharedAddMeshes,
        WeaponSpecificIcon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/Kharod/T_inv_w_kharod_en_x${X}scope_1.T_inv_w_kharod_en_x${X}scope_1'`,
      });
    case "GunDnipro_ST":
      return Object.assign(enCompatibleAttachment, {
        AdditionalMeshes: kharodDniproSharedAddMeshes,
        WeaponSpecificIcon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/Dnipro/T_inv_w_dnipro_en_x${X}scope_1.T_inv_w_dnipro_en_x${X}scope_1'`,
      });
    case "Gun_Sotnyk_AR_GS":
      return Object.assign(enCompatibleAttachment, {
        AdditionalMeshes: kharodDniproSharedAddMeshes,
        WeaponSpecificIcon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/Dnipro/T_inv_w_sotnyk_en_x${X}scope_1.T_inv_w_sotnyk_en_x${X}scope_1'`,
      });
    case "GunGvintar_ST":
    case "Gun_Merc_AR_GS":
    case "GunLavina_ST":
    case "Gun_Trophy_AR_GS":
      return Object.assign(uaCompatibleAttachment, {
        WeaponSpecificIcon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/Gvintar/T_inv_w_gvintar_ua_x${X}scope_1.T_inv_w_gvintar_ua_x${X}scope_1'`,
      });
    case "Gun_Whip_SR_GS":
      return Object.assign(uaCompatibleAttachment, {
        WeaponSpecificIcon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/SVU/T_inv_w_whip_ua_x${X}scope_1.T_inv_w_whip_ua_x${X}scope_1'`,
      });
    case "GunSVU_SP":
      return Object.assign(uaCompatibleAttachment, {
        WeaponSpecificIcon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/SVU/T_inv_w_svu_ua_x${X}scope_1.T_inv_w_svu_ua_x${X}scope_1'`,
      });
    case "Gun_Lynx_SR_GS":
      return Object.assign(uaCompatibleAttachment, {
        WeaponSpecificIcon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/SVDM/T_inv_w_lynx_ua_x${X}scope_1.T_inv_w_lynx_ua_x${X}scope_1'`,
      });
    case "GunSVDM_SP":
      return Object.assign(uaCompatibleAttachment, {
        WeaponSpecificIcon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/SVDM/T_inv_w_svdm_ua_x${X}scope_1.T_inv_w_svdm_ua_x${X}scope_1'`,
      });
    case "Gun_Sharpshooter_AR_GS":
    case "Gun_Unknown_AR_GS":
    case "GunM16_ST":
    case "Gun_SOFMOD_AR_GS":
      return Object.assign(enCompatibleAttachment, {
        WeaponSpecificIcon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/M16/T_inv_w_sharpshooter_en_x${X}scope_1.T_inv_w_sharpshooter_en_x${X}scope_1'`,
      });
  }
};
/**
 * Adds X16 scopes compatibility to certain guns
 */
export function addX16ScopesToWeaponGeneralSetupPrototypes(struct: WeaponGeneralSetupPrototype) {
  const fork = struct.fork();
  const comp = getXnCompatibleScope(struct, 16);
  if (comp) {
    fork.CompatibleAttachments = struct.CompatibleAttachments.fork();
    fork.CompatibleAttachments.addNode(comp, "X16");
    return fork;
  }
}
addX16ScopesToWeaponGeneralSetupPrototypes.files = ["/WeaponGeneralSetupPrototypes.cfg"];
let transformEffectPrototypesOnce = false;

function transformEffectPrototypes() {
  if (transformEffectPrototypesOnce) {
    return;
  }
  transformEffectPrototypesOnce = true;
  return new Struct({
    __internal__: { rawName: "AimingFOVX16Effect", isRoot: true },
    SID: "AimingFOVX16Effect",
    Type: "EEffectType::AimingFOV",
    ValueMin: "-85%",
    ValueMax: "-85%",
    bIsPermanent: true,
    Positive: "EBeneficial::Negative",
  }) as EffectPrototype;
}
transformEffectPrototypes.files = ["/EffectPrototypes.cfg"];
