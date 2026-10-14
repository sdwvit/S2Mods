# Detecting whether another mod is installed

A mod (the **consumer**) can check from quest logic whether another mod (the **provider**) is
installed. The provider puts a flag effect on the player every time a world loads. The consumer
checks for that effect with an `If` node.

Source cfgs:
- `EffectPrototypes.cfg`: the provider's flag effect.
- The consumer's quest-node cfg: the `If` node and its two branches.

Example: HeadlessArmors (provider) and WolfArmorFetch (consumer).

## Every mod is a provider

Steps 1-3 are automatic. `src/announce-installed.mts` gives every mod the flag effect and the
blueprint when its `prepare-configs` runs, except the repacks, NodeBridge and the test mods
(`NOT_ANNOUNCED`). Mods pick it up on their next build; nothing is recooked in bulk.

- `src/announce-installed-raw.mts` writes the blueprint into `raw/` before `mod-meta-paths.mts`
  classifies `raw/`, so a cfg-only mod becomes a split mod (`<Mod>` assets, `<Mod>Cfg` cfgs) on that
  same run. From then on it needs `cook-inject`; `pack-inject` no longer covers it.
- `pullAssets()` writes the SDK copy, renamed to `/<SdkMod>/announce_mod_is_active`, then the
  subsystem list picks it up (step 3).
- The template is `src/localization/fixtures/announce-mod-is-active.uasset`, a copy of HeadlessArmors'
  blueprint. HeadlessArmors itself is never overwritten: edit the blueprint there in the Mod
  Editor, then copy it over the fixture.
- The renamer (`renameLocalizationPackage`) also rewrites the asset registry's
  `GeneratedClass` tag, which spells the package inside an object path.

## Step 1: the provider declares a flag effect

Add a permanent `FlagEffect` named `<ProviderMod>Installed` to `EffectPrototypes.cfg`. Vanilla
`FaustPsyResist` is the template:

```
HeadlessArmorsInstalled : struct.begin {refkey=[0]}
   SID = HeadlessArmorsInstalled
   Text = HeadlessArmorsInstalled
   Type = EEffectType::FlagEffect
   bIsPermanent = true
   DuplicationType = EDuplicateResolveType::KeepOld
   ShowUpgradeEffect = false
struct.end
```

- `bIsPermanent = true`: the flag never expires.
- `DuplicationType = KeepOld`: the blueprint applies the effect on every world load. The `[0]`
  default is `KeepAll`, which would stack a copy per load.
- It goes in its own file, `EffectPrototypes_patch_<SdkMod>Installed.cfg`, written by
  `writeInstalledEffectCfg` after the transformers. A transformer of the mod's own that patches
  `EffectPrototypes.cfg` writes `EffectPrototypes_patch_<Mod>.cfg`, so the two never collide.
- In TypeScript, export the SID so consumers can import it: `installedEffectSid("<SdkMod>")`, as in
  `Mods/HeadlessArmors/installed.mts` (`INSTALLED_EFFECT_SID`).

## Step 2: the provider applies it with a blueprint

Create a Blueprint Class with parent **`ModWorldSubsystem`** (`Stalker2.ModWorldSubsystem`) in the
mod's plugin content. HeadlessArmors uses `/HeadlessArmors/announce_mod_is_active`.

Graph:

```
Event OnWorldBeginPlay (World)
  └─ Branch: GetDisplayName(World) != "MainMenuMap"
       True ─► Delay 1.0 s ─► IsValid(GetPlayerCharacter(0))
                  ▲               ├─ Is Valid ─► Execute Console Command (Command = SID string below)
                  └───────────────┴─ Is Not Valid (retry)

SID string:
  Self ─► Get Class ─► Get Soft Class Reference ─► To String (Soft Class Reference)
       ─► Get Path ─► Right Chop (Count = 1)
       ─► Append("XApplyEffectOnPlayer ", <that>, "Installed")
```

- Every world except the main menu passes the branch. This includes the open world
  (`WorldMap_WP`) and the playable logic levels a save can load into. Gating on `== "WorldMap_WP"`
  would leave the flag off in those levels.
- The player character spawns after `OnWorldBeginPlay`. The Delay/IsValid loop retries every 1 s
  until the player exists. A world without a player just keeps polling.
- The blueprint derives the SID from its own class path:
  `/HeadlessArmors/announce_mod_is_active.announce_mod_is_active_C` → `Get Path` →
  `/HeadlessArmors` → `Right Chop 1` → `HeadlessArmors` → `XApplyEffectOnPlayer HeadlessArmorsInstalled`.
  So one blueprint works in any mod: a copy renamed into `/<SdkMod>/` announces `<SdkMod>Installed`
  with no graph edits. For a split mod the blueprint sits in the assets half, which keeps the plain
  mod name, so the flag never gets a `Cfg` suffix. A mod with `sdkModNameOverride` announces under
  its SDK name.
- `Get Path Name` isn't offered on the `Class` pin in this SDK; the soft class reference route gives
  the same string.
- `XApplyEffectOnPlayer <EffectPrototypeSID>` is a stock console command (see
  `stalker_commands.txt`). The SID it builds must match the effect from step 1.

