# ItemGeneratorPrototypes Spec (GameLite)

This document describes item generators defined under
`GameLite/GameData/ItemGeneratorPrototypes/`. It covers both:
- `DynamicItemGenerator.cfg` (general-purpose generators).
- `QuestItemGeneratorPrototypes.cfg` (quest/NPC-specific generators and overrides).

## Scope and source of truth
- Authoritative data for dynamic generators:
  `GameLite/GameData/ItemGeneratorPrototypes/DynamicItemGenerator.cfg`.
- Authoritative data for quest generators:
  `GameLite/GameData/ItemGeneratorPrototypes/QuestItemGeneratorPrototypes.cfg`.
- Template used by some quest generators:
  `GameLite/GameData/ItemGeneratorPrototypes/QuestStashBodyItemGeneratorPrototypes/Template_QuestStashBodyItemGenerator.cfg`.

## Shared structural model
Both files use the `ItemGeneratorPrototype` schema from
`s2cfgtojson/types.mts` (see `ItemGeneratorPrototype`,
`ItemGeneratorPrototypeItemGeneratorItem`, and
`ItemGeneratorPrototypePossibleItemsItem`).

At a high level, each generator looks like:
- `SID`: name of the generator.
- `ItemGenerator`: array of entries, each describing a category and conditions.
  - Entries can be indexed (`[0]`, `[1]`, ...), wildcarded (`[*]`), or named (`any string`).
  - Each entry includes a `Category` and a `PossibleItems` list.

Top-level fields (per `ItemGeneratorPrototype`):
- `SID`: generator name.
- `ID`: numeric identifier (not commonly authored in these files).
- `GeneratedItems`: additional generated items (type: `NPCPrototypeSkills`).
- `ItemGenerator`: list of category entries.
- `MoneyGenerator`: money rewards block (type: `QuestRewardsPrototypeMoneyGenerator`).
- `RefreshTime`: optional global refresh time.
- `SpecificRewardSound`: UI sound (type: `EUISound`).

`ItemGenerator` entries use the `ItemGeneratorPrototypeItemGeneratorItem` shape:
- `Category`, `PlayerRank`, `Diff`, `ReputationThreshold`, `RefreshTime`,
  `bAllowSameCategoryGeneration`, `PossibleItems`.

`PossibleItems` entries use the `ItemGeneratorPrototypePossibleItemsItem` shape:
- `ItemPrototypeSID`, `ItemGeneratorPrototypeSID`
- `Chance`, `Weight` (and `weight`)
- `MinCount`, `MaxCount`, `MinDurability`, `MaxDurability`
- `AmmoMinCount`, `AmmoMaxCount`, `AmmoMaxcount` (typo variant)
- `bRequireAmmo`, `bRequireWeapon`, `bUnloadedWeapon`
- `Attaches`, `Upgrades` (type: `QuestRewardsPrototypeUpgrades`)

## DynamicItemGenerator
This section describes dynamic item generators defined in
`GameLite/GameData/ItemGeneratorPrototypes/DynamicItemGenerator.cfg`.
These generators are used for NPC loadouts, trader inventories, quest bodies,
location-specific vendors, and other dynamic item sources.

### Structural model
Same as the shared model above.

### ItemGenerator entry fields (observed)
- `Category`: `EItemGenerationCategory::...`
- `PlayerRank`: `ERank::...` (often a single rank or a comma-separated list).
- `Diff`: `EGameDifficulty::...` (single or comma-separated list).
- `ReputationThreshold`: numeric threshold (appears mainly in trader generators).
- `RefreshTime`: string duration (example: `1h`).
- `bAllowSameCategoryGeneration`: boolean (appears in trader generators).

### PossibleItems entry fields (observed)
- `ItemPrototypeSID`: concrete item prototype to generate.
- `ItemGeneratorPrototypeSID`: reference to another generator (used by
  `EItemGenerationCategory::SubItemGenerator`).
- `Weight`: weighted selection for loadout-style generators.
- `Chance`: probability for consumable-style generators.
- `MinCount` / `MaxCount`: quantity range (consumables, ammo, junk, etc.).
- `MinDurability` / `MaxDurability`: durability range (weapons/armor).
- `AmmoMinCount` / `AmmoMaxCount`: ammo quantity range (weapon entries).

### Categories in use
Categories observed in this file (with frequency):
- `WeaponPrimary` (most common)
- `SubItemGenerator`
- `Detector`
- `Artifact`
- `BodyArmor`
- `Head`
- `Consumable`
- `WeaponPistol`
- `Junk`
- `NightVision`
- `Ammo`
- `Attach`
- `WeaponSecondary`

Notes:
- `SubItemGenerator` entries compose other generators by referencing
  `ItemGeneratorPrototypeSID` in `PossibleItems`.
- `WeaponPrimary` and `WeaponPistol` entries use `Weight`, durability, and ammo.
- `Consumable` entries use `Chance` and `MinCount`/`MaxCount`.

### Rank and difficulty gating
- `PlayerRank` appears as a single rank or a list (comma-separated).
  - Example patterns: `ERank::Newbie`, or `ERank::Newbie, ERank::Experienced`.
- `Diff` appears as either:
  - `EGameDifficulty::Easy, EGameDifficulty::Medium, EGameDifficulty::Hard`, or
  - `EGameDifficulty::Stalker`.
