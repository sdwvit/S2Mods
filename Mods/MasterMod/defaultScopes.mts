import { Struct } from "s2cfgtojson";
import {
  allDefaultDroppableAttachments,
  allDefaultWeaponPrototypesRecord,
  getCorePrototype,
  guessAttachmentSlot,
} from "../../src/consts.mts";
import { uniqueAttachmentsToAlternatives } from "./basicAttachments.mts";

/** How often a weapon that used to always come with a scope still spawns with one. */
export const DEFAULT_SCOPE_SPAWN_CHANCE = 0.1;

/**
 * WeaponGeneralSetupPrototype SID -> the scope that is no longer preinstalled on it.
 * Filled by transformWeaponGeneralSetupPrototypes, consumed by the item generator transformers.
 */
export const removedDefaultScopeByWeaponSetupSID: Record<string, string> = {};

const scopeSlots = new Set(["EAttachSlot::Scope", "EAttachSlot::PlankScope"]);

export function isScopeAttachment(attachSID: string) {
  try {
    return scopeSlots.has(guessAttachmentSlot(attachSID) as unknown as string);
  } catch {
    return false;
  }
}

/**
 * The generic replacement this mod already maps a unique scope to. Only those are droppable
 * (they have an icon and a cost), so only those can be handed out by an item generator.
 */
export function getDroppableScopeAlternative(attachSID: string) {
  const alternative = uniqueAttachmentsToAlternatives[attachSID] || attachSID;
  if (!isScopeAttachment(alternative) || !allDefaultDroppableAttachments.has(alternative)) {
    return;
  }
  return alternative;
}

/** Weapon item SID -> the scope that its general setup no longer preinstalls. */
export function getRemovedDefaultScopeForWeaponItem(itemPrototypeSID: string) {
  if (!allDefaultWeaponPrototypesRecord[itemPrototypeSID]) {
    return;
  }
  const core = getCorePrototype(
    itemPrototypeSID,
    allDefaultWeaponPrototypesRecord,
    (w) => w.GeneralWeaponSetup,
  );
  return core && removedDefaultScopeByWeaponSetupSID[core.GeneralWeaponSetup as string];
}

/**
 * The vanilla ItemGenerator "Attaches" sub-struct: rolls the scope onto the generated weapon
 * with DEFAULT_SCOPE_SPAWN_CHANCE instead of it always being there.
 */
export function makeScopeAttachesNode(scopeSID: string) {
  const node = new Struct({
    MinCount: 1,
    MaxCount: 1,
    Chance: DEFAULT_SCOPE_SPAWN_CHANCE,
    PossibleItems: scopeSID,
  });
  node.__internal__.bpatch = true;
  return node;
}

/** Adds the chance-based scope roll to a PossibleItems entry, if that item lost its scope. */
export function withScopeChance<T extends Struct>(possibleItem: T, fork: T) {
  const scope = getRemovedDefaultScopeForWeaponItem((possibleItem as any).ItemPrototypeSID);
  if (!scope) {
    return false;
  }
  fork.addNode(makeScopeAttachesNode(scope), "Attaches");
  return true;
}
