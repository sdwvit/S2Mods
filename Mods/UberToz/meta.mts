import { MetaContext, MetaType } from "../../src/meta-type.mts";
import { AttachPrototype, Struct, UpgradePrototype, WeaponGeneralSetupPrototype } from "s2cfgtojson";

export const meta: MetaType<WeaponGeneralSetupPrototype> = {
  description: `
Adds various attachments to TOZ 
[hr][/hr]
 Makes Three Line Rifle scope detachable and compatible with TOZ. Base cost 9500, weight 0.6 kg.[h1][/h1]
 Makes soviet collimator scope compatible with TOZ[h1][/h1]
 Makes soviet x2 scope compatible with TOZ[h1][/h1]
 Makes AKU top rail compatible with TOZ. Installable at technicians as a mod. Base cost 1700.
[hr][/hr]
bPatches:
 [list]
  [*] WeaponGeneralSetupPrototypes.cfg
  [*] UpgradePrototypes.cfg
  [*] AttachPrototypes.cfg
  [*] NPCPrototypes.cfg
 [/list]
`,
  changenote: "Initial release",
  structTransformers: [structTransformer],
};

const tozRailUpgrade = new Struct({
  SID: "GunTOZ_Upgrade_Attachment_Attachment_Rail",
  Text: "sid_upgrades_GunTOZ_Upgrade_Stock_2_name", // todo when they release localization tools
  Hint: "sid_upgrades_GunTOZ_Upgrade_Stock_2_description", // todo when they release localization tools

  Image: `Texture2D'/Game/_STALKER2/SkeletalMeshes/weapons/shg/TOZ34/toz_top_rail_upgrade_icon.toz_top_rail_upgrade_icon'`,
  BaseCost: 1700,
  VerticalPosition: "EUpgradeVerticalPosition::Top",
  UpgradeTargetPart: "EUpgradeTargetPartType::Body",
  IsModification: true,
  AttachPrototypeSIDs: new Struct({ 0: "TopRailAKU" }),
}) as UpgradePrototype;
tozRailUpgrade.__internal__.isRoot = true;
tozRailUpgrade.__internal__.rawName = tozRailUpgrade.SID;

const EN_BuckLaunch_1 = new Struct({
  AttachPrototypeSID: `EN_BuckLaunch_1`,
  WeaponSpecificIcon: ``, // todo
  Socket: `BLSocketOffset`,
  IconPosX: 0,
  IconPosY: 0,
});

const RU_GLaunch_1 = new Struct({
  AttachPrototypeSID: `RU_GLaunch_1`,
  WeaponSpecificIcon: ``, // todo
  Socket: `GLaunchSocket`,
  IconPosX: 0,
  IconPosY: 0,
});

const GunThreeLine_Scope = new Struct({
  AttachPrototypeSID: "GunThreeLine_Scope",
  Socket: "X4ScopeSocket",
  IconPosX: 60,
  IconPosY: 0,
  AimMuzzleVFXSocket: "X4ScopeMuzzle",
  AimShellShutterVFXSocket: "X4ScopeShells",
  WeaponSpecificIcon: `Texture2D'/Game/_STALKER2/SkeletalMeshes/weapons/shg/TOZ34/toz_threeline_scope.toz_threeline_scope'`,
});

const RU_X2Scope_1 = new Struct({
  AttachPrototypeSID: "RU_X2Scope_1",
  Socket: "X2ScopeSocket",
  IconPosX: 155,
  IconPosY: 9,
  AimMuzzleVFXSocket: "X2ScopeMuzzle",
  AimShellShutterVFXSocket: "X2ScopeShells",
  RequiredUpgradeIDs: new Struct({ 0: tozRailUpgrade.SID }),
  WeaponSpecificIcon: `Texture2D'/Game/_STALKER2/SkeletalMeshes/weapons/shg/TOZ34/toz_x2_scope.toz_x2_scope'`,
});

const RU_ColimScope_1 = new Struct({
  AttachPrototypeSID: "RU_ColimScope_1",
  Socket: "ColimScopeSocket",
  IconPosX: 155,
  IconPosY: 9,
  AimMuzzleVFXSocket: "ColimScopeMuzzle",
  AimShellShutterVFXSocket: "X2ScopeShells",
  RequiredUpgradeIDs: new Struct({ 0: tozRailUpgrade.SID }),
  WeaponSpecificIcon: `Texture2D'/Game/_STALKER2/SkeletalMeshes/weapons/shg/TOZ34/toz_colim_scope.toz_colim_scope'`,
});

