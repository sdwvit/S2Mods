import { MetaType } from "../../src/meta-type.mts";
import { AttachPrototype, EffectPrototype, ItemGeneratorPrototype, MeshPrototype, Struct, WeaponGeneralSetupPrototype } from "s2cfgtojson";
import { allCompatibleAttachmentDefs } from "../MasterMod/basicAttachments.mts";
import { xNCompatibleScopeByWeapon } from "./xNCompatibleScopeByWeapon.mts";

export const meta: MetaType = {
  description: `
Adds 2 new X16 Scopes for Gvyntar / Lavina / Merc / Trophy / SVDM / Lynx / SVU3 / Whip / G37 / G37V2 / Kharod / Dnipro / Sotnyk / AR416 / Sharpshooter / Unknown AR416 / SOFMOD.
[hr][/hr]
You can buy these new scopes from T4 attachment traders like the one on Yaniv.
[hr][/hr]
Unfortunately, I don't know how to do animations. You have to attach the scopes in your inventory while NOT holding a hand.[h2][/h2]
bPatches AttachPrototypes, MeshPrototypes, DynamicItemGenerator, QuestItemGeneratorPrototypes, and WeaponGeneralSetupPrototypes.
`,
  changenote: "Fix G37V2 rail requirements, fix skeleton mesh for Dnipro / Lavina",
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

function transformTrade(struct: ItemGeneratorPrototype) {
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

export const x16CompatibleAttachmentDefs: Record<string, Struct> = {
  UA_X16Scope_1: new Struct({
    AttachPrototypeSID: "UA_X16Scope_1",
    Socket: "X16ScopeSocket",
    IconPosX: 60,
    IconPosY: 0,
    AimMuzzleVFXSocket: "X4ScopeMuzzle",
    AimShellShutterVFXSocket: "X4ScopeShells",
  }),

  EN_X16Scope_1: new Struct({
    AttachPrototypeSID: "EN_X16Scope_1",
    Socket: "X16ScopeSocket",
    IconPosX: 60,
    IconPosY: 0,
    AimMuzzleVFXSocket: "X4ScopeMuzzle",
    AimShellShutterVFXSocket: "X4ScopeShells",
  }),
};

const getCompatibleAttachmentDefinition = (sid: string) =>
  new Struct(allCompatibleAttachmentDefs[sid] || x16CompatibleAttachmentDefs[sid]) as WeaponGeneralSetupPrototype["CompatibleAttachments"]["0"];

export const getXnCompatibleScope = (struct: WeaponGeneralSetupPrototype, X: number) => {
  if (X !== 8 && X !== 16) {
    return;
  }

  const scope = xNCompatibleScopeByWeapon[struct.SID]?.[X];
  if (!scope) {
    return;
  }

  const attachmentSid = scope.family === "EN" ? `EN_X${X}Scope_1` : `${X === 8 ? "RU" : "UA"}_X${X}Scope_1`;
  const compatibleAttachment = getCompatibleAttachmentDefinition(attachmentSid);

  return Object.assign(compatibleAttachment, {
    ...(scope.AdditionalMeshes ? { AdditionalMeshes: scope.AdditionalMeshes } : {}),
    ...(scope.RequiredUpgradeIDs ? { RequiredUpgradeIDs: scope.RequiredUpgradeIDs } : {}),
    WeaponSpecificIcon: scope.WeaponSpecificIcon,
  });
};

/**
 * Adds X16 scopes compatibility to certain guns
 */
export function addX16ScopesToWeaponGeneralSetupPrototypes(struct: WeaponGeneralSetupPrototype) {
  if (!struct.CompatibleAttachments) {
    return;
  }

  const fork = struct.fork();
  const compX8 = getXnCompatibleScope(struct, 8);
  const compX16 = getXnCompatibleScope(struct, 16);

  if (compX8 || compX16) {
    fork.CompatibleAttachments = struct.CompatibleAttachments.fork();
    if (compX8) {
      fork.CompatibleAttachments.addNode(compX8, "X8");
    }
    if (compX16) {
      fork.CompatibleAttachments.addNode(compX16, "X16");
    }
  }

  if (struct.SID === "GunUDP_HG" || struct.SID === "GunUDP_Deadeye_HG" || struct.SID === "Gun_Krivenko_HG_GS") {
    fork.CompatibleAttachments ||= struct.CompatibleAttachments.fork();
    fork.CompatibleAttachments.addNode(
      Object.assign(getCompatibleAttachmentDefinition("EN_ColimScope_1"), {
        Socket: "ColimScopeSocket_corrected",
        WeaponSpecificIcon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/UDP/T_inv_w_en_colim_scope.T_inv_w_en_colim_scope'`,
      }),
      "EN_ColimScope_1",
    );
  }

  if (fork.CompatibleAttachments && !fork.CompatibleAttachments.entries().length) {
    delete fork.CompatibleAttachments;
  }

  if (fork.CompatibleAttachments) {
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
