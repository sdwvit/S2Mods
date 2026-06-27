import type { ConsumablePrototype, EffectPrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";

const interestingSIDs = new Set<string>([
  "CinnamonDegenBleeding",
  "PSYBlockerIncreaseRegen",
  "HerculesWeight",
  "HerculesWeight_Penalty",
]);

// Consumables whose effects should display numeric values instead of bars.
const numericValueConsumables = new Set<string>([
  "Hercules",
  "Cinnamon",
  "PSYBlocker",
]);

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
  if (!numericValueConsumables.has(struct.SID) || !struct.EffectsDisplayTypes) {
    return null;
  }
  const fork = struct.fork();
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
  [h3]Makes pill consumables last longer, with the same value, and shows their effects as numeric values instead of bars.[/h3]
    [list]
  [*] 🩸 Barvinok: Bleeding control duration increased from 3 minutes to 30 minutes
  [*] 🧠 PSY Block: PSY Protection duration increased from 1 minute to 10 minutes
  [*] 🏋️ Hercules: Weight buff duration increased from 5 minutes to 50 minutes
  [*] 🔢 All of the above show numeric effect values instead of level bars
  [/list]`,
  changenote: "Compatible with 1.8.x",
};