const TopRailAKU = new Struct({
  AttachPrototypeSID: `TopRailAKU`,
  Socket: `TopRailSocket`,
  IconPosX: 0,
  IconPosY: 0,
  RequiredUpgradeIDs: new Struct({ 0: tozRailUpgrade.SID }),
  WeaponSpecificIcon: `Texture2D'/Game/_STALKER2/SkeletalMeshes/weapons/shg/TOZ34/toz_top_rail.toz_top_rail'`,
});

const fittingAttachments = new Set([
  "GunThreeLine_Scope",
  "RU_X2Scope_1",
  "RU_ColimScope_1",
  // "EN_BuckLaunch_1",
  // "RU_GLaunch_1",
]);

function structTransformer(
  struct: WeaponGeneralSetupPrototype | UpgradePrototype | AttachPrototype,
  context: MetaContext<WeaponGeneralSetupPrototype | UpgradePrototype | AttachPrototype>,
) {
  if (context.filePath.endsWith("/UpgradePrototypes.cfg") && struct.SID === "GunD12_Upgrade_Attachment_Rail") {
    context.extraStructs.push(tozRailUpgrade);
  }

  if (context.filePath.endsWith("/WeaponGeneralSetupPrototypes.cfg")) {
    const structT = struct as WeaponGeneralSetupPrototype;
    if (structT.SID === "GunTOZ_SG") {
      const fork = structT.fork();
      fork.UpgradePrototypeSIDs = structT.UpgradePrototypeSIDs.fork();
      fork.UpgradePrototypeSIDs.addNode(tozRailUpgrade.SID, tozRailUpgrade.SID);
      fork.CompatibleAttachments = new Struct() as any;
      fork.CompatibleAttachments.__internal__.bpatch = true;
      fork.CompatibleAttachments.addNode(GunThreeLine_Scope, "GunThreeLine_Scope");
      fork.CompatibleAttachments.addNode(RU_X2Scope_1, "RU_X2Scope_1");
      fork.CompatibleAttachments.addNode(RU_ColimScope_1, "RU_ColimScope_1");
      fork.CompatibleAttachments.addNode(TopRailAKU, "TopRailAKU");
      // fork.CompatibleAttachments.addNode(EN_BuckLaunch_1, "EN_BuckLaunch_1");
      // fork.CompatibleAttachments.addNode(RU_GLaunch_1, "RU_GLaunch_1");
      return fork;
    }
    if (structT.SID === "GunThreeLine_SP_GS") {
      const fork = structT.fork();
      fork.PreinstalledAttachmentsItemPrototypeSIDs = structT.PreinstalledAttachmentsItemPrototypeSIDs.fork(true);
      fork.PreinstalledAttachmentsItemPrototypeSIDs["0"].bHiddenInInventory = false;
      return fork;
    }
  }
  if (context.filePath.endsWith("/AttachPrototypes.cfg")) {
    const structT = struct as AttachPrototype;
    const fork = structT.fork();
    if (struct.SID === "GunThreeLine_Scope") {
      fork.Icon = `Texture2D'/Game/_STALKER2/SkeletalMeshes/weapons/shg/TOZ34/threeline_scope_icon.threeline_scope_icon'`;
      fork.Cost = 9500.0;
      fork.Weight = 0.6;
    }
    if (fittingAttachments.has(struct.SID)) {
      fork.FittingWeaponsSIDs = structT.FittingWeaponsSIDs.fork();
      fork.FittingWeaponsSIDs.addNode("GunTOZ_SG", "GunTOZ_SG");
      return fork;
    }
  }

  if (context.filePath.endsWith("/NPCPrototypes.cfg")) {
    const structT = struct as any;
    const technicians = new Set(["Linza", "Konder", "emenyc_0", "garpia_0"]);
    if (technicians.has(structT.SID) || technicians.has(context.structsById[structT.SID]?.__internal__.refkey?.toString() ?? "")) {
      const fork = structT.fork();
      fork.Upgrades = structT.Upgrades?.fork() ?? new Struct();
      fork.Upgrades.__internal__.bpatch = true;
      fork.Upgrades.addNode(new Struct({ UpgradePrototypeSID: tozRailUpgrade.SID, Enabled: true }), tozRailUpgrade.SID);
      return fork;
    }
  }

  return null;
}

structTransformer.files = ["/WeaponGeneralSetupPrototypes.cfg", "/UpgradePrototypes.cfg", "/AttachPrototypes.cfg", "/NPCPrototypes.cfg"];
