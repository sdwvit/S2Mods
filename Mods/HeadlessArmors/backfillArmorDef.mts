import { ArmorPrototype, Struct } from "s2cfgtojson";
import { allDefaultArmorDefs } from "../../src/consts.mjs";
const defaultKeys = new Set(["__internal__"]);

export function backfillArmorDef<T>(armorT: T): T & ArmorPrototype {
  const armor = armorT instanceof Struct ? armorT.clone() : new Struct(armorT as object);
  const deepWalk = (obj: ArmorPrototype, cb: (s: string[]) => void, path: string[] = []) =>
    Object.entries(obj)
      .filter((e) => !defaultKeys.has(e[0]))
      .forEach(([k, v]) => {
        cb(path.concat(k));
        if (typeof v === "object" && v !== null) {
          deepWalk(v, cb, path.concat(k));
        }
      });
  const get = (obj: any, path: string[]) => path.reduce((o, k) => o && o[k], obj);
  const set = (obj: any, path: string[], value: any) => {
    const lastKey = path.pop();
    const parent = get(obj, path);
    if (parent && lastKey) {
      parent[lastKey] = value;
    }
  };
  deepWalk(allDefaultArmorDefs.HeavyExoskeleton_Svoboda_Armor, (path: string[]) => {
    let a = armor;
    while (get(a, path) === undefined) {
      a = allDefaultArmorDefs[a.__internal__.refkey];
      if (!a) {
        return;
      }
    }
    set(armor, path, get(a, path));
  });

  return armor as T & ArmorPrototype;
}
