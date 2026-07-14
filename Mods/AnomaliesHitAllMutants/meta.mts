import type { ObjPrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType<ObjPrototype> = {
  description: `
[h1]Deprecated in 2.0[/h1]
Makes all mutants trigger anomalies.[h1][/h1]
By default, big creatures like Chimera, Pseudogiant, Bloodsucker, Controller, and Poltergeist don't trigger anomalies at all.
This mod sets ShouldTriggerAnomalies to true for every mutant, so anomalies affect them just like they affect smaller creatures.[h1][/h1]
 
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Initial release.",
  structTransformers: [transformMutants],
};

async function transformMutants(struct: ObjPrototype) {
  if (struct.ShouldTriggerAnomalies !== false) {
    return null;
  }
  const fork = struct.fork();
  fork.ShouldTriggerAnomalies = true;
  return fork;
}
transformMutants.files = [
  "/Chimera.cfg",
  "/Bloodsucker.cfg",
  "/Pseudogiant.cfg",
  "/Controller.cfg",
  "/Poltergeist.cfg",
  "/Deer.cfg"
];
