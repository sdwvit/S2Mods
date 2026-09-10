# NPC Corpse Looting

What an NPC actually does with items it finds on a corpse: which items it will
take, what "better gun" means to it, and what it categorically cannot do.

All findings below were read out of the **retail** shipping binary
(`<STALKER2_FOLDER>/Stalker2/Binaries/Win64/Stalker2-Win64-Shipping.exe`,
174,730,288 bytes, mtime 2026-08-28) unless a line says otherwise. Addresses are virtual
addresses in that build and will not survive a patch — the *names* and the
*mechanism* will.

## Summary

| Question | Answer |
|---|---|
| Do NPCs swap to a better **gun** after looting? | Yes — but "better" means **higher price**, nothing else. |
| Do NPCs swap to a better **armor**? | **No.** No comparison, no equip path, and armor is welded to the spawn-time appearance mesh. |
| Do NPCs **repair** gear they pick up? | **No.** Broken gear is never even picked up, and no repair code is reachable from AI. |

There is exactly one looting goal in the whole AI: `ProcessCorpseGoal`. Grepping
the retail goal-name set turns up nothing armor-, artifact- or grenade-related.

---

## The corpse scan

Entry point is the caller at `0x140b0b7f8`, which reads `AISettings` and runs the
scan twice: once over the corpse's inventory, and — if
`AllowWeaponPickupWhenLooting` is set and the corpse has an associated dropped
weapon within `WeaponLootDistance` — once over that weapon.

The scan itself (`0x140b0ebd5`) first walks the NPC's **own** inventory
computing `max(GetPrice(x))`, then walks the corpse's items:

```c
// first pass over own inventory
maxPriceOfMyOwnItems = max(GetPrice(x) for x in self.inventory);   // 0x140c2309a = GetPrice

// second pass over the corpse's items
for (item in corpse.inventory) {
    if (!CanLoot(item)) continue;                        // 0x14042eae9
    if (itemClass == 0 /* weapon */) {
        if (AllowWeaponPickupBasedOnPrice
            && Price(item) > maxPriceOfMyOwnItems)  -> take-list
        else if (Durability(item) > cvar_LowDurabilityPercentage) -> take-list
        else -> item-container op                        // 0x142f819ec (detach/drop)
    } else {
        -> take-list
    }
}
// then a second loop processes the take-list                       // 0x140b0f2ea
```

`itemClass` is the prototype field at `+0xD0`. `itemClass == 0` ⇒ Weapon is
**inferred** from the `AllowWeaponPickupBasedOnPrice` gate sitting on that
branch, not read out of an `EItemType` name→value table.

### "Better gun" == more expensive gun

The only ranking function in that path is `GetPrice` (`0x140c2309a`). There is no
read of damage, accuracy, calibre, wear, or ammo compatibility. An NPC will trade
a functioning rifle for a pricier one it cannot feed.

Practical consequence for modders: **item price is the NPC weapon-preference
curve.** Rebalancing `Cost` on weapon prototypes silently rebalances what NPCs
carry after a firefight.

### The durability gate

`CanLoot()` (`0x14042eae9`) rejects any durability-bearing item whose durability
is below the cvar `gsc.ItemLootHelper.LowDurabilityPercentage`:

- registered at `0x143fcd1b4`, default immediate `0x3dcccccd` = **0.10**
- help text: *"Describes the low durability percentage of items that can be picked up."*

"Durability-bearing" is the predicate at `0x14042ebf8`: `proto->field_0xD0 < 2`,
i.e. the two classes that have durability — weapons and armor.

`CanLoot()` also rejects on two flag checks before that: a prototype flag
(`proto+0xD4 & 0x10`) and an instance flag (`item+0x41 & 2`) — the
quest/unlootable exclusions. Items with **no** durability (ammo, consumables,
artifacts) skip the durability test entirely and are lootable.

---

## Why armor cannot be swapped

Three independent reasons, in increasing order of how hard they'd be to mod
around:

1. **No comparison.** The `itemClass != 0` branch has no ranking step at all —
   no protection-value read, no armor-slot write, no equip call.
