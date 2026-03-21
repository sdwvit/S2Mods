# MoreSideQuestOptions

## Problem

Vanilla STALKER 2 RSQ (Repeatable Side Quest) vendors have two limitations:

1. **Random selection**: NPCs randomly offer 1 of N available quests per visit, hiding the rest.
2. **Single quest at a time**: The vendor dialog can only show "I want a job" OR "cancel job", never both. This means the player can only have 1 active quest per vendor.

Additionally, the mutant parts quest (EQ197) gates loot-turn-in options behind a random global variable instead of checking whether the player actually has the items.

## Solution

### RSQ vendors (RSQ01-RSQ10)

Replace the vanilla "want a job" / "cancel job" binary with a new dialog menu offering three choices:

1. **Take a new job** - shows all available quests (filtered by which are already active)
2. **Cancel an existing job** - shows all in-progress quests (inverse conditions)
3. **Back** - return to the previous menu

This requires changes at three levels:

- **Dialog chains**: Create a new `_MoreSideQuestOptions` chain per vendor to host the menu
- **Dialog prototypes**: Build the hub/sub-menu/cancel dialog tree inside that chain
- **Quest nodes**: Bypass the Random picker with a Technical pass-through, raise the quest count cap, add cancel cleanup infrastructure, and wire hub NPCs to the new chain

RSQ07 (Cement Factory Barmen) and RSQ08 (Rostok Barmen) share the same NPC, so they get a combined dialog chain with an extra branch-selection hub.

### Mutant parts fix (EQ197)

Replace the random global variable gates with `ItemInInventory` checks so all 14 mutant loot turn-in options appear when the player has the required items.
