import type { CoreVariable } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType = {
  description: `
[h1]Deprecated in 2.0[/h1]
    Makes mutant corpse loot hitboxes much larger so you don't have to fight the ragdoll to loot them.
    [hr][/hr]
    [list]
    [*] Interaction range doubled (1.2m → 2.4m)
    [*] Interaction height range expanded (25–90cm → 0–180cm)
    [*] Cut radius multiplier increased 5x for all mutant types
    [/list]
  
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Initial release.",
  structTransformers: [coreVarsTransformer],
};

function coreVarsTransformer(struct: CoreVariable) {
  if (struct.__internal__.rawName !== "DefaultConfig") {
    return;
  }
  const fork = struct.fork();
  fork.MutantLootContainerInteractRange = struct.MutantLootContainerInteractRange * 2;
  fork.MutantLootInteractHeightMin = 0;
  fork.MutantLootInteractHeightMax = struct.MutantLootInteractHeightMax * 2;
  fork.MutantLootParams = struct.MutantLootParams.map(([, e]) => {
    const fork = e.fork();
    fork.CutRadiusModifier = Math.max(e.CutRadiusModifier, 2) * 5;
    return fork;
  }).fork(true);

  return fork;
}

coreVarsTransformer.files = ["/CoreVariables.cfg"];