2. **No equip path.** Nothing in the AI modules calls an equipment-slot setter.
   The `EInventoryEquipmentSlot` machinery is driven from the player inventory UI.
3. **Armor is welded to the appearance mesh at character generation.** The
   generator at `0x1408c7af6` logs, at `0x149774c18`:

   > `Character has generated body armor item with SID %s for NPC obj prototype %s, but mesh generator %s has no appropriate body armor. Logic item and visual appeaarence are differ.`

   Armor prototypes carry an `NpcMeshGenerator` block for exactly this. Changing
   an NPC's outfit at runtime means regenerating its appearance; no such path
   exists. See `NPCArmorMeshSystemSpec.md` for how that binding works.

---

## Why repair never happens

1. Broken gear is filtered out before it is ever taken — the 10% durability gate
   above.
2. No repair code is reachable from AI. Every repair symbol in retail is
   economy/UI: `Repair_Cost`, `BaseRepairCostModifier`,
   `ReputationRepairCostModifiers`, `ArmorSellMinDurability`,
   `DurabilityBeforeRepair`, `URepairPriceWidget`. The one code-side entry,
   `RepairItem` (`0x14974bd5c`), is registered in a debug-command table at
   `0x143988602` alongside `UpgradeItem`, `UninstallUpgrade`, `SetZoom` and
   `FocusOnPlayer`.

---

## Tuning knobs

Three hand-parsed `AISettings` fields drive the behaviour. All three appear
**only** in the UTF-16 string dump of the retail binary and not in the ASCII
reflection data — meaning they are read by a hand-written prototype parser, so
they have no `UPROPERTY`, no editor exposure and no validation:

| Config field | Retail global | Type |
|---|---|---|
| `WeaponLootDistance` | `0x149edd110` | float |
| `AllowWeaponPickupWhenLooting` | `0x149edd10c` | bool |
| `AllowWeaponPickupBasedOnPrice` | `0x149edd13c` | bool |

Parser assignments are at `0x140bd9e7e`, `0x140bd9ea2` and `0x140bd9ec4`
respectively (a flat chain of `TryGetField(name)` → store-to-global).

Plus the cvar:

| Cvar | Default |
|---|---|
| `gsc.ItemLootHelper.LowDurabilityPercentage` | `0.10` |

The shipped **values** for the three config fields live in the retail `.pak`'s
`AIGlobals.cfg` under `AISettings`. The ZoneKit copy of that file reads:

```
WeaponLootDistance = 300.0
AllowWeaponPickupWhenLooting = true
AllowWeaponPickupBasedOnPrice = true
```

⚠️ **ZoneKit is a different (older) code revision than retail.** The field names
above are verified in retail; these three numbers are ZoneKit-derived and are
indicative only. Read them from the retail `.pak` before relying on them.

---

## Not verified

- Whether an armor item that lands in the take-list is ever *equipped*. No equip
  call was found on that path, but only the two-pass loot function and its
  direct helpers were read — not every consumer of the take-list.
- Callers and frequency of the corpse scan. So "how often" and "under what
  conditions an NPC decides to loot at all" is still open.
- `itemClass == 0` ⇒ Weapon, as noted above, is inferred from the surrounding
  gate rather than from the enum table.
- The exact semantics of `0x142f819ec`. It is an item-container operation — it
  carries the log string *"ItemUID=%d has invalid itemcontainer or no
  itemcontainer"* and is called with a destination container id of `-1`
  (`INDEX_NONE`), which reads as detach/drop — but this was not confirmed.
- Artifact auto-equip and grenade selection (`bAutoEquipArtifacts`,
  `GrenadePrototypes`) were out of scope for this pass.

## Method

See the `ue-shipping-binary-re` skill. In brief: extract strings twice
(`strings -n 5` and `strings -el -n 5` — reflection names land in ASCII, config
and cvar names land in UTF-16), locate config fields by their parser
`lea rdx,[name]` sites, follow the store-to-global, then xref the global to find
readers. Keep one full `objdump -d -j .text -M intel` on disk and grep it
repeatedly rather than re-disassembling per address.
