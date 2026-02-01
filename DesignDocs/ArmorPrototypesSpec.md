# ArmorPrototypes Spec (GameLite)

This document describes armor and helmet prototypes defined in
`GameLite/GameData/ItemPrototypes/ArmorPrototypes.cfg` (SDK GameLite tree).
It is intended as a reference for balancing, UI, and mod authoring.

## Scope and source of truth
- Authoritative data: `GameLite/GameData/ItemPrototypes/ArmorPrototypes.cfg`.
- This file defines both body armor and helmet items.
- The file uses template inheritance via `refkey` and nested `struct.begin/struct.end` blocks.

## Prototype inventory (top-level structs)
Total `struct.begin` entries: 88 (includes templates and one formatting anomaly described below).

Top-level prototypes fall into these groups:
- Templates: `TemplateArmor` and `TemplateHelmet` (helmet inherits armor).
- Body armor (player-facing and NPC-only variants).
- Helmets (player-facing).
- A single variant that inherits from a base armor and adds preinstalled upgrades.

## Templates and inheritance
### TemplateArmor
Base fields and defaults for body armor:
- `Type = EItemType::Armor`
- `ItemSlotType = EInventoryEquipmentSlot::Body`
- `ItemGridWidth = 2`, `ItemGridHeight = 3`
- `MaxStackCount = 999`
- `ArtifactSlots = 2`
- `bBlockHead = false`, `bPreventFromLimping = false`
- `IncreaseSpeedCoef = 0.0`, `NoiseCoef = 1.0`
- `ArmorSoundType = ...ArmorType-Light...`
- `Protection` and `ProtectionNPC` structs with all zeroed damage types
- `UpgradePrototypeSIDs` empty array
- `EffectPrototypeSIDs` empty array
- `MeshGenerator` and `NpcMeshGenerator` single-item arrays with empty SID and weight 1
- `VoiceModulatorSID` empty
- `ItemTypeSwitchValue = ...ItemType-Armor...`
- `PhysicsInteractionPrototypeSID = Armor`
- `PreinstalledUpgrades` empty
- `SectionSettings` contains 5 disabled upgrade sections (Barrel, Handguard, Body, PistolGrip, Stock) with default UI positions and line directions.

### TemplateHelmet
Overrides only the helmet-specific aspects:
- `ItemSlotType = EInventoryEquipmentSlot::Head`
- `ItemGridWidth = 2`, `ItemGridHeight = 2`
- `ArtifactSlots = 0`
- `ItemTypeSwitchValue = ...ItemType-Helmet...`
- `PhysicsInteractionPrototypeSID = Helmet`

All other fields inherit from `TemplateArmor`.

## Schema (s2cfgtojson)
The `ArmorPrototype` type in `s2cfgtojson/types.mts` defines the full set of
fields that can appear on armor prototypes. The main fields are:
- Identity and basics: `SID`, `Type`, `LocalizationSID`, `Icon`,
  `ItemGridWidth`, `ItemGridHeight`, `ItemSlotType`, `MaxStackCount`, `Cost`,
  `Weight`, `BaseDurability`, `Invisible`.
- Audio/interaction: `ArmorSoundType`, `ItemTypeSwitchValue`,
  `PhysicsInteractionPrototypeSID`, `VoiceModulatorSID`,
  `StaggerEffectPrototypeSID`.
- Movement: `IncreaseSpeedCoef`, `NoiseCoef`, `bBlockHead`,
  `bPreventFromLimping`.
- Protection: `Protection`, `ProtectionNPC`.
- Visuals: `MeshPrototypeSID`, `MeshGenerator`, `NpcMeshGenerator`.
- Upgrades/effects: `UpgradePrototypeSIDs`, `PreinstalledUpgrades`,
  `EffectPrototypeSIDs`, `SectionSettings`.

## Field semantics (observed)
This section documents fields that appear in `ArmorPrototypes.cfg` and how they are used.

### Identity and UI
- `SID`: Prototype identifier; typically matches the struct name.
- `Icon`: UI texture path for inventory.
- `LocalizationSID`: Only used by `Anomaly_Scientific_Armor_PSY_preinstalled` to reuse the base armor name.
- `ItemGridWidth`/`ItemGridHeight`: Inventory footprint (2x3 for body, 2x2 for helmets).
- `ItemSlotType`: `Body` or `Head` (set only in templates).
- `Invisible`: Set to `true` on many `NPC_` armors to hide them from player-facing UI.

### Economy and durability
- `BaseDurability`: Range observed 143–1690.
- `Cost`: Range observed 2500–130000.
- `Weight`: Range observed 2–20.

### Artifact support
- `ArtifactSlots`: Observed values 0–5.
  - 0 only on helmets (template default), body armors range 1–5.

