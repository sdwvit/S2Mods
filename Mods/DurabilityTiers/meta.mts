import type { MetaContext, MetaType, StructTransformer } from "../../src/meta-type.mts";
import { Struct } from "s2cfgtojson";
import type { ArmorPrototype, UpgradePrototype, WeaponGeneralSetupPrototype } from "s2cfgtojson";
import { waitFor } from "../../src/wait-for.mts";

const EXTRA_TIERS = 3;
const COST_SCALE = 2;
const MAX_TIER1_COST = 10_000;
const MAX_COST = 100_000;

// Map from leaf durability upgrade SID to array of new tier SIDs
const tierMap = new Map<string, string[]>();

// All of a mod's transformers are dispatched concurrently, so the readers of `tierMap`
// (transformWeaponsAndArmors / transformTechnicians) must wait for `transformUpgrades`
// to finish populating it — otherwise every lookup misses and the mod silently emits
// nothing. Same barrier pattern as Mods/StashClueRework.
const finishedTransformers = new Set<string>();

async function awaitTierMap(): Promise<void> {
  await waitFor(() => finishedTransformers.has(transformUpgrades.name), 180000);
  if (!tierMap.size) {
    throw new Error(
      "DurabilityTiers: tierMap is empty after transformUpgrades finished — " +
        "no durability upgrades were found in UpgradePrototypes.cfg. Refusing to emit an empty patch set.",
    );
  }
}

function isDurabilityUpgrade(struct: UpgradePrototype): boolean {
  if (!struct.EffectPrototypeSIDs) return false;
  for (const [, value] of struct.EffectPrototypeSIDs.entries()) {
    if (typeof value === "string" && (value.includes("Durability") || value.includes("_wearing"))) {
      return true;
    }
  }
  return false;
}

function tierSID(baseSID: string, tier: number): string {
  return `${baseSID}_DT${tier}`;
}

let upgradesInitialized = false;

const transformUpgrades: StructTransformer<UpgradePrototype> = (struct, context) => {
  if (!upgradesInitialized) {
    upgradesInitialized = true;

    const durabilityUpgrades = new Set<string>();
    for (const s of context.array) {
      if (isDurabilityUpgrade(s)) {
        durabilityUpgrades.add(s.SID);
      }
    }

    // Find which durability upgrades are required by another durability upgrade
    const requiredByDurability = new Set<string>();
    for (const s of context.array) {
      if (!durabilityUpgrades.has(s.SID)) continue;
      const req = s.RequiredUpgradePrototypeSIDs;
      if (!req) continue;
      for (const [, reqSID] of req.entries()) {
        if (typeof reqSID === "string" && durabilityUpgrades.has(reqSID)) {
          requiredByDurability.add(reqSID);
        }
      }
    }

    // Leaves: durability upgrades not required by any other durability upgrade
    for (const sid of durabilityUpgrades) {
      if (!requiredByDurability.has(sid)) {
        const tiers: string[] = [];
        for (let i = 2; i <= EXTRA_TIERS + 1; i++) {
          tiers.push(tierSID(sid, i));
        }
        tierMap.set(sid, tiers);
      }
    }
  }

  if (!tierMap.has(struct.SID)) return null;

  const tiers = tierMap.get(struct.SID)!;
  const baseCost = struct.BaseCost as number;
  const vPos = (struct.VerticalPosition as string) ?? "EUpgradeVerticalPosition::Down";

  let connectionLine: string;
  if (vPos.includes("Top")) {
    connectionLine = "EConnectionLineState::Down";
  } else {
    connectionLine = "EConnectionLineState::Top";
  }

  const result: Struct[] = [];
  for (let i = 0; i < tiers.length; i++) {
    const tierNum = i + 2;
    const prevSID = i === 0 ? struct.SID : tiers[i - 1];

    const newUpgrade = struct.fork(true) as UpgradePrototype;
    newUpgrade.__internal__.isRoot = true;
    newUpgrade.__internal__.rawName = tiers[i];
    newUpgrade.__internal__.refkey = struct.SID;
    delete newUpgrade.__internal__.refurl;
    (newUpgrade as any).SID = tiers[i];
    const rawCost = Math.round(baseCost * Math.pow(COST_SCALE, tierNum - 1));
    const cap = tierNum === 2 ? MAX_TIER1_COST : MAX_COST;
    (newUpgrade as any).BaseCost = Math.min(rawCost, cap);
    (newUpgrade as any).HorizontalPosition = i + 1;
    (newUpgrade as any).RequiredUpgradePrototypeSIDs = new Struct({ 0: prevSID });
    (newUpgrade as any).ConnectionLines = new Struct({ 0: connectionLine });

    // Remove blocking/interchangeable since all tiers should be purchasable
    delete (newUpgrade as any).BlockingUpgradePrototypeSIDs;
    delete (newUpgrade as any).InterchangeableUpgradePrototypeSIDs;
    delete (newUpgrade as any).ID;

    result.push(newUpgrade);
  }
  return result;
};
transformUpgrades.files = ["/UpgradePrototypes.cfg"];

