import type { ConsumablePrototype, EEffectDisplayType, EffectPrototype, QuestItemPrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";

const interestingSIDs = new Set<string>([
  "EnergeticStamina",
  "EnergeticLimitedStamina",
  "EnergeticSleepiness",
  "EnergeticStaminaPerAction1",
  "WaterStamina2",
  "WaterStaminaPerAction1",
  "BeerAntirad1",
  "VodkaAntirad3",
  "AnomalyVodkaRadiation",
  "MagicVodkaPSYProtection",
]);

// Each consumable displays its main effect (and only it), as a numeric value + time.
const mainEffectByConsumable: Record<string, string> = {
  Energetic: "EnergeticStamina",
  Energetic_Limited: "EnergeticLimitedStamina",
  Vodka: "VodkaAntirad3",
  Beer: "BeerAntirad1",
  Water: "WaterStamina2",
  DvupalovVodka: "MagicVodkaPSYProtection",
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

function transformConsumables(struct: ConsumablePrototype | QuestItemPrototype) {
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

transformConsumables.files = ["/ConsumablePrototypes.cfg", "/QuestItemPrototypes.cfg"];

export const meta: MetaType<EffectPrototype | ConsumablePrototype | QuestItemPrototype> = {
  structTransformers: [transformEffectPrototypes, transformConsumables],
  description: `
[h1]Deprecated in 2.0[/h1]
  [h3]Makes food & drink consumables last longer, with the same value (antirad remove radiation slowly), and shows their effects as numeric values instead of bars.[/h3]
    [list]
  [*] 🔋 Limited Edition Energy Drink: Stamina buff duration increased from 30 seconds to 300 seconds
  [*] 🔋 Energy Drink: Reduced Cost of Stamina Per Action duration increased from 30 seconds to 300 seconds
  [*] 🔋 Energy Drink: Stamina buff duration increased from 45 seconds to 450 seconds
  [*] 😴 Energy Drink: Sleepiness reduction duration increased from 3 seconds to 30 seconds
  [*] 🔋 Water: Stamina buff duration increased from 5 seconds to 50 seconds
  [*] 🔋 Water: Reduced Cost of Stamina Per Action duration increased from 30 seconds to 300 seconds
  [*] ☢️ Beer: Radiation reduction duration increased from 2 seconds to 20 seconds
  [*] ☢️ Vodka: Radiation reduction duration increased from 2 seconds to 20 seconds
  [*] ☢️ Dvupalov Vodka: Radiation reduction duration increased from 10 seconds to 100 seconds
  [*] 🧠 Dvupalov Vodka: PSY Protection duration increased from 90 seconds to 900 seconds
  [*] 🔢 Each item shows its main effect as a numeric value + time (other effects unchanged)
  [/list]
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Initial release",
};
