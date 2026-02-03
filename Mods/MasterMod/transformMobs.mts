import { GeneralNPCObjPrototype } from "s2cfgtojson";
import { DIFFICULTY_FACTOR } from "../GlassCannon/meta.mts";
/**
 * Sets bullet (Strike) protection to 0 for all mobs.
 */
export async function transformMobs(struct: GeneralNPCObjPrototype) {
  if (!struct.VitalParams) {
    return;
  }
  const fork = struct.fork();
  fork.VitalParams = struct.VitalParams.fork();
  fork.VitalParams.MaxHP = struct.VitalParams.MaxHP * DIFFICULTY_FACTOR;
  return fork;
}
transformMobs.files = [
  "/Bloodsucker.cfg",
  "/Boar.cfg",
  "/Burer.cfg",
  "/Chimera.cfg",
  "/Controller.cfg",
  "/Deer.cfg",
  "/Flesh.cfg",
  "/PseudoDog.cfg",
  "/Pseudogiant.cfg",
  "/Snork.cfg",
];
2