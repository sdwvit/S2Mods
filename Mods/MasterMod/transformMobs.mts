import { Struct } from "s2cfgtojson";

/**
 * Sets bullet (Strike) protection to 0 for all mobs.
 * @param entries
 * @param file
 */
export function transformMobs(entries: { Protection: Struct<{ Strike: number }> }, { file }: { file: string }) {
  if (!mobs.some((m) => file.includes(m))) {
    return entries;
  }
  if (!entries.Protection || !entries.Protection.entries) {
    return null;
  }
  entries.Protection.entries = { Strike: 0.0001 }; // Set Strike protection to 0 for all mobs
  return { Protection: entries.Protection };
}
export const mobs = [
  "BlindDog.cfg",
  "Bloodsucker.cfg",
  "Boar.cfg",
  "Burer.cfg",
  "Cat.cfg",
  "Chimera.cfg",
  "Controller.cfg",
  "Deer.cfg",
  "Flesh.cfg",
  "MutantBase.cfg",
  "Poltergeist.cfg",
  "PseudoDog.cfg",
  "Pseudogiant.cfg",
  "Snork.cfg",
  "Tushkan.cfg",
];
