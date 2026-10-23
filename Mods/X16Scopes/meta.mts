import type { MetaType } from "../../src/meta-type.mts";
import { Struct } from "s2cfgtojson";
import type {
  AttachPrototype,
  EffectPrototype,
  ItemGeneratorPrototype,
  MeshPrototype,
  QuestNodePrototypeSetItemGenerator,
  WeaponGeneralSetupPrototype,
  WeaponPrototype,
} from "s2cfgtojson";
import { allCompatibleAttachmentDefs, uniqueAttachmentsToAlternatives } from "../MasterMod/basicAttachments.mts";
import { xNCompatibleScopeByWeapon } from "./xNCompatibleScopeByWeapon.mts";
import { modName } from "../../src/base-paths.mts";
import { allDefaultWeaponGeneralSetupPrototypes, allDefaultWeaponPrototypesRecord, getCorePrototype } from "../../src/consts.mts";
import { makeScopeAttachesNode } from "../MasterMod/defaultScopes.mts";
import { writeX16ScopesLocalization } from "./writeLocalization.mts";

export const meta: MetaType = {
  description: `
Adds 2 new X16 scopes, and makes X8 and X16 scopes fit these guns:
[list]
 [*] Assault rifles: AKM-74S, Combatant, Drowned, AR416, Unknown Stalker's AR416, SOFMOD, Sharpshooter, GP37, GP37V2, Kharod, Dnipro, Sotnyk, ARev, Jagerblick, Fora-221, Decider, Grom S-14, Grom S-15, VS Vintar, Merc, AS Lavina, Trophy
 [*] Marksman rifles: SIC, GP3A, Mark I EMR, Partner
 [*] Sniper rifles: SVDM-2, Lynx, SVU-MK S-3, Whip, M701 Super, Cavalier
[/list]
[hr][/hr]
Built-in scopes are now regular scopes: guns that came with a fixed scope (M701 Super, Jagerblick, Sharpshooter, SVU-MK S-3, Whip, VS Vintar, Merc, SVDM-2, Lynx, GP37V2, Sotnyk and the red dots on SOFMOD, Partner, Cavalier and Trophy) now spawn with the matching regular scope only 10% of the time, the same way MasterMod handles the Vintar. Copies placed in the world or handed out by quests come without one. The scope can be detached, sold and swapped. The Sotnyk keeps its faster aiming. The M701 Super also takes a red dot. Guns you already own keep their old scope.
[hr][/hr]
You can buy the X16 scopes from T4 attachment traders like the one on Yaniv.
[hr][/hr]
To get both X16 scopes, both X8 scopes, the underbarrel launchers and a curated list of 33 assault rifles, DMRs and sniper rifles in Skif's inventory, use the console command:
[u]XStartQuestNodeBySID Skif_X16Scopes[/u]
[hr][/hr]
With attach animations. Some are placeholders, and the inventory icons of the newly supported guns are placeholders too.
bPatches AttachPrototypes, MeshPrototypes, EffectPrototypes, WeaponPrototypes, WeaponGeneralSetupPrototypes, DynamicItemGenerator, QuestItemGeneratorPrototypes, ItemGeneratorPrototypes and QuestNodePrototypes.

[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: `X8 and X16 support for 15 more guns, with their own inventory icons; guns with a built-in scope now only sometimes spawn with a regular scope you can detach, and the test console command also gives the underbarrel launchers.`,
  structTransformers: [
    addX16ScopesToWeaponGeneralSetupPrototypes,
    getX16AttachPrototypes,
    transformMeshPrototypes,
    transformTrade,
    transformEffectPrototypes,
    transformItemGeneratorPrototypes,
    transformQuestNodePrototypes,
    transformWeaponPrototypes,
  ],
};

/**
 * What a "Fits:" line shows for a weapon item: its base gun (unique guns inherit from one, e.g.
 * Partner from Mark I EMR), by the key its name is looked up with (`LocalizationSID`, e.g.
 * nwpack_GunArev_ST, or the SID), the way vanilla lists are written. Otherwise the UI prints raw
 * sid_items_*_name strings and lists every unique variant.
 */
function fitsKeyOf(itemSID: string) {
  let item = allDefaultWeaponPrototypesRecord[itemSID];
  while (item && allDefaultWeaponPrototypesRecord[item.__internal__.refkey]?.SID?.startsWith("Gun")) {
    item = allDefaultWeaponPrototypesRecord[item.__internal__.refkey];
  }
  return item && ((item.LocalizationSID as string) || item.SID);
}

/**
 * The guns an X16 scope family actually fits, for the "Fits:" line. Without this the scopes
 * inherit their X8 parent's list (Mark I EMR / SKP, or Gvintar only).
 * Unique guns' setups are named `<ItemSID>_GS`.
 */
const x16FittingWeaponSIDsOf = (family: "EN" | "UA") => [
  ...new Set(
    Object.entries(xNCompatibleScopeByWeapon)
      .filter(([, byLevel]) => byLevel[16]?.family === family)
      .map(([setupSID]) => fitsKeyOf(setupSID) ?? fitsKeyOf(setupSID.replace(/_GS$/, "")))
      .filter(Boolean),
  ),
];

const x16FittingWeapons = (family: "EN" | "UA") =>
  new Struct(Object.fromEntries(x16FittingWeaponSIDsOf(family).map((sid, i) => [i, sid]))) as any;

let getX16AttachPrototypesOncePerFile = false;

let addedFittingWeapons: Map<string, Set<string>>;

/**
 * "Fits:" keys (fitsKeyOf) of every gun this mod makes compatible with `attachSID`, other than the
 * X16s, whose list is built from the map. Found by running the
 * WeaponGeneralSetupPrototypes transformer over the vanilla setups.
 */
function addedFittingWeaponsOf(attachSID: string) {
  if (!addedFittingWeapons) {
    addedFittingWeapons = new Map();
    const itemOf = (setupSID: string) =>
      Object.values(allDefaultWeaponPrototypesRecord)
        .filter((w) => w.GeneralWeaponSetup === setupSID)
        .map((w) => w.SID)
        .sort((a, b) => a.length - b.length)[0];
    for (const setup of allDefaultWeaponGeneralSetupPrototypes) {
      const patch = addX16ScopesToWeaponGeneralSetupPrototypes(setup);
      const item = patch && fitsKeyOf(itemOf(setup.SID));
      patch?.CompatibleAttachments?.entries().forEach(([, e]) => {
        if (item && !/_X16Scope_1$/.test(e.AttachPrototypeSID)) {
          addedFittingWeapons.set(e.AttachPrototypeSID, (addedFittingWeapons.get(e.AttachPrototypeSID) ?? new Set()).add(item));
        }
      });
    }
  }
  return [...(addedFittingWeapons.get(attachSID) ?? [])];
}

/**
 * Adds two new attachments: EN_X16Scope_1 and UA_X16Scope_1, and extends the "Fits" lists of the
 * scopes this mod makes compatible with more guns. MasterMod calls it without a struct, for the
 * new attachments only.
 */
export function getX16AttachPrototypes(struct?: AttachPrototype) {
  const newFits = struct ? addedFittingWeaponsOf(struct.SID) : [];
  if (newFits.length && struct.FittingWeaponsSIDs) {
    const known = new Set(struct.FittingWeaponsSIDs.entries().map(([, sid]) => sid));
    const FittingWeaponsSIDs = struct.FittingWeaponsSIDs.fork();
    newFits.filter((sid) => !known.has(sid)).forEach((sid, i) => FittingWeaponsSIDs.addNode(sid, known.size + i));
    if (FittingWeaponsSIDs.entries().length) {
      return Object.assign(struct.fork(), { FittingWeaponsSIDs });
    }
  }
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

/**
 * Traders: the T4 attachment trader sells the X16 scopes. Every generator: guns that lost their
 * built-in scope roll it (withScopeRolls).
 */
function transformTrade(struct: ItemGeneratorPrototype) {
  const fork = struct.fork();
  const isTrade = struct.SID.includes("Trade");
  if (isTrade && !struct.RefreshTime) {
    fork.RefreshTime = "1d";
  }
  const ItemGenerator = isTrade
    ? struct.ItemGenerator.map(([_k, e]) => {
        if (!(e.Category === "EItemGenerationCategory::Attach" && struct.SID === "Trader_Attachments_T4_ItemGenerator")) {
          return;
        }
        return Object.assign(e.fork(), {
          PossibleItems: Object.assign(e.PossibleItems.fork(), {
            EN_X16Scope_1: new Struct({ ItemPrototypeSID: "EN_X16Scope_1", Chance: 1, MinCount: 1, MaxCount: 1 }),
            UA_X16Scope_1: new Struct({ ItemPrototypeSID: "UA_X16Scope_1", Chance: 1, MinCount: 1, MaxCount: 1 }),
          }),
        });
      })
    : struct.ItemGenerator?.fork();
  withScopeRolls(struct, ItemGenerator);
  if (!ItemGenerator?.entries().length) {
    return isTrade && fork.RefreshTime ? fork : undefined;
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

  const attachmentSid = xNScopeSID(scope.family, X);
  const template = templateEntryOf(struct, scope.template);
  let compatibleAttachment: WeaponGeneralSetupPrototype["CompatibleAttachments"]["0"];
  if (template) {
    // Mounted like the gun's own scope: same iron sight meshes, upgrades and aim VFX sockets.
    compatibleAttachment = template.clone();
    delete compatibleAttachment.BlockingUpgradeIDs;
    Object.assign(compatibleAttachment, { AttachPrototypeSID: attachmentSid, Socket: `X${X}ScopeSocket` });
  } else {
    compatibleAttachment = getCompatibleAttachmentDefinition(attachmentSid);
  }

  if (scope.RequiredUpgradeIDs === null) {
    delete compatibleAttachment.RequiredUpgradeIDs;
  }
  return Object.assign(compatibleAttachment, {
    ...(scope.AdditionalMeshes ? { AdditionalMeshes: scope.AdditionalMeshes } : {}),
    ...(scope.RequiredUpgradeIDs ? { RequiredUpgradeIDs: scope.RequiredUpgradeIDs } : {}),
    WeaponSpecificIcon: scope.WeaponSpecificIcon,
  });
};

const xNScopeSID = (family: "EN" | "UA", X: 8 | 16) => (family === "EN" ? `EN_X${X}Scope_1` : `${X === 8 ? "RU" : "UA"}_X${X}Scope_1`);

/**
 * The gun's CompatibleAttachments entry for `attachSID`, which a new scope copies its mounting from:
 * its own, else the nearest parent setup's (unique guns that replaced the parent's scope slot).
 */
const templateEntryOf = (struct: WeaponGeneralSetupPrototype, attachSID?: string) => {
  if (!attachSID) {
    return;
  }
  for (let setup = struct; setup; setup = allDefaultWeaponGeneralSetupPrototypes.find((s) => s.SID === setup.__internal__.refkey)) {
    const entry = setup.CompatibleAttachments?.entries().find(([, e]) => e.AttachPrototypeSID === attachSID)?.[1];
    if (entry) {
      return entry;
    }
  }
  throw new Error(`${struct.SID} and its parents have no CompatibleAttachments entry for template ${attachSID}`);
};

/**
 * Built-ins MasterMod's table leaves out, because they differ from their generic scope; their effect
 * moves onto the gun (gunEffects). Socket: the Sotnyk shares the Dnipro's skeleton and AnimCollection,
 * whose `RU_X2Scope_1` camera socket and attach animation are made for the Dnipro's X2 mount, so its X2
 * goes there too (on its own SotnykColimScopeSocket the aim and the attach animation were off). That
 * rules out keeping its own scope mesh: GunSotnyk_Scope's pivot is made for SotnykColimScopeSocket and
 * floats well above X2ScopeSocket, so the Sotnyk shows a plain X2 (2026-10-23).
 */
const builtInScopeLooks: Record<string, { alternative: string; MeshPrototypeSID?: string; Socket?: string; WeaponSpecificIcon?: string }> = {
  Gun_Sotnyk_ColimScope: {
    alternative: "RU_X2Scope_1",
    Socket: "X2ScopeSocket",
    // The Dnipro's own X2 overlay: same mount, same scope.
    WeaponSpecificIcon: `Texture2D'/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments/Dnipro/T_inv_w_dnipro_ru_x2scope_1.T_inv_w_dnipro_ru_x2scope_1'`,
  },
};

/** Effects a built-in scope gave, now on the gun so they stay whichever scope is mounted. Weapon item SID -> effects. */
const gunEffects: Record<string, string[]> = {
  Gun_Sotnyk_AR: ["ScopeAimingTimePos10Effect"],
};

/**
 * Adds the effects of gunEffects to their weapons.
 */
function transformWeaponPrototypes(struct: WeaponPrototype) {
  const effects = gunEffects[struct.SID];
  if (!effects) {
    return;
  }
  const EffectPrototypeSIDs = new Struct(Object.fromEntries(effects.map((sid, i) => [i, sid]))) as any;
  Object.assign(EffectPrototypeSIDs.__internal__, { isArray: true, useAsterisk: true, bpatch: true });
  return Object.assign(struct.fork(), { EffectPrototypeSIDs });
}
transformWeaponPrototypes.files = ["/WeaponPrototypes.cfg"];

/**
 * The generic scope a gun's built-in one maps to (MasterMod's table, then builtInScopeLooks), e.g. M701_Scope -> EN_X8Scope_1.
 * Grim's carry handle is not a scope.
 */
const detachableAlternativeOf = (attachSID: string) => {
  const alternative = uniqueAttachmentsToAlternatives[attachSID] ?? builtInScopeLooks[attachSID]?.alternative;
  return /Scope_\d$/.test(alternative ?? "") ? alternative : undefined;
};

/** Setups of the guns this mod scopes or hands out for testing: their built-in scopes become detachable. */
const isDetachableScopeSetup = (setupSID: string) =>
  !!xNCompatibleScopeByWeapon[setupSID] ||
  SKIF_ALLOWED_WEAPON_SIDS.some((sid) => allDefaultWeaponPrototypesRecord[sid]?.GeneralWeaponSetup === setupSID);

/**
 * Like MasterMod's Gvintar: a supported or test-kit gun's hidden built-in scope is no longer preinstalled.
 * The item generators roll its generic alternative onto the gun instead (scopeRolls), at
 * DEFAULT_SCOPE_SPAWN_CHANCE; copies placed in the world or given by quests come bare. Unless the gun
 * already takes that generic scope, it fits on the built-in scope's mount (socket, icon, iron sights).
 *
 * The whole preinstalled list is re-emitted without bpatch, every other entry (built-in magazine,
 * silencer, muzzle) cloned as it was: a partial bpatch list replaced the shipped one in game and
 * left those guns without their integrated magazines and silencers (2026-10-22).
 */
function makeFixedScopesDetachable(fork: WeaponGeneralSetupPrototype, struct: WeaponGeneralSetupPrototype) {
  const byLevel = xNCompatibleScopeByWeapon[struct.SID] ?? {};
  const preinstalled = struct.PreinstalledAttachmentsItemPrototypeSIDs;
  if (!isDetachableScopeSetup(struct.SID) || !preinstalled) {
    return false;
  }
  const levelSIDs = ([8, 16] as const).filter((X) => byLevel[X]).map((X) => xNScopeSID(byLevel[X].family, X));
  const list = new Struct({}) as WeaponGeneralSetupPrototype["PreinstalledAttachmentsItemPrototypeSIDs"];
  Object.assign(list.__internal__, { isArray: true, bpatch: false, bskipref: preinstalled.__internal__.bskipref });
  let hasChanges = false;
  preinstalled.forEach(([_key, e]) => {
    const alternative = detachableAlternativeOf(e.AttachSID);
    if (!alternative) {
      list.addNode(e.clone(), list.entries().length);
      return;
    }
    hasChanges = true;

    const takesAlternative =
      levelSIDs.includes(alternative) || struct.CompatibleAttachments.entries().some(([, c]) => c.AttachPrototypeSID === alternative);
    const builtIn = struct.CompatibleAttachments.entries().find(([, c]) => c.AttachPrototypeSID === e.AttachSID)?.[1];
    if (!takesAlternative && builtIn) {
      fork.CompatibleAttachments ||= struct.CompatibleAttachments.fork();
      const look = builtInScopeLooks[e.AttachSID];
      fork.CompatibleAttachments.addNode(
        Object.assign(
          builtIn.clone(),
          { AttachPrototypeSID: alternative },
          look?.MeshPrototypeSID ? { MeshPrototypeSID: look.MeshPrototypeSID } : {},
          look?.Socket ? { Socket: look.Socket } : {},
          look?.WeaponSpecificIcon ? { WeaponSpecificIcon: look.WeaponSpecificIcon } : {},
        ),
        alternative,
      );
    }
  });
  if (hasChanges) {
    fork.PreinstalledAttachmentsItemPrototypeSIDs = list;
  }
  return hasChanges;
}

let scopeRollBySetup: Record<string, string>;

/** The generic scope an item generator rolls onto `itemSID` (a gun whose built-in scope was dropped), if any. */
function rolledScopeOf(itemSID: string) {
  scopeRollBySetup ??= Object.fromEntries(
    allDefaultWeaponGeneralSetupPrototypes
      .filter((setup) => isDetachableScopeSetup(setup.SID))
      .flatMap((setup) =>
        (setup.PreinstalledAttachmentsItemPrototypeSIDs?.entries() ?? [])
          .map(([, e]) => detachableAlternativeOf(e.AttachSID))
          .filter(Boolean)
          .map((alternative) => [setup.SID, alternative]),
      ),
  );
  const weapon = allDefaultWeaponPrototypesRecord[itemSID] && getCorePrototype(itemSID, allDefaultWeaponPrototypesRecord, (w) => w.GeneralWeaponSetup);
  return weapon ? scopeRollBySetup[weapon.GeneralWeaponSetup as string] : undefined;
}

/** A generator entry patched so the guns that lost their built-in scope roll it (makeScopeAttachesNode). */
function scopeRolls(e: ItemGeneratorPrototype["ItemGenerator"]["0"]) {
  const rolled = (e.PossibleItems?.entries?.() ?? []).filter(([, pi]) => pi?.ItemPrototypeSID && rolledScopeOf(pi.ItemPrototypeSID));
  if (!rolled.length) {
    return;
  }
  const PossibleItems = e.PossibleItems.fork();
  rolled.forEach(([key, pi]) => PossibleItems.addNode(Object.assign(pi.fork(), { Attaches: makeScopeAttachesNode(rolledScopeOf(pi.ItemPrototypeSID)) }), key));
  return Object.assign(e.fork(), { PossibleItems });
}

/** Patches a generator struct with scopeRolls for every entry that spawns such a gun. */
function withScopeRolls(struct: ItemGeneratorPrototype, ItemGenerator = struct.ItemGenerator?.fork()) {
  struct.ItemGenerator?.entries().forEach(([key, e]) => {
    const patched = scopeRolls(e);
    if (patched) {
      ItemGenerator.addNode(patched, key);
    }
  });
  return ItemGenerator;
}

/**
 * Other scopes a gun gets, copied from a sibling gun's entry for the same mount (setup + template)
 * under a generic SID. The M701 took only its built-in X8 in vanilla; Cavalier, on the same
 * skeleton, has the red dot.
 */
const extraCompatibleScopes: Record<string, { AttachPrototypeSID: string; setup: string; template: string }[]> = {
  GunM701_SP: [{ AttachPrototypeSID: "EN_ColimScope_1", setup: "Gun_Cavalier_SR_GS", template: "M701_Colim_Scope" }],
};

function addExtraCompatibleScopes(fork: WeaponGeneralSetupPrototype, struct: WeaponGeneralSetupPrototype) {
  const extras = extraCompatibleScopes[struct.SID] ?? [];
  extras.forEach(({ AttachPrototypeSID, setup, template }) => {
    const e = templateEntryOf(allDefaultWeaponGeneralSetupPrototypes.find((s) => s.SID === setup), template).clone();
    delete e.BlockingUpgradeIDs;
    fork.CompatibleAttachments ||= struct.CompatibleAttachments.fork();
    fork.CompatibleAttachments.addNode(Object.assign(e, { AttachPrototypeSID }), AttachPrototypeSID);
  });
  return extras.length > 0;
}

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

  if (addExtraCompatibleScopes(fork, struct)) {
    hasChanges = true;
  }

  if (makeFixedScopesDetachable(fork, struct)) {
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
  const setupSID = xNCompatibleScopeByWeapon[itemSID] ? itemSID : `${itemSID}_GS`;
  const byLevel = xNCompatibleScopeByWeapon[setupSID] ?? {};
  const setup = allDefaultWeaponGeneralSetupPrototypes.find((s) => s.SID === setupSID);
  const ids = [byLevel[8], byLevel[16]].flatMap((scope) => {
    const upgrades =
      scope?.RequiredUpgradeIDs === null
        ? undefined
        : (scope?.RequiredUpgradeIDs ?? (scope?.template && setup ? templateEntryOf(setup, scope.template)?.RequiredUpgradeIDs : undefined));
    return upgrades?.entries().map(([, id]) => id as string) ?? [];
  });
  return [...new Set(ids)];
};

/** Attaches an upgrade only unlocks; installed alongside it so the gun is ready for a scope (GP37's top rail). */
const attachesUnlockedByUpgrade: Record<string, string[]> = {
  GunG37_Upgrade_Attachment_Rail: ["RailPicatiniGP37"],
  GunMark_Upgrade_Attachment_Rail: ["TopRailMark"],
  GunSKP_Upgrade_Attachment_Rail: ["TopRailSKP"],
  GunGP3A_Upgrade_Attachment_Rail: ["TopRailGP3A"],
  GunGrim_Upgrade_Attachment_Rail: ["TopRailGrim"],
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
  "GunFora_ST",
  "Gun_Decider_AR",
  "GunGrim_ST",
  "Gun_S15_AR",
  "GunAK74_ST",
  "Gun_Combatant_AR",
  "Gun_Drowned_AR",
];

/** Underbarrel launchers, to test scope attaches with a launcher fitted (separate AnimCollections). */
const SKIF_LAUNCHER_SIDS = ["EN_GLaunch_1", "RU_GLaunch_1", "EN_BuckLaunch_1"];

let transformItemGeneratorPrototypesOnce = false;

/**
 * Adds a generator holding both X16 scopes, both X8 scopes, the underbarrel launchers and one of
 * each allowed assault rifle, DMR and sniper rifle for the Skif debug quest node below.
 */
function transformItemGeneratorPrototypes(struct: ItemGeneratorPrototype) {
  const ItemGenerator = withScopeRolls(struct);
  const rolls = ItemGenerator?.entries().length ? Object.assign(struct.fork(), { ItemGenerator }) : undefined;
  if (transformItemGeneratorPrototypesOnce) {
    return rolls;
  }
  transformItemGeneratorPrototypesOnce = true;
  return [rolls, skifItemGenerator()].filter(Boolean);
}
transformItemGeneratorPrototypes.files = [
  "/ItemGeneratorPrototypes.cfg",
  "/ItemGeneratorPrototypes/Gamepass_ItemGenerators.cfg",
  "/ItemGeneratorPrototypes/QuestStashBodyItemGeneratorPrototypes/SQ102_QuestStashBodyItemGenerator.cfg",
];

/** The Skif test generator. Guns that lost their built-in scope get it every time, so it can be tested. */
function skifItemGenerator() {
  const entry = (sid: string, category: string, durable: boolean) => {
    const upgrades = requiredUpgradeIDsOf(sid);
    const attaches = [...upgrades.flatMap((id) => attachesUnlockedByUpgrade[id] ?? []), rolledScopeOf(sid)].filter(Boolean);
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
  for (const sid of ["EN_X16Scope_1", "UA_X16Scope_1", "EN_X8Scope_1", "RU_X8Scope_1", ...SKIF_LAUNCHER_SIDS]) {
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
