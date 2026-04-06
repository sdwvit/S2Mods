import type { MetaContext, MetaType, StructTransformer } from "../../src/meta-type.mts";
import { Struct } from "s2cfgtojson";
import type { ArmorPrototype, UpgradePrototype, WeaponGeneralSetupPrototype } from "s2cfgtojson";

const EXTRA_TIERS = 3;
const COST_SCALE = 1.2;

// Map from leaf durability upgrade SID to array of new tier SIDs
const tierMap = new Map<string, string[]>();

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
  const baseHPos = (struct.HorizontalPosition as number) ?? 0;
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
    delete newUpgrade.__internal__.refkey;
    (newUpgrade as any).SID = tiers[i];
    (newUpgrade as any).BaseCost = Math.round(baseCost * Math.pow(COST_SCALE, tierNum - 1));
    (newUpgrade as any).HorizontalPosition = baseHPos + (i + 1);
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

const transformWeaponsAndArmors: StructTransformer<WeaponGeneralSetupPrototype | ArmorPrototype> = (struct) => {
  if (!struct.UpgradePrototypeSIDs) return null;

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

export const meta: MetaType<any> = {
  description: `
Adds 3 extra tiers for every durability upgrade on weapons and armors.
[hr][/hr]
Each tier has the same effect as the original, with cost scaling up 20% per tier.
[list]
 [*] Tier 2: 1.2x cost
 [*] Tier 3: 1.44x cost
 [*] Tier 4: ~1.73x cost
[/list]
[hr][/hr]
bPatches:
[list]
 [*] UpgradePrototypes.cfg
 [*] WeaponGeneralSetupPrototypes.cfg
 [*] ArmorPrototypes.cfg
[/list]
`,
  changenote: "Initial release",
  structTransformers: [transformUpgrades, transformWeaponsAndArmors] as any,
};
