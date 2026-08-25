import { Struct } from "s2cfgtojson";
import type { EDuplicateResolveType, EEffectDisplayType, EEffectType } from "s2cfgtojson";
import type { ArtifactPrototype, ConsumablePrototype, EffectPrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType = {
  description: `
[h1]Deprecated in 2.0[/h1]
[h1][/h1]
With the new game on the new Unreal Engine, mod structure changes — some mods are now part of the base game. Replacements will be released as separate mods.
[hr][/hr]
Drinking energy drink or wearing Thunderberry artifact increases Skif’s running speed (finally!).[h2][/h2]
Now you can speedrun main questline and easily outrun bloodsuckers.
[hr][/hr]
[list]
[*] ThunderBerry gives permanent 5% movement speed while wearing.
[*] Energetic gives temporary 5% movement speed
[*] Total 50% movement speed increase possible
[/list]

[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Fix energetic movement speed effect not being applied",
  structTransformers: [transformEffectPrototypes, transformArtifactPrototypes, transformConsumablePrototypes],
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
