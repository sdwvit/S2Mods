import type { CoreVariable } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";

/**
 * Shay's Distant Horizons Release 21 (2.0): one bpatch on CoreVariables' DefaultConfig that turns on
 * the dynamic A-Life streaming range on every platform. Shay ships the 350 m values; the 250 m and
 * 300 m presets scale the NPC budget with the streamed area and interpolate the memory thresholds
 * and UObject cap between vanilla (200 m, 750k engine default) and 350 m.
 * Vanilla PC already streams up to 200 m (SettingsVariablesPC.cfg), consoles 125 m or less.
 */
export const DISTANT_HORIZONS_PRESETS = {
  250: {
    ALifeStreamingDistanceDynamicRangeMax: 250.0,
    ALifeStreamingDistanceDynamicRangeSubsteps: 15,
    ALifeStreamingDistanceDynamicRangeShrinkThresholdMB: 600.0,
    ALifeStreamingDistanceDynamicRangeGrowthThresholdMB: 1200.0,
    ALifeStreamingDistanceDynamicRangeMaxUnitModelNum: 281,
    ALifeStreamingDistanceDynamicRangeGrowthCooldownSeconds: 25.0,
    MaxUObjectsInGame: 875000,
  },
  300: {
    ALifeStreamingDistanceDynamicRangeMax: 300.0,
    ALifeStreamingDistanceDynamicRangeSubsteps: 20,
    ALifeStreamingDistanceDynamicRangeShrinkThresholdMB: 675.0,
    ALifeStreamingDistanceDynamicRangeGrowthThresholdMB: 1350.0,
    ALifeStreamingDistanceDynamicRangeMaxUnitModelNum: 405,
    ALifeStreamingDistanceDynamicRangeGrowthCooldownSeconds: 30.0,
    MaxUObjectsInGame: 1000000,
  },
  350: {
    ALifeStreamingDistanceDynamicRangeMax: 350.0,
    ALifeStreamingDistanceDynamicRangeSubsteps: 25,
    ALifeStreamingDistanceDynamicRangeShrinkThresholdMB: 750.0,
    ALifeStreamingDistanceDynamicRangeGrowthThresholdMB: 1500.0,
    ALifeStreamingDistanceDynamicRangeMaxUnitModelNum: 551,
    ALifeStreamingDistanceDynamicRangeGrowthCooldownSeconds: 30.0,
    MaxUObjectsInGame: 1125000,
  },
};

/** Shared by every preset: Shay's binocular and anomaly VFX values. */
const COMMON = {
  bAnomalyVFXForceLiveToStreamingDistance: true,
  BinocularsZoomGainMultiplier: 1.2,
  BinocularsMagnificationMultiplier: 1.8,
  BinocularsSmoothZoomAlphaRange: 2.5,
  BinocularsStreamingMagnificationAtMaxDistance: 2.2,
  BinocularsStreamingIdentificationRangeAtMaxDistance: 3.5,
  bOverrideALifeStreamingDistanceDynamicRange: true,
};

export function makeTransformCoreVariables(preset: keyof typeof DISTANT_HORIZONS_PRESETS) {
  const transformCoreVariables: StructTransformer<CoreVariable> = (struct) => {
    if (struct.__internal__.rawName !== "DefaultConfig") {
      return null;
    }
    const fork = struct.fork();
    Object.assign(fork, COMMON, DISTANT_HORIZONS_PRESETS[preset]);
    return fork;
  };
  transformCoreVariables.files = ["/CoreVariables.cfg"];
  return transformCoreVariables;
}
