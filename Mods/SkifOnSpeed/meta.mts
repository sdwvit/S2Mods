import { ArtifactPrototype, ConsumablePrototype, EDuplicateResolveType, EEffectDisplayType, EEffectType, EffectPrototype, Struct } from "s2cfgtojson";
import { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType = {
  description: `
Drinking energy drink or wearing Thunderberry artifact increases Skif’s running speed (finally!).[h2][/h2]
Now you can speedrun main questline and easily outrun bloodsuckers.
[hr][/hr]
[list]
[*] ThunderBerry gives permanent 5% movement speed while wearing.
[*] Energetic gives temporary 5% movement speed
[*] Total 50% movement speed increase possible
[/list]
`,
  changenote: "Initial release",
  structTransformers: [transformEffectPrototypes, transformArtifactPrototypes],
};

let oncePerFile = false;

export const getMovementSpeedEffectSID = (n: number) => `MovementSpeedEffect${n}PSID`;
export const MovementSpeedEffect5PTmpSID = "MovementSpeedEffect5PTmp";

export function transformEffectPrototypes(s: EffectPrototype) {
  if (!oncePerFile) {
    const extraStructs: EffectPrototype[] = [];
    oncePerFile = true;
    for (let i = 0; i < 1; i++) {
      const f = (i + 1) * 5;
      extraStructs.push(
        new Struct({
          __internal__: {
            rawName: getMovementSpeedEffectSID(f),
            isRoot: true,
            refurl: s.__internal__.refurl,
            refkey: "[0]",
          },
          SID: getMovementSpeedEffectSID(f),
          Text: `Add Run ${f}%`,
          Type: "EEffectType::VelocityChange" as EEffectType,
          ValueMin: `${f}.0%`,
          ValueMax: `${f}.0%`,
          bIsPermanent: true,
          DuplicationType: "EDuplicateResolveType::KeepAll" as EDuplicateResolveType,
          Positive: "EBeneficial::Positive",
        }) as EffectPrototype,
      );
    }

    extraStructs.push(
      new Struct({
        __internal__: {
          rawName: MovementSpeedEffect5PTmpSID,
          isRoot: true,
          refurl: s.__internal__.refurl,
          refkey: "[0]",
        },
        SID: MovementSpeedEffect5PTmpSID,
        Text: "Add Run 5%",
        Type: "EEffectType::VelocityChange",
        ValueMin: "5.0%",
        ValueMax: "5.0%",
        bIsPermanent: false,
        Duration: 45.0,
        DuplicationType: "EDuplicateResolveType::KeepAll" as EDuplicateResolveType,
        Positive: "EBeneficial::Positive",
      }) as EffectPrototype,
    );
    return extraStructs;
  }
}

transformEffectPrototypes.files = ["/EffectPrototypes.cfg"];

export function transformArtifactPrototypes(struct: ArtifactPrototype) {
  if (struct.SID === "EArtifactDope") {
    const fork = struct.fork();
    fork.EffectPrototypeSIDs = struct.EffectPrototypeSIDs.fork();
    fork.EffectPrototypeSIDs.addNode(getMovementSpeedEffectSID(5), getMovementSpeedEffectSID(5));
    fork.ShouldShowEffects = struct.ShouldShowEffects.fork();
    fork.ShouldShowEffects.addNode(true, getMovementSpeedEffectSID(5));
    fork.EffectsDisplayTypes = struct.EffectsDisplayTypes.fork();
    fork.EffectsDisplayTypes.addNode("EEffectDisplayType::EffectLevel" as EEffectDisplayType, getMovementSpeedEffectSID(5));
    return fork;
  }
}

transformArtifactPrototypes.files = ["/ArtifactPrototypes.cfg"];

export async function transformConsumablePrototypes(struct: ConsumablePrototype) {
  if (struct.SID === "Energetic") {
    const fork = struct.fork();
    fork.EffectPrototypeSIDs = struct.EffectPrototypeSIDs.fork();
    fork.EffectPrototypeSIDs.addNode(MovementSpeedEffect5PTmpSID, MovementSpeedEffect5PTmpSID);
    fork.AlternativeEffectPrototypeSIDs = struct.AlternativeEffectPrototypeSIDs.fork();
    fork.AlternativeEffectPrototypeSIDs.addNode(MovementSpeedEffect5PTmpSID, MovementSpeedEffect5PTmpSID);
    fork.ShouldShowEffects = struct.ShouldShowEffects.fork();
    fork.ShouldShowEffects.addNode(true, MovementSpeedEffect5PTmpSID);
    fork.EffectsDisplayTypes = struct.EffectsDisplayTypes.fork();
    fork.EffectsDisplayTypes.addNode("EEffectDisplayType::ValueAndTime", MovementSpeedEffect5PTmpSID);
    return fork;
  }
}

transformConsumablePrototypes.files = ["/ConsumablePrototypes.cfg"];
