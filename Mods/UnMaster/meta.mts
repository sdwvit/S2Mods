import type { MetaContext, MetaType } from "../../src/meta-type.mts";
import { Struct } from "s2cfgtojson";
import type {
  DifficultyPrototype,
  DifficultyPrototypeEnvironmentDifficulty,
  DifficultyPrototypeTotalSaveLimits,
} from "s2cfgtojson";

export const meta: MetaType<DifficultyPrototype> = {
  description: `
Quality of Life changes for Master difficulty. 
[hr][/hr]
Brings back unlimited saves, compass, crosshair, stash and dead body markers, and unlocks settings on Master difficulty.[h1][/h1]
Rest of Master specific things are left intact.[h1][/h1]
[hr][/hr]
bpatches DifficultyPrototypes

[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote:
    "Fixed broken repairs and item condition: the EnvironmentDifficulty patch was replacing the whole block instead of patching it, wiping Master's Armor_Durability, weapon/explosion damage, radiation, bleeding and hunger tuning. Only the HUD toggles are changed now.",
  structTransformers: [structTransformer],
};

function structTransformer(struct: DifficultyPrototype, context: MetaContext<DifficultyPrototype>) {
  if (struct.SID !== "Hard" && struct.SID !== "Stalker") {
    return null;
  }
  const fork = struct.fork();

  // Saves: bring back the full set of save types and drop Master's save-count caps.
  fork.AllowedSaveTypes = context.structsById.Hard.AllowedSaveTypes;
  fork.TotalSaveLimits = new Struct() as DifficultyPrototypeTotalSaveLimits;

  // Settings menu is locked on Master.
  fork.BlockSettings = false;

  // Since 2.0 the HUD toggles live under EnvironmentDifficulty, not on the root struct.
  const environmentDifficulty = new Struct() as DifficultyPrototypeEnvironmentDifficulty;
  environmentDifficulty.bShouldDisableCompass = false;
  environmentDifficulty.bShouldDisableCrosshair = false;
  environmentDifficulty.bShouldDisableDeadBodyMarkers = false;
  environmentDifficulty.bShouldDisableStashMarkers = false;
  fork.EnvironmentDifficulty = environmentDifficulty;
  environmentDifficulty.__internal__.bpatch = true;
  return fork;
}

structTransformer.files = ["/DifficultyPrototypes.cfg"];
