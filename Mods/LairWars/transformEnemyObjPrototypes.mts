import type { ObjPrototype } from "s2cfgtojson";
import { BIG_MUTANT_PRESET } from "./transformNPCNeedsPresetPrototypes.mts";
import type { StructTransformer } from "../../src/meta-type.mts";
import { buildEnemyClone, enemyCloneFileSuffixes, enemyClonesByArchetype } from "./lairTiers.mts";

/**
 * Bayun and Pseudodog expand in packs: they move from MutantGenericNeedsNoExpansionPreset (the big loners, squads
 * of 1-3, transformNPCNeedsPresetPrototypes.mts) to MutantGenericNeedsPreset (squads of 2-4). The two vanilla
 * presets differ only in the Expansion need. Their variants and tier clones inherit it.
 */
const PACK_NEEDS_PRESET = "MutantGenericNeedsPreset";
/** Needs preset by ObjPrototype: Bayun and Pseudodog expand in packs, the big mutants 1-2 at a time. */
const NEEDS_PRESET: Record<string, string> = {
  Bayun: PACK_NEEDS_PRESET,
  PseudoDogBase: PACK_NEEDS_PRESET,
  Chimera: BIG_MUTANT_PRESET,
  Pseudogiant: BIG_MUTANT_PRESET,
  Deer: BIG_MUTANT_PRESET,
};

/**
 * Offline A-Life duels (OfflineCombatSatisfier) roll rand(0..OfflineCombatWeight) per side, and the
 * offline-combat-ttk exe patch ignores it. Vanilla weights run from 1 (rat swarm) to 100
 * (pseudogiant), so the strong species snowball across open lairs (sim/). Every unit gets almost the same
 * weight: OFFLINE_COMBAT_WEIGHT plus 1 (0.01%) per step up the vanilla order, so a duel is a near coin flip in
 * vanilla, while ties still go to the vanilla-stronger unit. The weight is an int32, so the base is 10000 to make
 * one step 0.01%. 0 (non-combat) stays.
 */
export const OFFLINE_COMBAT_WEIGHT = 10000;
/** Every distinct vanilla weight (GameLite ObjPrototypes), weakest first. */
const VANILLA_WEIGHTS = [1, 2, 4, 5, 8, 10, 18, 20, 25, 30, 40, 60, 75, 100];
/** The near-equal weight for a vanilla weight: the base plus its rank in the vanilla order. */
export const offlineCombatWeight = (vanilla: number) => OFFLINE_COMBAT_WEIGHT + VANILLA_WEIGHTS.filter((w) => w < vanilla).length;
/** Monolith fighters win slightly more vanilla offline fights: +1% weight over a plain human (NPCBase, 10). */
export const MONOLITH_WEIGHT_BONUS = 100;
const isMonolithArchetype = (rawName: string) => /^GeneralNPC_Monolith_/.test(rawName);
const weightFiles = [
  "/ObjPrototypes.cfg",
  ...[
    "GeneralNPCObjPrototypes",
    "MutantBase",
    "Tushkan",
    "Snork",
    "Cat",
    "PseudoDog",
    "Bloodsucker",
    "Burer",
    "Poltergeist",
    "Controller",
    "Deer",
    "Pseudogiant",
    "Chimera",
    "BlindDog",
    "Boar",
    "RatSwarm",
  ].map((name) => `/ObjPrototypes/${name}.cfg`),
];
const needsWeight = (struct: ObjPrototype) => {
  const w = Number(struct.OfflineCombatWeight);
  return struct.OfflineCombatWeight !== undefined && w > 0;
};

function patchObj(struct: ObjPrototype) {
  const preset = NEEDS_PRESET[struct.__internal__.rawName];
  const monolith = isMonolithArchetype(struct.__internal__.rawName);
  const weight = needsWeight(struct) || monolith;
  if (!preset && !weight) return null;
  const fork = struct.fork();
  fork.__internal__.bpatch = true;
  if (preset) fork.NeedsPresetSID = preset;
  if (weight) fork.OfflineCombatWeight = monolith ? offlineCombatWeight(10) + MONOLITH_WEIGHT_BONUS : offlineCombatWeight(Number(struct.OfflineCombatWeight));
  return fork;
}

/** Emits the tier lairs' enemies (`<Archetype>_LT<Rank>T<n>`, mutants `_LT<n>`) after their archetype. */
export const transformEnemyObjPrototypes: StructTransformer<ObjPrototype> = (struct) => {
  const rawName = struct.__internal__.rawName;
  const patch = patchObj(struct);
  const overrides = {
    ...(NEEDS_PRESET[rawName] ? { NeedsPresetSID: NEEDS_PRESET[rawName] } : {}),
    ...(isMonolithArchetype(rawName)
      ? { OfflineCombatWeight: offlineCombatWeight(10) + MONOLITH_WEIGHT_BONUS }
      : needsWeight(struct)
        ? { OfflineCombatWeight: offlineCombatWeight(Number(struct.OfflineCombatWeight)) }
        : {}),
  };
  const out = [
    ...(patch ? [patch] : []),
    // A clone that refkeys a struct bpatched above would inherit the bpatch block, so it copies the vanilla struct.
    ...(enemyClonesByArchetype[rawName]?.map((key) =>
      buildEnemyClone(key, patch ? overrides : undefined),
    ) ?? []),
  ];
  return out.length ? out : null;
};

transformEnemyObjPrototypes.files = [...new Set([...enemyCloneFileSuffixes, ...weightFiles])];
// No inheritDuplicates: the game doesn't resolve dotted sub-struct refkeys (`refkey=Bayun_LTNewbie.VitalParams`),
// so Bayun ranks above Newbie took headshots without losing HP.
transformEnemyObjPrototypes.splitNewStructs = true;
