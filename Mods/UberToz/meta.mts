import type { MetaContext, MetaType } from "../../src/meta-type.mts";
import { Struct } from "s2cfgtojson";
import { modName } from "../../src/base-paths.mts";
import { writeUberTozLocalization } from "./writeLocalization.mts";
import { slugEffects, slugUpgrades } from "./slugUpgrades.mts";
import { forkThreeLineScope, forkThreeLineSetupWithVisibleScope, THREE_LINE_SCOPE_SID } from "./threeLineScope.mts";
import type {
  AttachPrototype,
  ItemGeneratorPrototype,
  QuestNodePrototypeSetItemGenerator,
  UpgradePrototype,
  WeaponGeneralSetupPrototype,
} from "s2cfgtojson";

export const meta: MetaType<WeaponGeneralSetupPrototype> = {
  description: `
Turns the TOZ-34 into a scoped slug sniper.
[hr][/hr]
[h2]Attachments[/h2]
[list]
[*] Three-Line Rifle PU 3.5X scope: now a detachable item that fits the TOZ-34 and the Three-Line Rifle. Base cost 9500, weight 0.6 kg.
[*] PAO 2X scope and open collimator sight fit the TOZ-34 once the top rail is installed.
[*] Top rail: installable at technicians as a modification. Base cost 1700.
[/list]
All three scopes have attach animations. They are simple placeholders built on the TOZ's own animations.
[hr][/hr]
[h2]Slug sniper upgrades[/h2]
Three new technician upgrades bring the TOZ-34 close to the Three-Line Rifle with slugs:
[list]
[*] Extended Slug Barrels (after the slug choke): +80% effective range, longer damage drop-off, keeps far more damage at range. Base cost 3000.
[*] Rifled Barrel Liners (after the slug choke): faster and flatter slugs. Base cost 2500.
[*] Polished Action (after the lighter body): draws and holsters 30% faster. Base cost 1200.
[/list]
[hr][/hr]
To get a TOZ-34 with the top rail installed and all three scopes in Skif's inventory, use the console command:
[u]XStartQuestNodeBySID Skif_UberToz[/u]
[hr][/hr]
Known issue: during the reload animation a mounted scope can clip through the gun.
[hr][/hr]
bPatches WeaponGeneralSetupPrototypes, UpgradePrototypes, AttachPrototypes, NPCPrototypes, EffectPrototypes, ItemGeneratorPrototypes and A-life_interrupts quest nodes.

[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: `The PU 3.5X scope gets a real-world description.`,
  structTransformers: [structTransformer, transformEffectPrototypes, transformItemGeneratorPrototypes, transformQuestNodePrototypes],
};

const tozRailUpgrade = new Struct({
  SID: "GunTOZ_Upgrade_Attachment_Attachment_Rail",
  // vanilla "Scope Mount" text, shipped in every language
  Text: "sid_upgrades_GunAKU_Upgrade_Attachment_Rail_name",
  Hint: "sid_upgrades_GunAKU_Upgrade_Attachment_Rail_description",

  Image: `Texture2D'/${modName}/_STALKER2/SkeletalMeshes/weapons/shg/TOZ34/toz_top_rail_upgrade_icon.toz_top_rail_upgrade_icon'`,
  BaseCost: 1700,
  // Body Top 0 is vanilla GunTOZ_Upgrade_Body_1; the modification goes below it
  VerticalPosition: "EUpgradeVerticalPosition::Down",
  // vanilla upgrades inherit these from UpgradePrototypes.cfg's [0]; a new root struct must set them
  HorizontalPosition: 0,
  DiscountCoefficient: "0.f",
  RepairCostModifier: "0.2f",
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
  WeaponSpecificIcon: `Texture2D'/${modName}/_STALKER2/SkeletalMeshes/weapons/shg/TOZ34/toz_threeline_scope.toz_threeline_scope'`,
});

const RU_X2Scope_1 = new Struct({
  AttachPrototypeSID: "RU_X2Scope_1",
  Socket: "X2ScopeSocket",
  IconPosX: 155,
  IconPosY: 9,
  AimMuzzleVFXSocket: "X2ScopeMuzzle",
  AimShellShutterVFXSocket: "X2ScopeShells",
  RequiredUpgradeIDs: new Struct({ 0: tozRailUpgrade.SID }),
  WeaponSpecificIcon: `Texture2D'/${modName}/_STALKER2/SkeletalMeshes/weapons/shg/TOZ34/toz_x2_scope.toz_x2_scope'`,
});

const RU_ColimScope_1 = new Struct({
  AttachPrototypeSID: "RU_ColimScope_1",
  Socket: "ColimScopeSocket",
  IconPosX: 155,
  IconPosY: 9,
  AimMuzzleVFXSocket: "ColimScopeMuzzle",
  AimShellShutterVFXSocket: "X2ScopeShells",
  RequiredUpgradeIDs: new Struct({ 0: tozRailUpgrade.SID }),
  WeaponSpecificIcon: `Texture2D'/${modName}/_STALKER2/SkeletalMeshes/weapons/shg/TOZ34/toz_colim_scope.toz_colim_scope'`,
});

const TopRailAKU = new Struct({
  AttachPrototypeSID: `TopRailAKU`,
  Socket: `TopRailSocket`,
  IconPosX: 0,
  IconPosY: 0,
  RequiredUpgradeIDs: new Struct({ 0: tozRailUpgrade.SID }),
  WeaponSpecificIcon: `Texture2D'/${modName}/_STALKER2/SkeletalMeshes/weapons/shg/TOZ34/toz_top_rail.toz_top_rail'`,
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
    context.extraStructs.push(tozRailUpgrade, ...slugUpgrades);
  }

  if (context.filePath.endsWith("/WeaponGeneralSetupPrototypes.cfg")) {
    const structT = struct as WeaponGeneralSetupPrototype;
    if (structT.SID === "GunTOZ_SG") {
      const fork = structT.fork();
      fork.UpgradePrototypeSIDs = structT.UpgradePrototypeSIDs.fork();
      for (const { SID } of [tozRailUpgrade, ...slugUpgrades]) {
        fork.UpgradePrototypeSIDs.addNode(SID, SID);
      }
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
      return forkThreeLineSetupWithVisibleScope(structT);
    }
  }
  if (context.filePath.endsWith("/AttachPrototypes.cfg")) {
    const structT = struct as AttachPrototype;
    if (struct.SID === THREE_LINE_SCOPE_SID) {
      writeUberTozLocalization();
      const icon = `Texture2D'/${modName}/_STALKER2/SkeletalMeshes/weapons/shg/TOZ34/threeline_scope_icon.threeline_scope_icon'`;
      return forkThreeLineScope(structT, icon, ["GunTOZ_SG"]);
    }
    if (fittingAttachments.has(struct.SID)) {
      const fork = structT.fork();
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
      for (const { SID } of [tozRailUpgrade, ...slugUpgrades]) {
        fork.Upgrades.addNode(new Struct({ UpgradePrototypeSID: SID, Enabled: true }), SID);
      }
      return fork;
    }
  }

  return null;
}

structTransformer.files = [
  "/WeaponGeneralSetupPrototypes.cfg",
  "/UpgradePrototypes.cfg",
  "/AttachPrototypes.cfg",
  "/NPCPrototypes.cfg",
];

const SKIF_QUEST_GUID = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const SKIF_ITEM_GENERATOR_SID = "ItemGen_Skif_UberToz";
const SKIF_QUEST_NODE_SID = "Skif_UberToz";

let transformItemGeneratorPrototypesOnce = false;

/**
 * Adds a generator holding a TOZ with the top rail upgrade and rail installed, plus every scope
 * this mod makes compatible, for the Skif debug quest node below.
 */
function transformItemGeneratorPrototypes() {
  if (transformItemGeneratorPrototypesOnce) {
    return;
  }
  transformItemGeneratorPrototypesOnce = true;
  const ItemGenerator = new Struct({}) as ItemGeneratorPrototype["ItemGenerator"];
  ItemGenerator.addNode(
    new Struct({
      Category: "EItemGenerationCategory::WeaponPrimary",
      bAllowSameCategoryGeneration: true,
      PossibleItems: new Struct({
        GunTOZ_SG: new Struct({
          ItemPrototypeSID: "GunTOZ_SG",
          Chance: 1,
          MinDurability: 1,
          MaxDurability: 1,
          Upgrades: new Struct({
            MinCount: 1,
            MaxCount: 1,
            Chance: 1,
            PossibleItems: tozRailUpgrade.SID,
          }),
          Attaches: new Struct({
            MinCount: 1,
            MaxCount: 1,
            Chance: 1,
            PossibleItems: "TopRailAKU",
          }),
        }),
      }),
    }),
    "GunTOZ_SG",
  );
  for (const sid of fittingAttachments) {
    ItemGenerator.addNode(
      new Struct({
        Category: "EItemGenerationCategory::Attach",
        bAllowSameCategoryGeneration: true,
        PossibleItems: new Struct({ [sid]: new Struct({ ItemPrototypeSID: sid, Chance: 1 }) }),
      }),
      sid,
    );
  }
  return new Struct({
    __internal__: { rawName: SKIF_ITEM_GENERATOR_SID, isRoot: true },
    SID: SKIF_ITEM_GENERATOR_SID,
    ItemGenerator,
  }) as ItemGeneratorPrototype;
}
transformItemGeneratorPrototypes.files = ["/ItemGeneratorPrototypes.cfg"];

let transformQuestNodePrototypesOnce = false;

/**
 * Debug quest node that gives Skif everything from the generator above.
 * Use with console: XStartQuestNodeBySID Skif_UberToz
 */
function transformQuestNodePrototypes(struct: QuestNodePrototypeSetItemGenerator) {
  if (transformQuestNodePrototypesOnce) {
    return;
  }
  transformQuestNodePrototypesOnce = true;
  const node = new Struct() as QuestNodePrototypeSetItemGenerator;
  node.SID = SKIF_QUEST_NODE_SID;
  node.QuestSID = struct.QuestSID;
  node.NodeType = "EQuestNodeType::SetItemGenerator";
  node.TargetQuestGuid = SKIF_QUEST_GUID;
  node.ReplaceInventory = false;
  node.EquipItems = false;
  node.Repeatable = true;
  node.ItemGeneratorSID = SKIF_ITEM_GENERATOR_SID;
  node.__internal__.isRoot = true;
  node.__internal__.rawName = SKIF_QUEST_NODE_SID;
  return node;
}
transformQuestNodePrototypes.files = ["/QuestNodePrototypes/A-life_interrupts.cfg"];

let transformEffectPrototypesOnce = false;

/** Stat effects for the slug sniper upgrades in slugUpgrades.mts. */
function transformEffectPrototypes() {
  if (transformEffectPrototypesOnce) {
    return;
  }
  transformEffectPrototypesOnce = true;
  return slugEffects;
}
transformEffectPrototypes.files = ["/EffectPrototypes.cfg"];
