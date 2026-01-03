import { EffectPrototype, NPCWeaponSettingsPrototype } from "s2cfgtojson";
import { MetaType } from "../../src/meta-type.mts";
import { allDefaultPlayerWeaponSettingsPrototypesRecord } from "../../src/consts.mts";

export const meta: MetaType<NPCWeaponSettingsPrototype | EffectPrototype> = {
  structTransformers: [entriesTransformer],
  description:
    "This mod does only one thing: [h1][/h1]it prevents border guards from killing you instantly with their weapons. Removes instakill effect.",
  changenote: "Update for 1.7.1",
};

function entriesTransformer(struct: NPCWeaponSettingsPrototype | EffectPrototype, { filePath, structsById }) {
  if (filePath.endsWith("NPCWeaponSettingsPrototypes.cfg")) {
    if (struct.SID.includes("Guard")) {
      const fork = struct.fork() as NPCWeaponSettingsPrototype;
      let ref = structsById[struct.__internal__.refkey];
      let refkey = ref.__internal__.refkey;

      while ((ref?.BaseDamage ?? 50) >= 51 && (structsById[refkey] ?? allDefaultPlayerWeaponSettingsPrototypesRecord[refkey])?.BaseDamage) {
        ref = structsById[refkey] ?? allDefaultPlayerWeaponSettingsPrototypesRecord[refkey];
        refkey = ref.__internal__.refkey;
      }

      fork.BaseDamage = (ref?.BaseDamage ?? 50) - 1;
      return fork;
    }
  }
  if (filePath.endsWith("EffectPrototypes.cfg")) {
    if (struct.SID === "KillVolumeEffect" && "ApplyExtraEffectPrototypeSIDs" in struct) {
      const fork = struct.fork();
      fork.ApplyExtraEffectPrototypeSIDs = struct.ApplyExtraEffectPrototypeSIDs.fork(true).map((e) => "empty");
      return fork;
    }
  }
}

entriesTransformer.files = ["NPCWeaponSettingsPrototypes.cfg", "EffectPrototypes.cfg"];
