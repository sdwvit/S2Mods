import { Struct } from "s2cfgtojson";

export function markAsForkRecursively<T extends Struct>(s: T) {
  s.__internal__.bpatch = true;
  Object.values(s)
    .filter((v) => v instanceof Struct)
    .forEach(markAsForkRecursively);
  return s;
}
