import type { ObjPrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType<ObjPrototype> = {
  description: `
Makes all mutants trigger anomalies.[h1][/h1]
By default, big creatures like Chimera, Pseudogiant, Bloodsucker, Controller, and Poltergeist don't trigger anomalies at all.
This mod sets ShouldTriggerAnomalies to true for every mutant, so anomalies affect them just like they affect smaller creatures.[h1][/h1]
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
