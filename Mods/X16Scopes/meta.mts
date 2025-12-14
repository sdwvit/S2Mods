import { MetaContext, MetaType } from "../../src/metaType.mjs";
import {
  AttachPrototype,
  DynamicItemGenerator,
  EffectPrototype,
  MeshPrototype,
  Struct,
  WeaponGeneralSetupPrototype,
} from "s2cfgtojson";

export const meta: MetaType<Struct> = {
  description: `
 Adds 2 new X16 Scopes for Gvyntar / Lavina and G37.
[hr][/hr]
You can buy these new scopes from T4 attachment traders like the one on Yaniv.
[hr][/hr]
Unfortunately, I don't know how to do animations. You have to attach the scopes in your inventory while NOT holding a hand.[h2][/h2]
bPatches AttachPrototypes, MeshPrototypes, DynamicItemGenerator, QuestItemGeneratorPrototypes, and WeaponGeneralSetupPrototypes.
`,
  changenote: "Better logo",
  structTransformers: [structTransformer],
};

function structTransformer(struct: any, context: MetaContext<any>) {
  let r;
  if ((r = transformAttachPrototypes(struct, context))) return r;
  if ((r = transformMeshPrototypes(struct, context))) return r;
  if ((r = transformTrade(struct, context))) return r;
  if ((r = transformWeaponGeneralSetupPrototypes(struct, context))) return r;
  if ((r = transformEffectPrototypes(struct, context))) return r;
  return null;
}

structTransformer.files = [
  "AttachPrototypes.cfg",
  "MeshPrototypes.cfg",
  "DynamicItemGenerator.cfg",
  "QuestItemGeneratorPrototypes.cfg",
  "WeaponGeneralSetupPrototypes.cfg",
  "EffectPrototypes.cfg",
];

let transformAttachPrototypesOncePerFile = false;

/**
 * Adds two new attachments: EN_X16Scope_1 and UA_X16Scope_1.
 */
const transformAttachPrototypes = (_, context: MetaContext<AttachPrototype>) => {
  if (transformAttachPrototypesOncePerFile || !context.filePath.endsWith("/AttachPrototypes.cfg")) {
    return null;
  }
  transformAttachPrototypesOncePerFile = true;
  context.extraStructs.push(
    new Struct({
      __internal__: {
        rawName: "EN_X16Scope_1",
        isRoot: true,
        refurl: "../AttachPrototypes.cfg",
        refkey: "EN_X8Scope_1",
      },
      SID: "EN_X16Scope_1",
      LocalizationSID: "EN_X8Scope_1",
      Cost: 19000.0,
      Weight: 1.0,
      CanHoldBreath: true,
      EffectPrototypeSIDs: new Struct({
        "0": "ScopeIdleSwayXModifierEffect",
        "1": "ScopeIdleSwayYModifierEffect",
        "2": "AimingFOVX16Effect",
        "3": "ScopeAimingTimeNeg20Effect",
        "4": "ScopeAimingMovementNeg10Effect",
        "5": "ScopeRecoilPos20Effect",
      }) as any,
      MeshPrototypeSID: "EN_X16Scope_1",
      Icon: `Texture2D'/Game/_Stalker_2/weapons/attachments/ss/SM_ss01_en_x8scope_1/T_inv_icon_en_x16scope_1.T_inv_icon_en_x16scope_1'`,
    }) as AttachPrototype,
  );
  context.extraStructs.push(
    new Struct({
      __internal__: {
        rawName: "UA_X16Scope_1",
        isRoot: true,
        refurl: "../AttachPrototypes.cfg",
        refkey: "RU_X8Scope_1",
      },
      CanHoldBreath: true,
      SID: "UA_X16Scope_1",
      ItemGridWidth: 3,
      LocalizationSID: "RU_X8Scope_1",
      Cost: 15000.0,
      Weight: 1.1,
      EffectPrototypeSIDs: new Struct({
        "0": "ScopeIdleSwayXModifierEffect",
        "1": "ScopeIdleSwayYModifierEffect",
        "2": "AimingFOVX16Effect",
        "3": "ScopeAimingTimeNeg20Effect",
        "4": "ScopeAimingMovementNeg10Effect",
        "5": "ScopeRecoilPos20Effect",
      }) as any,
      MeshPrototypeSID: "UA_X16Scope_1",
      Icon: `Texture2D'/Game/_Stalker_2/weapons/attachments/ss/SM_ss01_ua_x16scope_1/T_inv_icon_ua_x16scope.T_inv_icon_ua_x16scope'`,
    }) as AttachPrototype,
  );
};

let transformMeshPrototypesOnce = false;

/**
 * Adds x16 scope mesh prototype.
 */
const transformMeshPrototypes = (_, c: MetaContext<MeshPrototype>) => {
  if (transformMeshPrototypesOnce || !c.filePath.endsWith("/MeshPrototypes.cfg")) {
    return null;
  }
  transformMeshPrototypesOnce = true;
  c.extraStructs.push(
    new Struct({
      __internal__: {
        rawName: "EN_X16Scope_1",
        isRoot: true,
        refurl: "../MeshPrototypes.cfg",
        refkey: "[0]",
      },
      SID: "EN_X16Scope_1",
      MeshPath:
        "StaticMesh'/Game/_Stalker_2/weapons/attachments/ss/SM_ss01_en_x8scope_1/SM_ss01_en_x16scope_1.SM_ss01_en_x16scope_1'",
    }) as MeshPrototype,
  );
  c.extraStructs.push(
    new Struct({
      __internal__: {
        rawName: "UA_X16Scope_1",
        isRoot: true,
        refurl: "../MeshPrototypes.cfg",
        refkey: "[0]",
      },
      SID: "UA_X16Scope_1",
      MeshPath:
        "StaticMesh'/Game/_Stalker_2/weapons/attachments/ss/SM_ss01_ua_x16scope_1/SM_ua_x16scope.SM_ua_x16scope'",
    }) as MeshPrototype,
  );
};

