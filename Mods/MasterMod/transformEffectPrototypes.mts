import { EDuplicateResolveType, EEffectType, EffectPrototype, Struct } from "s2cfgtojson";
import { EntriesTransformer } from "../../src/meta-type.mts";

let oncePerFile = false;
export const MovementSpeedEffect5PSID = "MovementSpeedEffect5PSID";
export const MovementSpeedEffect5PTmpSID = "MovementSpeedEffect5PTmp";

/**
 * Makes some consumables last longer.
 * Also negates KillVolumeEffect (borderguard instakill)
 */
export const transformEffectPrototypes: EntriesTransformer<EffectPrototype> = async (struct) => {
  const extraStructs: EffectPrototype[] = [];
  if (!oncePerFile) {
    oncePerFile = true;
    extraStructs.push(
      new Struct({
        __internal__: {
          rawName: MovementSpeedEffect5PSID,
          isRoot: true,
        },
        SID: MovementSpeedEffect5PSID,
        Text: "Add Run 5%",
        Type: "EEffectType::VelocityChange" as EEffectType,
        ValueMin: "5.0%",
        ValueMax: "5.0%",
        bIsPermanent: true,
        DuplicationType: "EDuplicateResolveType::KeepAll" as EDuplicateResolveType,
        Positive: "EBeneficial::Positive",
      }) as EffectPrototype,
    );
    extraStructs.push(
      new Struct({
        __internal__: {
          rawName: MovementSpeedEffect5PTmpSID,
          isRoot: true,
        },
        SID: MovementSpeedEffect5PTmpSID,
        Text: "Add Run 5%",
        Type: "EEffectType::VelocityChange",
        ValueMin: "5.0%",
        ValueMax: "5.0%",
        bIsPermanent: false,
        Duration: 450.0, // already 10x
        DuplicationType: "EDuplicateResolveType::KeepAll",
        Positive: "EBeneficial::Positive",
      }) as EffectPrototype,
    );
  }

  if (struct.SID === "WaterDeadlyDamage") {
    extraStructs.push(
      Object.assign(struct.fork(), {
        Type: "EEffectType::None",
      }),
    );
  }

  return extraStructs;
};
transformEffectPrototypes.files = ["/EffectPrototypes.cfg"];