const transformWeaponsAndArmors: StructTransformer<WeaponGeneralSetupPrototype | ArmorPrototype> = async (struct) => {
  if (!struct.UpgradePrototypeSIDs) return null;
  await awaitTierMap();

  const newSIDs: string[] = [];
  for (const [, sid] of struct.UpgradePrototypeSIDs.entries()) {
    if (typeof sid === "string" && tierMap.has(sid)) {
      newSIDs.push(...tierMap.get(sid)!);
    }
  }

  if (!newSIDs.length) return null;

  const fork = struct.fork();
  fork.UpgradePrototypeSIDs = struct.UpgradePrototypeSIDs.fork();
  for (const sid of newSIDs) {
    fork.UpgradePrototypeSIDs.addNode(sid, sid);
  }
  return fork;
};
transformWeaponsAndArmors.files = [
  "/WeaponGeneralSetupPrototypes.cfg",
  "/ArmorPrototypes.cfg",
];

// All new tier SIDs flattened, populated after transformUpgrades runs
let allNewTierSIDs: string[] = [];

const transformTechnicians: StructTransformer<any> = async (struct, context) => {
  await awaitTierMap();
  if (!allNewTierSIDs.length) {
    allNewTierSIDs = [...tierMap.values()].flat();
  }

  const npcType =
    struct.NPCType ??
    context.structsById[struct.__internal__.refkey?.toString()]?.NPCType;
  if (npcType !== "ENPCType::Technician") return null;

  const fork = struct.fork();
  fork.Upgrades = struct.Upgrades?.fork() ?? new Struct();
  fork.Upgrades.__internal__.bpatch = true;
  for (const sid of allNewTierSIDs) {
    fork.Upgrades.addNode(
      new Struct({ UpgradePrototypeSID: sid, Enabled: true }),
      sid,
    );
  }
  return fork;
};
transformTechnicians.files = ["/NPCPrototypes.cfg"];

export const meta: MetaType<any> = {
  description: `
Adds 3 extra tiers for every durability upgrade on weapons and armors.
[hr][/hr]
Each tier has the same effect as the original, with cost scaling up 2x per tier (capped at 10k for tier 2, 100k overall).
[list]
 [*] Tier 2: 2x cost
 [*] Tier 3: 4x cost
 [*] Tier 4: 8x cost
[/list]
[hr][/hr]
bPatches:
[list]
 [*] UpgradePrototypes.cfg
 [*] WeaponGeneralSetupPrototypes.cfg
 [*] ArmorPrototypes.cfg
 [*] NPCPrototypes.cfg
[/list]

[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Updated for 2.0: patches regenerated against 2.0 game data. Price scaling changed to 2x per tier with caps (10k for tier 2, 100k overall).",
  structTransformers: [transformUpgrades, transformWeaponsAndArmors, transformTechnicians] as any,
  onTransformerFinish(transformer) {
    finishedTransformers.add(transformer.name);
  },
};
