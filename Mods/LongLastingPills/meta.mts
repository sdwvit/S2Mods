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
[h1]Deprecated in 2.0[/h1]
[h1][/h1]
With the new game on the new Unreal Engine, mod structure changes — some mods are now part of the base game. Replacements will be released as separate mods.
[hr][/hr]
  [h3]Makes pill consumables last longer, with the same value, and shows their effects as numeric values instead of bars.[/h3]
    [list]
  [*] 🩸 Barvinok: Bleeding control duration increased from 3 minutes to 30 minutes
  [*] 🧠 PSY Block: PSY Protection duration increased from 1 minute to 10 minutes
  [*] 🏋️ Hercules: Weight buff duration increased from 5 minutes to 50 minutes
  [*] 🔢 All of the above show numeric effect values instead of level bars
  [/list]
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Compatible with 1.8.x",
};