function transformTrade(struct: DynamicItemGenerator, context: MetaContext<any>) {
  const fp = context.filePath;
  if (!(fp.endsWith("/DynamicItemGenerator.cfg") || fp.endsWith("/QuestItemGeneratorPrototypes.cfg"))) {
    return;
  }
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
        EN_X16Scope_1: new Struct({ ItemPrototypeSID: "EN_X16Scope_1", Chance: 0.2, MinCount: 1, MaxCount: 1 }),
        UA_X16Scope_1: new Struct({ ItemPrototypeSID: "UA_X16Scope_1", Chance: 0.2, MinCount: 1, MaxCount: 1 }),
      }),
    });
  });
  if (!ItemGenerator.entries().length) {
    return;
  }
  ItemGenerator.__internal__.bpatch = true;
  return Object.assign(fork, { ItemGenerator });
}

const allCompatibleAttachmentDefs: Record<string, WeaponGeneralSetupPrototype["CompatibleAttachments"]["0"]> = {
  EN_X16Scope_1: new Struct({
    AttachPrototypeSID: "EN_X16Scope_1",
    Socket: "X16ScopeSocket",
    IconPosX: 60,
    IconPosY: 0,
    AimMuzzleVFXSocket: "X16ScopeMuzzle",
  }) as WeaponGeneralSetupPrototype["CompatibleAttachments"]["0"],

  UA_X16Scope_1: new Struct({
    AttachPrototypeSID: "UA_X16Scope_1",
    Socket: "X16ScopeSocket",
    IconPosX: 60,
    IconPosY: 0,
    AimMuzzleVFXSocket: "X16ScopeMuzzle",
    AimShellShutterVFXSocket: "X2ScopeShells",
  }) as WeaponGeneralSetupPrototype["CompatibleAttachments"]["0"],
};
const getCompatibleAttachmentDefinition = (sid: string) =>
  new Struct(allCompatibleAttachmentDefs[sid]) as WeaponGeneralSetupPrototype["CompatibleAttachments"]["0"];

/**
 * Adds X16 scopes compatibility to certain guns
 */
function transformWeaponGeneralSetupPrototypes(
  struct: WeaponGeneralSetupPrototype,
  context: MetaContext<WeaponGeneralSetupPrototype>,
) {
  if (!context.filePath.endsWith("/WeaponGeneralSetupPrototypes.cfg")) {
    return;
  }
  const fork = struct.fork();

  if (struct.SID === "GunG37_ST") {
    fork.CompatibleAttachments ??= struct.CompatibleAttachments.fork();

    fork.CompatibleAttachments.addNode(
      Object.assign(getCompatibleAttachmentDefinition("EN_X16Scope_1"), {
        WeaponSpecificIcon: `Texture2D'/Game/_Stalker_2/weapons/attachments/ss/SM_ss01_en_x8scope_1/T_inv_w_gp37_en_x16scope_1.T_inv_w_gp37_en_x16scope_1'`,
      }),
      "EN_X16Scope_1",
    );

    fork.CompatibleAttachments["EN_X16Scope_1"].RequiredUpgradeIDs = new Struct({
      0: "GunG37_Upgrade_Attachment_Rail",
    });
  }

  if (
    struct.SID === "GunGvintar_ST" ||
    struct.SID === "Gun_Merc_AR_GS" ||
    struct.SID === "GunLavina_ST" ||
    struct.SID === "Gun_Trophy_AR_GS"
  ) {
    fork.CompatibleAttachments ??= struct.CompatibleAttachments.fork();

    fork.CompatibleAttachments.addNode(
      Object.assign(getCompatibleAttachmentDefinition("UA_X16Scope_1"), {
        WeaponSpecificIcon:
          "Texture2D'/Game/_Stalker_2/weapons/attachments/ss/SM_ss01_ua_x16scope_1/T_inv_w_gvintar_ua_x16scope.T_inv_w_gvintar_ua_x16scope'",
      }),
      "UA_X16Scope_1",
    );
    fork.CompatibleAttachments["UA_X16Scope_1"].AimMuzzleVFXSocket = "X4ScopeMuzzle";
  }

  if (!fork.entries().length) {
    return;
  }

  return fork;
}
let transformEffectPrototypesOnce = false;

const transformEffectPrototypes = (_, context: MetaContext<EffectPrototype>) => {
  if (transformEffectPrototypesOnce || !context.filePath.endsWith("/EffectPrototypes.cfg")) {
    return null;
  }
  transformEffectPrototypesOnce = true;
  context.extraStructs.push(
    new Struct({
      __internal__: {
        rawName: "AimingFOVX16Effect",
        isRoot: true,
      },
      SID: "AimingFOVX16Effect",
      Type: "EEffectType::AimingFOV",
      ValueMin: "-85%",
      ValueMax: "-85%",
      bIsPermanent: true,
      Positive: "EBeneficial::Negative",
    }) as EffectPrototype,
  );
};
