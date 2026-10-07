# FireModeUpgrades: tier-3 placement

Source configs, relative to the SDK's `Stalker2/Content/GameLite/GameData`:

- `UpgradePrototypes.cfg`: coordinates, target parts, prerequisites, blocking rules and connection lines.
- `WeaponData/WeaponGeneralSetupPrototypes.cfg`: weapon fire modes and upgrade lists, including unique variants.
- `NPCPrototypes.cfg`: technician offerings and their `Enabled` states.
- `QuestNodePrototypes/Kazkovy_Hub.cfg`: toolbox-dependent technician unlocks.
- `EffectPrototypes.cfg`: fire-mode replacement effects.

Schema: `node_modules/s2cfgtojson/dist/types.d.mts` (`UpgradePrototype` and `WeaponGeneralSetupPrototype`). The installed 9.0.1 package ships compiled JS and declarations rather than the old root `types.mts`.

## Placement and dependencies

`HorizontalPosition` is zero-based: 0, 1 and 2 correspond to tiers 1, 2 and 3. `UpgradeTargetPart` selects a weapon part's upgrade tree, and `VerticalPosition` selects its top or bottom cell. Validate the cell against the weapon's own `UpgradePrototypeSIDs`, excluding `IsModification` attachment entries, which have a separate display.

Vanilla next-tier upgrades list both mutually exclusive previous-tier upgrades in `RequiredUpgradePrototypeSIDs`. This is the configuration convention for allowing either predecessor; do not interpret those lists as requiring both mutually blocking upgrades. Copy the same-part tier-2 pair for a new tier-3 upgrade. Vanilla top cells use `ConnectionLines = [EConnectionLineState::Down]` and bottom cells use `[EConnectionLineState::Top]` when connecting to both predecessors.

| Weapons | Fire-mode upgrade position | Tier-2 prerequisite branch | Technician/toolbox anchor |
| --- | --- | --- | --- |
| GP37 V2 | Stock, tier 3, top | GP37 stock | `GunG37_Upgrade_Stock_2_1` |
| APSB / Encourage | Grip, tier 3, bottom | APB grip | `GunAPB_Upgrade_Grip_3` |
| M10 Gordon / Gangster | Grip, tier 3, bottom | M10 grip | `GunM10_Upgrade_Grip_2_1` |
| SVU-MK S-3 / Whip | Stock, tier 3, top | SVU stock | `GunSVU_Upgrade_Stock_3` |

The new upgrades do not block the existing tier-3 upgrade in the opposite cell. Costs and fire-mode effects are preserved.

## Anomalies found

The original SVU fire-mode upgrade targeted `Body`, while both SVU and Whip have no vanilla non-modification upgrade branch for that part. This is the likely reason for its missing display; the new stock position uses an existing branch. Both SVU grip tier-3 cells are already occupied, so moving it to the grip would introduce a collision.

The original GP37 V2 upgrade used tier 2 and body tier-1 prerequisites. The other three additions inherited tier 1, had no real upgrade prerequisites, and all four inherited the template's `ConnectionLines::None`. The correction gives every addition a free tier-3 cell and explicit connections to an existing tier-2 branch.

APB body positions are unusual: the mutually blocking `Body_1_1` and `Body_1_2` use horizontal positions 0 and 1 respectively. The correction uses the regular grip branch instead. M10 grip tier 2 requires `Blueprint_M10_Upgrade_1`; the new tier-3 upgrade retains that progression indirectly through its predecessors.

## Validation on 2026-10-07

`S2_MOD=FireModeUpgrades SKIP_SDK_PUSH=1 npm run prepare-configs` succeeded using Node 24.3.0: five transformers, 21 structs in five generated cfg files. The shared localization helper still synchronizes localization assets into the SDK mod even with `SKIP_SDK_PUSH=1`; that step required filesystem approval. No cook, game injection or publishing was performed.

A generated-patch audit using the project cfg loader and fresh SDK parses passed for all four upgrades and seven weapons. Checks covered free cells on existing parts, both prerequisite paths, preservation of vanilla fire modes, unique upgrade references, bpatch array indices, technician states and toolbox unlocks. GP37 V2 and M10 each matched four technician structs and three toolbox nodes; APB matched three technicians and two nodes; SVU matched two technicians and one node. Images and icons reuse references found in vanilla `UpgradePrototypes.cfg`; loose texture assets were not available for inspection in the local SDK tree.

This is configuration validation. Technician display and purchase behavior still require an in-game check of the packaged build.