### Protection values
- `Protection`: Player damage mitigation by type.
- `ProtectionNPC`: NPC damage mitigation by type (often higher than `Protection`).
- Damage keys: `Strike`, `Radiation`, `Burn`, `Shock`, `ChemicalBurn`, `PSY`, `Fall`.

### Movement and behavior
- `bBlockHead`: `true` on heavy/scientific/exoskeleton variants and many NPC armors; `false` in template.
- `bPreventFromLimping`: `true` only on exoskeleton family armors:
  - `Exoskeleton_*_Armor`, `HeavyExoskeleton_*_Armor`, `BattleExoskeleton_Varta_Armor`.
- `IncreaseSpeedCoef`, `NoiseCoef`: Defined only in `TemplateArmor` (defaults 0.0 / 1.0).

### Audio and interaction
- `ArmorSoundType`: One of Light/Medium/Heavy/Exoskeleton switch values.
  - Both `AkSwitchValue'...'` and `/Script/AkAudio.AkSwitchValue'...'` forms appear.
- `ItemTypeSwitchValue`: Armor/Helmet switch set by templates only.
- `VoiceModulatorSID`: Mostly empty; set to `Gasmask` on:
  - `Heavy2_Military_Armor`
  - `Heavy_Varta_Helmet`
- `PhysicsInteractionPrototypeSID`: `Armor` or `Helmet` (template-defined).

### Mesh and visual selection
- `MeshPrototypeSID`: Primary mesh for the item; present on all non-template items.
- `MeshGenerator`: Array of weighted mesh generator SIDs (player visuals).
- `NpcMeshGenerator`: Array of weighted mesh generator SIDs for NPC visuals.
  - Many armors define several NPC mesh variants.

### Upgrades
- `UpgradePrototypeSIDs`: Array of upgrade prototypes; most player armors list many upgrade IDs.
- `PreinstalledUpgrades`: Only non-empty in `Anomaly_Scientific_Armor_PSY_preinstalled`.
- `SectionSettings`: Upgrade UI layout per armor.
  - 5 entries corresponding to `EUpgradeTargetPartType`:
    - `Barrel`, `Handguard`, `Body`, `PistolGrip`, `Stock`.
  - Each entry includes layout positions and `UpgradeLineDirection`/`ModuleLineDirection`.
  - Template has `SectionIsEnabled = false` for all; many player armors enable all 5.

### Effects
- `EffectPrototypeSIDs`: Present only on exoskeleton family armors and related NPC variants:
  - `Exoskeleton_Neutral_Armor`, `Exoskeleton_Mercenaries_Armor`, `Exoskeleton_Svoboda_Armor`, `Exoskeleton_Dolg_Armor`, `Exoskeleton_Monolith_Armor`, `BattleExoskeleton_Varta_Armor`.
  - `HeavyExoskeleton_Svoboda_Armor`, `HeavyExoskeleton_Dolg_Armor`, `HeavyExoskeleton_Monolith_Armor`.
  - `NPC_HeavyExoskeleton_Mercenaries_Armor`, `NPC_HeavyExoskeleton_Noon_Armor`, `NPC_HeavyExoskeleton_Spark_Armor`.
  - `NPC_Heavy3Exoskeleton_Coprs_Armor`, `NPC_Exoskeleton_Coprs_Armor`, `NPC_Exoskeleton_Noon_Armor`.

### NPC-only visibility
- `Invisible = true` is used on most `NPC_` armors and key NPC outfits (34 entries total).
  This hides them from player inventory or UI.

## Notable anomalies and formatting
- The `SectionSettings : struct.begin` line inside `Jemmy_Neutral_Armor` is not indented like the rest of the fields. The structure still closes correctly, but it looks like a formatting inconsistency.
- `ArmorSoundType` values are sometimes written with `/Script/AkAudio.` prefix and sometimes without. Treat both as equivalent paths when comparing.

## Implementation guidance (modding)
- Prefer inheriting from `TemplateArmor`/`TemplateHelmet` via `refkey` and override only what changes.
- Keep `ItemSlotType`, `ItemTypeSwitchValue`, and `PhysicsInteractionPrototypeSID` consistent with the template.
- Use `UpgradePrototypeSIDs` and `SectionSettings` together; upgrades without UI sections make them inaccessible in-game.
- For exoskeleton behavior, set `bPreventFromLimping = true` and add `EffectPrototypeSIDs` to match existing patterns.
- For NPC-only variants, set `Invisible = true` and adjust `ProtectionNPC` as needed.

## Reference paths
- `GameLite/GameData/ItemPrototypes/ArmorPrototypes.cfg`