## Step 3: the blueprint gets registered

The game only creates `ModWorldSubsystem` classes listed in a **`ModWorldSubsystemDataAsset`**. A
blueprint that isn't listed never runs.

The build generates that asset: `src/world-subsystem-data.mts`, called at the end of `pullAssets()`
(so on every `prepare-configs` and `cook-inject`). Adding a subsystem only takes the blueprint: save
it in the Mod Editor, then run `cook-inject`.

- It lists every blueprint in the mod's `Content` that imports `Default__ModWorldSubsystem` (its
  parent's defaults, so a direct child of `ModWorldSubsystem`) as `/<SdkMod>/<path>.<Name>_C`, for
  example `/HeadlessArmors/announce_mod_is_active.announce_mod_is_active_C`.
- It writes `Autogenerated_<n>_WorldSubsystemData.uasset` into both `raw/` and the SDK mod. It keeps
  the name already in use, else derives a stable number from the mod name. Files are only rewritten
  when their bytes change, so an unchanged mod keeps its cook fingerprint.
- It removes extra lists, and removes the list entirely once the mod has no subsystem blueprints.
- It leaves lists it can't read alone (the ShaysDistantHorizons repacks ship two from an older
  engine version).
- The writer is `writeWorldSubsystemData` in `src/localization/uasset.mts`.

The Mod Editor generates the same asset when it packages a mod; the CLI cook skips that step. Don't
create it by hand: its only field, `UPROPERTY() TArray<FString> ModWorldSubsystems`, has no
`EditAnywhere`, so the Details panel can't fill it in.

### How the game finds it

`UModAssetSupportSubsystem` (`/Script/Stalker2`) walks every file in every mounted pak and matches
the file name against five suffixes (case-insensitive *ends with*). A match sends the file to that
data asset type's loader:

| Data asset class | File name must end with |
|---|---|
| `ModLocalizationDatabaseDataAsset` | `_LocalizationDatabase` |
| `ActorReplacementDataAsset` | `_ActorReplacementData` |
| `ModActorDeletionsDataAsset` | `_ActorDeletionsData` |
| `ModActorPatchesDataAsset` | `_ActorPatchesData` |
| `ModWorldSubsystemDataAsset` | `_WorldSubsystemData` |

Only the name's ending matters, so the asset can live in any folder of the mod's content.

## Step 4: the consumer checks for the effect

Use one `If` node with an `Effect` condition on the player (`TargetCharacter` = the all-`A` player
GUID, `PLAYER_GUID` in `Mods/WolfArmorFetch/nodes.mts`). Vanilla uses the same shape, for example
`E08_MQ05_C02.cfg` checking `FaustPsyResist`:

```
WolfArmorFetch_If_HeadlessArmors : struct.begin
   NodeType = EQuestNodeType::If
   Conditions : struct.begin
      [0] : struct.begin
         [0] : struct.begin
            ConditionType = EQuestConditionType::Effect
            ConditionComparance = EConditionComparance::Equal
            TargetCharacter = AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
            EffectPrototypeSID = HeadlessArmorsInstalled
            RequiredSquadMembers = ERequiredSquadMembers::AllMembers
         struct.end
      struct.end
   struct.end
struct.end
```

- **`True` pin:** the player has the flag, so the provider is installed. Take the provider branch.
- **`False` pin:** no flag. Take the default branch. This includes a provider that isn't installed,
  where the effect SID doesn't exist at all.
- If the quest continues after the branch, launch the next node from both actions (two launchers,
  any one is enough).
- In TypeScript, import the SID from the provider so the two mods can't drift apart. Importing a
  TypeScript constant is fine. Depending on the provider's generated `raw/` structs is not (see
  AGENTS.md).

## Rules

- **Make each branch a single action.** Don't add the default and then remove or swap it when the
  provider shows up. A swap made while the player watches a container glitched: the old item was
  still shown but couldn't be picked up.
- **Keep provider-only SIDs on the provider branch.** WolfArmorFetch's
  `WolfArmorFetch_StashRewardHeadless` generator names `Exoskeleton_Neutral_Armor_headless`, which
  only exists with HeadlessArmors. That's harmless, because only the provider branch uses it.
- **Never check the flag and a provider-only SID in the same node.** An `ItemInInventory` (or any
  condition) naming an item that doesn't exist nulls the whole node when the provider is absent,
  so the `Effect` check in it is lost too. Put the provider-only check in its own node, launched
  from the flag check's `True` pin. Without the provider, only that unreachable node is lost. If a
  dialog option depends on it, have the nodes set one of your own global variables and gate the
  option on that variable.
- **Don't check right at load.** The flag lands at least 0.5 s after the world begins play. Check at
  a point in the quest the player reaches later (a dialog, a pickup), never on a node that fires as
  the save loads.
- **Don't let the consumer define the provider's effect.** Two mods defining the same root SID makes
  the result depend on load order.
- **Don't remove the flag from quest logic.** The consumer would read the provider as missing.
- **Don't use a global variable as the flag.** An `If` on a global variable that doesn't exist
  fires `True` whatever value it compares, so a `== true` check passes without the provider.
