# Temporary Effect Icons Via CameraShake

This document describes a discovered workaround for drawing temporary effect
icons on screen by routing a `SetCharacterEffect` quest node through a
`CameraShake` effect and handling the callback in Blueprint.

Treat it as an implementation note / working pattern, not yet a fully audited
SDK spec.

## Acknowledgements

Thanks to `rbwadle` and `Zivaka` for finding and explaining this mechanism.

## Overview

The workaround uses an effect of type `EEffectType::CameraShake` as a signal
carrier:

1. A quest node applies a character effect with `EQuestNodeType::SetCharacterEffect`.
2. The effect points at a `CameraShakePrototypeSID`.
3. The camera shake prototype points at a Blueprint class.
4. When the effect starts, the Blueprint receives the camera-shake callback.
5. That Blueprint can forward control to UI logic and draw a temporary icon.

The screenshots describe this as a practical way to detect a temporary effect
from quests and draw an icon on screen.

## Data pieces

### 1. Camera shake prototype

Author a camera shake prototype in `GameLite/GameData/CameraShakePrototypes.cfg`
or a patch for it.

Observed example:

- `SID = BackpackDefaultInitCameraShake`
- `Type = ECameraShakeType::Constant`
- `Scale = 0`
- `CameraShakePath = Blueprint'/PointOfNoReturn/GameLite/Resources/CameraShake/Backpacks/CS_DefaultBackpackInit.CS_DefaultBackpackInit'`
- `GroupSID = BackpackEquip`

Notes:
- The screenshots recommend assigning a dedicated `GroupSID` to avoid conflicts
  with other camera shakes.
- `Scale > 0` reportedly causes visible player twitching when the effect is
  applied.
- `Scale = 0` appears to be used to suppress the gameplay shake while still
  getting the callback.

### 2. Effect prototype

Author an effect prototype in `GameLite/GameData/EffectPrototypes.cfg` or a
patch for it.

Observed example:

- `SID = BackpackDefaultInit`
- `Type = EEffectType::CameraShake`
- `ValueMin = 1`
- `ValueMax = 1`
- `CameraShakePrototypeSID = BackpackDefaultInitCameraShake`
- `Positive = EBeneficial::Negative`
- `CameraShakeEffectSubtype = ECameraShakeEffectSubtype::AddEffect`

This effect is what quests apply to the player.

### 3. Quest node that applies the effect

Use `EQuestNodeType::SetCharacterEffect` in quest nodes.

Observed pattern:

- `EffectPrototypeSID = BackpackDefaultInit`
- `TargetQuestGuid = AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`

The example chain first checks state, then routes into the effect application
node:

1. `EQuestNodeType::If`
2. `EQuestNodeType::Technical`
3. `EQuestNodeType::SetCharacterEffect`

The exact condition is flexible. The screenshots show both of these patterns:

- Check a global variable, then apply the effect.
- Check whether a specific effect is currently present using
  `EQuestConditionType::Effect`.

## Quest-side detection patterns

### Global-variable gated trigger

One screenshot shows an initialization quest that checks a global variable and,
if the value matches, applies the camera-shake effect.

Observed condition fields:

- `ConditionType = EQuestConditionType::GlobalVariable`
- `ConditionComparance = EConditionComparance::Equal`
- `GlobalVariablePrototypeSID = GVarBackpackSlotItem`
- `ChangeValueMode = EChangeValueMode::Set`
- `VariableValue = Default_Backpack`

This pattern is useful when the icon should appear after some authored quest or
inventory state transition.

### Effect-presence check

Another screenshot shows a quest `If` node using:

- `ConditionType = EQuestConditionType::Effect`
- `ConditionComparance = EConditionComparance::Equal`
- `TargetCharacter = AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`
- `EffectPrototypeSID = FaustPsyResist`
- `RequiredSquadMembers = ERequiredSquadMembers::AllMembers`

This implies quests can branch on the presence of a specific effect, but not on
the exact numeric stat magnitude behind that effect.

The conversation explicitly states:
- You can determine the presence of a particular effect.
- You cannot determine the exact stat value of that effect through this route.

## Blueprint requirements

The screenshots state that the camera-shake Blueprint:

- must inherit from `CS_OnShooting`
- must override `ReceivePlayShake`

The callback is described as the hook where the Blueprint receives the start of
the effect. From there, control can be passed to any other Blueprint, such as:

- a player component
- a widget

That forwarding step is the piece that actually draws or updates the temporary
icon on screen.

The screenshot text also references the Blueprint call in simplified form as:

- Blueprint will call `Start(QuestSID)`
- and get callback through `CameraShake/CameraShakeEffect`

The exact engine-side parameter names should be verified in the SDK Blueprint
class, but the important operational detail is that `ReceivePlayShake` is the
callback entry point.

## End-to-end flow

1. Quest logic decides an icon-worthy temporary state should start.
2. Quest applies an effect whose type is `EEffectType::CameraShake`.
3. That effect resolves to a camera shake prototype.
4. The prototype instantiates a Blueprint camera shake class.
5. The Blueprint receives `ReceivePlayShake`.
6. The Blueprint forwards the event to UI code.
7. UI code shows the temporary icon.

## Practical guidance for mods

- Use one lightweight camera-shake prototype per logical icon trigger, or one
  shared Blueprint plus per-effect branching, depending on how much context the
  Blueprint can recover.
- Keep the shake non-physical. The observed pattern uses `Scale = 0`.
- Put these camera shakes in a separate group to reduce interference with other
  shakes.
- Drive the trigger from `SetCharacterEffect` quest nodes rather than trying to
  read raw stat magnitudes from quest conditions.
- If you need to know whether a temporary effect exists, use
  `EQuestConditionType::Effect`.

## Limitations and open questions

- This mechanism appears to signal effect start; the screenshots do not fully
  document the matching removal / icon-hide path.
- The screenshots do not confirm whether effect end generates a symmetric
  callback or whether removal must be handled through separate quest logic.
- The exact Blueprint asset/class hierarchy should be verified in SDK content,
  especially the inheritance chain under `CS_OnShooting`.
- The statement about `Start(QuestSID)` is community guidance from the
  screenshots and should be treated as partially inferred until confirmed in the
  SDK.

## Source paths

- `GameLite/GameData/CameraShakePrototypes.cfg`
- `GameLite/GameData/EffectPrototypes.cfg`
- `GameLite/GameData/QuestNodePrototypes/*.cfg`
- `Resources/CameraShake/Backpacks/CS_DefaultBackpackInit`
