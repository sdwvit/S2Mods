import type { Struct } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";
import { transformWeaponGeneralSetupPrototypes } from "./transformWeaponGeneralSetupPrototypes.mts";
import { transformBinocularsPrototypes } from "./transformBinocularsPrototypes.mts";
import { transformEffectPrototypes } from "./transformEffectPrototypes.mts";
import { transformWeaponFloatProviderPrototypes } from "./transformWeaponFloatProviderPrototypes.mts";
import { transformObjPrototypes } from "./transformObjPrototypes.mts";

export const meta: MetaType<Struct> = {
  description: `
Move at full speed while aiming[h1][/h1]
[hr][/hr]
Aiming down sights no longer slows you down. Strafe, push and reposition with your sights up.
[list]
[*] Every weapon moves at full speed while aiming and in canted (offset) aim.
[*] Scopes and other attachments no longer add an aiming movement penalty.
[*] Binoculars too.
[*] Weapons that were already faster while aiming keep their bonus.
[*] Only the player is affected; NPC movement is untouched.
[/list]
`,
  changenote: "Initial release.",
  structTransformers: [
    transformWeaponGeneralSetupPrototypes,
    transformBinocularsPrototypes,
    transformEffectPrototypes,
    transformWeaponFloatProviderPrototypes,
    transformObjPrototypes,
  ] as MetaType<Struct>["structTransformers"],
};