- See `RankSystemSpec.md` for more info.

### Generator naming conventions
- `GeneralNPC_*`: general NPC equipment generators (largest group).
- `GuardNPC_*`: guard/escort style NPC generators.
- `GeneralZombie_*`: zombie loadouts.
- `Trader_*`, `Bartender_*`, `Medic_*`, `Technician_*`: vendor inventories.
- Location-specific vendors: `Rostok*`, `Yanov*`, `Pripyat*`, `Sultansk*`,
  `Shevchenko*`, `Malakhit*`, `Zalesie*`, `Terricon*`, `Ikar*`, `Asylum*`, etc.

These naming patterns indicate intended usage and where the generator is
referenced elsewhere (spawns, traders, quests).

### Usage patterns (examples)
#### Dynamic trader generator
`DynamicTraderItemGenerator` uses `bAllowSameCategoryGeneration`,
`ReputationThreshold`, and `RefreshTime` per entry. Its `PossibleItems` are
weighted and use durability and ammo ranges. This is a canonical pattern for
shop inventories.

#### NPC consumables
`GeneralNPC_Consumables` (and variants by role/faction) use:
- `Category = Consumable`
- `Diff` and `PlayerRank` gating
- `Chance` with `MinCount`/`MaxCount`

#### Sub-generator composition
Many generators include:
- `Category = SubItemGenerator`
- `PossibleItems` with `ItemGeneratorPrototypeSID` and `Chance`

This allows composition of loadouts from other generators (for example, a
weapon pool generator can reference a pistol generator by SID).

### Data quirks and pitfalls
- The file contains a typo variant `AmmoMaxcount` (lowercase `c`)
  alongside `AmmoMaxCount`. There are three occurrences. When parsing,
  treat them as the same field or normalize them.
- `Weight` and `Chance` are used to determine probability of spawning the item on NPC.
- `Weight` corresponds to priority of item spawning, where equal weight means items have equal priority.
- `Chance` is a roll if item should spawn or not. `Chance = 1` means item can't fail a roll.
- Some entries omit `PlayerRank` or `Diff`; those should be treated as
  unconditioned for that axis.

### Implementation guidance (modding)
- Prefer adding new generators by following existing naming patterns
  (`GeneralNPC_*`, `Trader_*`, etc.).
- Use `SubItemGenerator` for composition rather than duplicating large lists.
- Keep `RefreshTime` in trader generators to allow item rotation.
- When changing durability/ammo ranges, preserve balance across ranks
  (Newbie/Experienced vs Veteran/Master entries are often split).

## QuestItemGeneratorPrototypes
This section describes quest- and NPC-specific generators defined in
`GameLite/GameData/ItemGeneratorPrototypes/QuestItemGeneratorPrototypes.cfg`.
These generators are referenced by quest nodes and quest NPC prototypes, and
frequently inherit from dynamic generators with targeted overrides.

### Primary usage
- Quest nodes reference these generators via `QuestItemGeneratorSID` in
  `GameLite/GameData/QuestNodePrototypes/*.cfg`.
- Quest NPC generator prototypes reference them via
  `GameLite/GameData/ItemGeneratorPrototypes/QuestNPCGeneratorPrototypes/*.cfg`.
- Stash/body templates are referenced from
  `GameLite/GameData/ItemGeneratorPrototypes/QuestStashBodyItemGeneratorPrototypes/`.

### Structural patterns
- Uses the same `ItemGeneratorPrototype` schema as dynamic generators.
- Many entries are declared with `refurl`/`refkey` to inherit from
  `DynamicItemGenerator.cfg` and then override `ItemGenerator` categories or
  `PossibleItems` lists as needed.
- A small number of generators reference the base empty template in
  `ItemGeneratorPrototypes.cfg` (e.g., `EmptyQuest`).
- Some quest stash/body generators reference
  `QuestStashBodyItemGeneratorPrototypes/Template_QuestStashBodyItemGenerator.cfg`,
  which itself points at `ItemGeneratorPrototypes.cfg`.

### Common category usage (observed)
Quest generators reuse the same category enum as dynamic generators. Frequently
seen categories include:
- `WeaponPrimary`, `WeaponPistol`
- `BodyArmor`, `Head`
- `Consumable`
- `Ammo`
- `SubItemGenerator`
- `None` (for empty/placeholder generators)

### Naming conventions
- Many SIDs are NPC- or quest-specific (e.g., `ZalesieBartender_ItemGenerator`,
  `Bandit*_ItemGenerator`, `Varta*_ItemGenerator`, or quest stash body SIDs).
- Suffixes like `_ItemGenerator` are consistent and expected.

### Data quirks and pitfalls
- Because of `refurl` inheritance, overrides may be partial. When inspecting a
  quest generator, resolve the base generator first, then apply overrides.
- Some entries exist solely as named references to shared templates; they may
  have no additional fields beyond `SID`.

### Implementation guidance (modding)
- Prefer referencing an existing dynamic generator and override only the
  necessary categories for the quest/NPC.
- Use quest generators for one-off items tied to a quest node rather than
  changing the global dynamic pools.
- Keep placeholder/empty generators (`EmptyQuest` style) for scripts that
  require a generator SID but should produce no items.
