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

  if (struct.SID === "KillVolumeEffect") {
    extraStructs.push(
      Object.assign(struct.fork(), {
        ApplyExtraEffectPrototypeSIDs: struct.ApplyExtraEffectPrototypeSIDs.map(() => "empty").fork(true),
      }),
    );
  }

  if (struct.SID === "WaterDeadlyDamage") {
    extraStructs.push(
      Object.assign(struct.fork(), {
        Type: "EEffectType::None",
      }),
    );
  }

  if (consumables.has(struct.SID)) {
    extraStructs.push(Object.assign(struct.fork(), { Duration: struct.Duration * 10 }));
  }
  return extraStructs;
};
transformEffectPrototypes.files = ["/EffectPrototypes.cfg"];

const consumables = new Set([
  "EnergeticStamina",
  "EnergeticLimitedStamina",
  "EnergeticSleepiness",
  "BandageBleeding4",
  "MedkitBleeding2",
  "Antirad4",
  "AnomalyVodkaRadiation",
  "HerculesWeight",
  "CinnamonDegenBleeding",
  "BeerAntirad1",
  "VodkaAntirad3",
  "PSYBlockerIncreaseRegen",
  "ArmyMedkitBleeding3",
  "EcoMedkitAntirad3",
  "EcoMedkitBleeding2",
  "WaterStamina2",
  "MagicVodkaPSYProtection",
  "EnergeticStaminaPerAction1",
  "WaterStaminaPerAction1",
  "HerculesWeight_Penalty",
]);
