import { Struct } from "s2cfgtojson";
import type { ObjPrototype } from "s2cfgtojson";

/**
 * Player only: backwards and diagonal-backwards movement uses the forward speed.
 * NPCs keep their own coefficients (NPCBase / GeneralNPC prototypes are untouched).
 */
export function transformObjPrototypes(struct: ObjPrototype) {
  if (struct.SID !== "Player") {
    return null;
  }
  const fork = struct.fork();
  const movement = new Struct() as ObjPrototype["MovementParams"];
  movement.__internal__.bpatch = true;
  movement.WalkBackCoef = 1;
  movement.WalkDiagonalBackCoef = 1;
  movement.RunBackCoef = 1;
  movement.RunDiagonalBackCoef = 1;
  movement.MoveBackCrouchCoef = 1;
  movement.MoveBackLowCrouchCoef = 1;
  fork.MovementParams = movement;
  return fork;
}

transformObjPrototypes.files = ["GameData/ObjPrototypes.cfg"];
