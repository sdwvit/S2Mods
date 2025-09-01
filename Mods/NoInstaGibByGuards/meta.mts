import { GetStructType, Struct } from "s2cfgtojson";
import { Meta, WithSID } from "../../helpers/prepare-configs.mjs";
type EntriesType = { SID: string } & ({ BaseDamage: number } | { ApplyExtraEffectPrototypeSIDs: GetStructType<string[]> });
export const meta: Meta<WithSID & Struct<EntriesType>> = {
  interestingFiles: ["NPCWeaponSettingsPrototypes.cfg", "EffectPrototypes.cfg"],
  interestingContents: [],

  description: "This mod does only one thing: it prevents border guards from killing you instantly with their weapons. Removes instakill effect.",
  changenote: "Initial release",
  entriesTransformer: (entries: EntriesType, { file, s, structsById }) => {
    if (file.includes("NPCWeaponSettingsPrototypes.cfg")) {
      if (entries.SID.includes("Guard") && "BaseDamage" in entries) {
        entries.BaseDamage = (structsById[s._refkey]?.entries as Partial<typeof entries>)?.BaseDamage ?? 50;
        return entries;
      }
    }
    if (file.includes("EffectPrototypes.cfg")) {
      if (entries.SID === "KillVolumeEffect" && "ApplyExtraEffectPrototypeSIDs" in entries) {
        entries.ApplyExtraEffectPrototypeSIDs.entries = Object.fromEntries(
          Object.entries(entries.ApplyExtraEffectPrototypeSIDs.entries).map((e) => {
            e[1] = "empty";
            return e;
          }),
        );
        return entries;
      }
    }
    return null;
  },
};
