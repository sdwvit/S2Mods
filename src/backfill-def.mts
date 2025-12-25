import { Struct } from "s2cfgtojson";
import { allDefaultArmorPrototypesRecord, allDefaultArmorPrototypes } from "./consts.mjs";
import { logger } from "./logger.mts";

const defaultKeys = new Set(["__internal__"]);

export function backfillDef<T extends Partial<Struct>>(
  struct: T,
  referenceMap: Record<string, { __internal__: { refkey?: number | string } }> = allDefaultArmorPrototypesRecord,
  referenceStructSID = referenceMap[struct.__internal__.refkey]
    ? struct.__internal__.refkey
    : allDefaultArmorPrototypes[0].SID,
): T {
  const s = new Struct(struct);

  if (!referenceMap[referenceStructSID]) {
    logger.warn(`Missing referenceStructSID '${struct.__internal__.refkey}'`);
    return;
  }

  deepWalk(referenceMap[referenceStructSID], (path: string[]) => {
    let a = s;
    while (get(a, path) === undefined) {
      const ref = referenceMap[a.__internal__.refkey];

      if (ref) {
        a = new Struct(ref);
      } else {
        return;
      }
    }
    set(s, path, get(a, path));
  });

  return s as T;
}

export function getTemplate<T extends Partial<Struct & { SID: string }>>(
  struct: T,
  referenceMap: Record<string, T>,
): string {
  while (
    struct.__internal__.refkey &&
    !struct.SID.toLowerCase().includes("template") &&
    referenceMap[struct.__internal__.refkey]
  ) {
    struct = referenceMap[struct.__internal__.refkey];
  }

  return struct.SID;
}

function deepWalk(obj: unknown, cb: (s: string[]) => void, path: string[] = []) {
  return Object.entries(obj)
    .filter((e) => !defaultKeys.has(e[0]))
    .forEach(([k, v]) => {
      cb(path.concat(k));
      if (typeof v === "object" && v !== null) {
        deepWalk(v, cb, path.concat(k));
      }
    });
}

export function get(obj: any, path: string[]) {
  return path.reduce((o, k) => o && o[k], obj);
}

export function set(obj: any, path: string[], value: any) {
  const lastKey = path.pop();
  const parent = get(obj, path);
  if (parent && lastKey) {
    parent[lastKey] = value;
  }
}
