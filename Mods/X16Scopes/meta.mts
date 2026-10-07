import type { MetaType } from "../../src/meta-type.mts";
import { Struct } from "s2cfgtojson";
import type {
  AttachPrototype,
  EffectPrototype,
  ItemGeneratorPrototype,
  MeshPrototype,
  QuestNodePrototypeSetItemGenerator,
  WeaponGeneralSetupPrototype,
} from "s2cfgtojson";
import { allCompatibleAttachmentDefs } from "../MasterMod/basicAttachments.mts";
import { xNCompatibleScopeByWeapon } from "./xNCompatibleScopeByWeapon.mts";
import { modName } from "../../src/base-paths.mts";
import { allDefaultWeaponPrototypesRecord } from "../../src/consts.mts";
import { writeX16ScopesLocalization } from "./writeLocalization.mts";

export const meta: MetaType = {
  description: `
Adds 2 new X16 Scopes for Gvyntar / Lavina / Merc / Trophy / SVDM / Lynx / SVU3 / Whip / G37 / G37V2 / Kharod / Dnipro / Sotnyk / AR416 / Sharpshooter / Unknown AR416 / SOFMOD.
[hr][/hr]
You can buy these new scopes from T4 attachment traders like the one on Yaniv.
[hr][/hr]
To get both X16 scopes, both X8 scopes and a curated list of 26 assault rifles, DMRs and sniper rifles in Skif's inventory, use the console command:
[u]XStartQuestNodeBySID Skif_X16Scopes[/u]
[hr][/hr]
Now with attach animations. Please be aware that animations are WIP and some are placeholders. 
bPatches AttachPrototypes, MeshPrototypes, DynamicItemGenerator, QuestItemGeneratorPrototypes, and WeaponGeneralSetupPrototypes.

[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: `Ported to 2.0. The X16 scopes now have their own names and descriptions in all languages, and their "Fits" list is now accurate. Added console command XStartQuestNodeBySID Skif_X16Scopes to get both X16 scopes, both X8 scopes and a set of compatible guns.`,
  structTransformers: [
    addX16ScopesToWeaponGeneralSetupPrototypes,
    getX16AttachPrototypes,
    transformMeshPrototypes,
    transformTrade,
    transformEffectPrototypes,
    transformItemGeneratorPrototypes,
    transformQuestNodePrototypes,
  ],
};

/**
 * The guns an X16 scope family actually fits, as item SIDs, for the "Fits:" line. Without this
 * the scopes inherit their X8 parent's list (Mark I EMR / SKP, or Gvintar only).
 * Unique guns' setups are named `<ItemSID>_GS`.
 */
const x16FittingWeaponSIDsOf = (family: "EN" | "UA") =>
  Object.entries(xNCompatibleScopeByWeapon)
    .filter(([, byLevel]) => byLevel[16]?.family === family)
    .map(([setupSID]) => setupSID.replace(/_GS$/, ""));

const x16FittingWeapons = (family: "EN" | "UA") =>
  new Struct(Object.fromEntries(x16FittingWeaponSIDsOf(family).map((sid, i) => [i, sid]))) as any;

let getX16AttachPrototypesOncePerFile = false;

/**
 * Adds two new attachments: EN_X16Scope_1 and UA_X16Scope_1.
 */
export function getX16AttachPrototypes() {
  if (getX16AttachPrototypesOncePerFile) {
    return null;
  }
  getX16AttachPrototypesOncePerFile = true;
  writeX16ScopesLocalization();
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
      Cost: 19000.0,
      Weight: 1.0,
      CanHoldBreath: true,
      EffectPrototypeSIDs: sharedEffects,
      MeshPrototypeSID: "EN_X16Scope_1",
      FittingWeaponsSIDs: x16FittingWeapons("EN"),
      Icon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Attach/T_inv_icon_en_x16scope_1.T_inv_icon_en_x16scope_1'`,
    }) as AttachPrototype,
  );
  extraStructs.push(
    new Struct({
      __internal__: { rawName: "UA_X16Scope_1", isRoot: true, refurl: "../AttachPrototypes.cfg", refkey: "RU_X8Scope_1" },
      CanHoldBreath: true,
      SID: "UA_X16Scope_1",
      ItemGridWidth: 3,
      Cost: 15000.0,
      Weight: 1.1,
      EffectPrototypeSIDs: sharedEffects,
      MeshPrototypeSID: "UA_X16Scope_1",
      FittingWeaponsSIDs: x16FittingWeapons("UA"),
      Icon: `Texture2D'/${modName}/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Attach/T_inv_icon_ua_x16scope.T_inv_icon_ua_x16scope'`,
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
      MeshPath: `StaticMesh'/${modName}/_Stalker_2/weapons/attachments/ss/SM_ss01_en_x16scope_1/SM_ss01_en_x16scope_1.SM_ss01_en_x16scope_1'`,
    }) as MeshPrototype,
  );
  extraStructs.push(
    new Struct({
      __internal__: { rawName: "UA_X16Scope_1", isRoot: true, refurl: "../MeshPrototypes.cfg", refkey: "[0]" },
      SID: "UA_X16Scope_1",
      MeshPath: `StaticMesh'/${modName}/_Stalker_2/weapons/attachments/ss/SM_ss01_ua_x16scope_1/SM_ua_x16scope.SM_ua_x16scope'`,
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
  let hasChanges = false;

  const compX8 = getXnCompatibleScope(struct, 8);
  if (compX8) {
    fork.CompatibleAttachments ||= struct.CompatibleAttachments.fork();
    fork.CompatibleAttachments.addNode(compX8, "X8");
    hasChanges = true;
  }

  const compX16 = getXnCompatibleScope(struct, 16);
  if (compX16) {
    fork.CompatibleAttachments ||= struct.CompatibleAttachments.fork();
    fork.CompatibleAttachments.addNode(compX16, "X16");
    hasChanges = true;
  }

  if (fork.CompatibleAttachments && !fork.CompatibleAttachments.entries().length) {
    delete fork.CompatibleAttachments;
  }

  if (hasChanges) {
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

const SKIF_QUEST_GUID = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const SKIF_ITEM_GENERATOR_SID = "ItemGen_Skif_X16Scopes";
const SKIF_QUEST_NODE_SID = "Skif_X16Scopes";

/** Upgrades a gun needs before its X8/X16 scope fits (GP37's top rail), preinstalled so the scopes can be tested right away. */
const requiredUpgradeIDsOf = (itemSID: string) => {
  const byLevel = xNCompatibleScopeByWeapon[itemSID] ?? xNCompatibleScopeByWeapon[`${itemSID}_GS`] ?? {};
  const ids = [byLevel[8], byLevel[16]].flatMap((scope) => scope?.RequiredUpgradeIDs?.entries().map(([, id]) => id as string) ?? []);
  return [...new Set(ids)];
};

/** Attaches an upgrade only unlocks; installed alongside it so the gun is ready for a scope (GP37's top rail). */
const attachesUnlockedByUpgrade: Record<string, string[]> = {
  GunG37_Upgrade_Attachment_Rail: ["RailPicatiniGP37"],
};

/** Exact weapon item SIDs granted by the Skif debug generator. */
const SKIF_ALLOWED_WEAPON_SIDS = [
  "GunM16_ST",
  "GunG37_ST",
  "GunGvintar_ST",
  "GunKharod_ST",
  "GunLavina_ST",
  "GunDnipro_ST",
  "GunArev_ST",
  "GunSKP_DMR",
  "GunMark_SP",
  "GunGP3A_DMR",
  "GunSVDM_SP",
  "GunM701_SP",
  "GunSVU_SP",
  "GunG37V2_ST",
  "GunArevPrecise_AR",
  "Gun_Merc_AR",
  "Gun_Sotnyk_AR",
  "Gun_Sharpshooter_AR",
  "Gun_Unknown_AR",
  "Gun_Trophy_AR",
  "Gun_SOFMOD_AR",
  "Gun_Lynx_SR",
  "Gun_Partner_SR",
  "Gun_Whip_SR",
  "Gun_Cavalier_SR",
  "GunSVU_Sniper_Duga_SP",
];

let transformItemGeneratorPrototypesOnce = false;

/**
 * Adds a generator holding both X16 scopes, both X8 scopes and one of each allowed assault
 * rifle, DMR and sniper rifle for the Skif debug quest node below.
 */
function transformItemGeneratorPrototypes() {
  if (transformItemGeneratorPrototypesOnce) {
    return;
  }
  transformItemGeneratorPrototypesOnce = true;
  const entry = (sid: string, category: string, durable: boolean) => {
    const upgrades = requiredUpgradeIDsOf(sid);
    const attaches = upgrades.flatMap((id) => attachesUnlockedByUpgrade[id] ?? []);
    return new Struct({
      Category: category,
      bAllowSameCategoryGeneration: true,
      PossibleItems: new Struct({
        [sid]: new Struct({
          ItemPrototypeSID: sid,
          Chance: 1,
          ...(durable ? { MinDurability: 1, MaxDurability: 1 } : {}),
          ...(upgrades.length
            ? { Upgrades: new Struct({ MinCount: upgrades.length, MaxCount: upgrades.length, Chance: 1, PossibleItems: upgrades.join(", ") }) }
            : {}),
          ...(attaches.length
            ? { Attaches: new Struct({ MinCount: attaches.length, MaxCount: attaches.length, Chance: 1, PossibleItems: attaches.join(", ") }) }
            : {}),
        }),
      }),
    });
  };
  const ItemGenerator = new Struct({}) as ItemGeneratorPrototype["ItemGenerator"];
  for (const sid of ["EN_X16Scope_1", "UA_X16Scope_1", "EN_X8Scope_1", "RU_X8Scope_1"]) {
    ItemGenerator.addNode(entry(sid, "EItemGenerationCategory::Attach", false), sid);
  }
  for (const sid of SKIF_ALLOWED_WEAPON_SIDS) {
    const weapon = allDefaultWeaponPrototypesRecord[sid];
    if (!weapon) {
      throw new Error(`Skif allowlisted weapon not found in WeaponPrototypes: ${sid}`);
    }
    ItemGenerator.addNode(entry(weapon.SID, "EItemGenerationCategory::WeaponPrimary", true), weapon.SID);
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
 * Use with console: XStartQuestNodeBySID Skif_X16Scopes
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
