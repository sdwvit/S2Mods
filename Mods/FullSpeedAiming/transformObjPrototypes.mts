import { Struct } from "s2cfgtojson";
import type { ObjPrototype } from "s2cfgtojson";

/** The player has no AimSpeedCoef in vanilla (engine default applies); set it to 1. */
export function transformObjPrototypes(struct: ObjPrototype) {
  if (struct.SID !== "Player") return null;
  const fork = struct.fork();
  fork.MovementParams = new Struct() as ObjPrototype["MovementParams"];
  fork.MovementParams.__internal__.bpatch = true;
  fork.MovementParams.AimSpeedCoef = 1;
  return fork;
}

transformObjPrototypes.files = ["GameData/ObjPrototypes.cfg"];
