import type { StructTransformer } from "../../src/meta-type.mts";
import { fwNeedsPresets } from "./factionWarNpcs.mts";

let once = false;

/** Emits the two FW needs presets once, anchored on a struct that exists in the vanilla file. */
export const transformNPCNeedsPresets: StructTransformer<any> = (struct) => {
  if (once || String(struct.SID) !== "FreedomsNeedsPreset") return null;
  once = true;
  return fwNeedsPresets();
};

transformNPCNeedsPresets.files = ["/NPCNeedsPresetPrototypes.cfg"];
