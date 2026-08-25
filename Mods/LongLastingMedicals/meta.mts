import type { ConsumablePrototype, EEffectDisplayType, EffectPrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";

const interestingSIDs = new Set<string>([
  "BandageBleeding4",
  "MedkitBleeding2",
  "ArmyMedkitBleeding3",
  "EcoMedkitBleeding2",
  "EcoMedkitAntirad3",
  "Antirad4",
  // Health restore: prolonged from 1s to ~10s, same absolute value (heals slower).
  "MedkitHealing3",
  "ArmyMedkitHealing4",
  "EcoMedkitHealing4",
]);

// Each consumable displays its main effect (and only it), as a numeric value + time.
const mainEffectByConsumable: Record<string, string> = {
  Bandage: "BandageBleeding4",
  Medkit: "MedkitHealing3",
  ArmyMedkit: "ArmyMedkitHealing4",
  EcoMedkit: "EcoMedkitHealing4",
  AntiRad: "Antirad4",
};

function transformEffectPrototypes(struct: EffectPrototype) {
  if (!interestingSIDs.has(struct.SID)) {
    return null;
  }
  const fork = struct.fork();
  fork.Duration = struct.Duration * 10 + 1;
  return fork;
}

transformEffectPrototypes.files = ["/EffectPrototypes.cfg"];

function transformConsumables(struct: ConsumablePrototype) {
  const mainEffect = mainEffectByConsumable[struct.SID];
  if (!mainEffect || !struct.EffectsDisplayTypes) {
    return null;
  }
  const sids = struct.EffectPrototypeSIDs.entries().map(([, v]) => v as string);
  const mainIdx = sids.indexOf(mainEffect);
  if (mainIdx === -1) {
    return null;
  }
  const fork = struct.fork();

  // Move the main effect to the front so it is the headline, keeping the rest in order.
  const reorder = (arr: any) => {
    const vals = arr.entries().map(([, v]: any) => v);
    const ordered = [vals[mainIdx], ...vals.filter((_: any, i: number) => i !== mainIdx)];
    const clone = arr.clone();
    clone.entries().forEach(([key]: any, i: number) => {
      clone[key] = ordered[i];
    });
    return clone;
  };

  fork.EffectPrototypeSIDs = reorder(struct.EffectPrototypeSIDs);
  if (struct.ShouldShowEffects) {
    const show = reorder(struct.ShouldShowEffects);
    const [firstKey] = show.entries()[0];
    show[firstKey] = true; // ensure the main effect (now first) is shown
    fork.ShouldShowEffects = show;
  }

  // All effects show their numeric value + time.
  const display = struct.EffectsDisplayTypes.clone();
  display.entries().forEach(([key]) => {
    display[key] = "EEffectDisplayType::ValueAndTime";
  });
  fork.EffectsDisplayTypes = display;

  return fork;
}

transformConsumables.files = ["/ConsumablePrototypes.cfg"];

export const meta: MetaType<EffectPrototype | ConsumablePrototype> = {
  structTransformers: [transformEffectPrototypes, transformConsumables],
  description: `
[h1]Deprecated in 2.0[/h1]
[h1][/h1]
With the new game on the new Unreal Engine, mod structure changes — some mods are now part of the base game. Replacements will be released as separate mods.
[hr][/hr]
  [h3]Makes medkits, bandages & antirad last longer, with the same value (heals/antirad apply slower), and shows their main effect as a numeric value instead of bars.[/h3]
    [list]
  [*] ❤️ Medkit / Army Medkit / Scientist Medkit: Health restore duration increased from 1 second to ~10 seconds (same total healing)
  [*] 🩸 Bandage: Bleeding control duration increased from 2 seconds to 20 seconds
  [*] 🩸 Medkit: Bleeding control duration increased from 2 seconds to 20 seconds
  [*] 🩸 Army Medkit: Bleeding control duration increased from 2 seconds to 20 seconds
  [*] 🩸 Scientist Medkit: Bleeding control duration increased from 2 seconds to 20 seconds
  [*] ☢️ Scientist Medkit: Radiation reduction duration increased from 2 seconds to 20 seconds
  [*] ☢️ Antirad: Radiation reduction duration increased from 2 seconds to 20 seconds
  [*] 🔢 Each item shows its main effect as a numeric value + time (other effects unchanged)
  [/list]
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Initial release",
};
