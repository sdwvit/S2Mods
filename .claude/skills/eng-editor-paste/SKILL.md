---
name: eng-editor-paste
description: Produce text the Mod Editor accepts via Ctrl+V / Details-panel Paste - skeleton sockets (SocketCopyPasteBuffer) and AnimCollection maps (AttachingBySID, ShootingWithScope) - and recover sockets from an older or backed-up .uasset. Use when the user asks for copy-paste text for sockets, attach animations, or any editor property, or needs to restore sockets onto a fresh vanilla checkout.
---

# Editor copy-paste text

Writing editor assets from scripts is not supported. The fast path for restoring or adding data
on a fresh vanilla checkout (Mod Editor checkout tool) is to hand the user text they paste in.
Both formats below were pasted successfully into the 2.0 Mod Editor (TOZ-34 scopes, 2026-10-09).

## Skeleton sockets

Select any bone in the skeleton tree and press Ctrl+V. Each socket lands on its `BoneName`.

```
SocketCopyPasteBuffer
NumSockets=<n>
IsOnSkeleton=1
Begin Object Class=/Script/Engine.SkeletalMeshSocket Name="SkeletalMeshSocket_0"
   SocketName="X2ScopeSocket"
   BoneName="jnt_ejector"
   RelativeLocation=(X=3.838991,Y=-0.006127,Z=3.153408)
   RelativeRotation=(Pitch=0,Yaw=0,Roll=0)
   RelativeScale=(X=0.8,Y=0.8,Z=0.8)
End Object
IsOnSkeleton=1
Begin Object ...
```

`NumSockets` must match the block count. Generate it from an asset instead of typing values:

```
node .claude/skills/eng-editor-paste/scripts/socket-paste.mts <SKEL.uasset> [baseline.uasset]
```

With a baseline (the vanilla skeleton, or the mod's current one) it prints only sockets missing
from the baseline. Sources for an old copy: the SDK mod folder, `git show <rev>:Mods/<Mod>/raw/...`,
or a backup tree. Works on both legacy UE5 1008 (5.1 SDK) and 1013 (2.0 SDK) assets - the repo
parser `src/localization/uasset.mts` reads only headers of 1008 files, so the script parses
legacy socket tags itself. Rotator doubles are serialised Pitch, Yaw, Roll.

## AnimCollection maps (`PlayerFirearmAnimCollection`)

Attach animations live in `AnimCollection_fp_<gun>` under
`_STALKER2/Animations/Weapons/<class>/<gun>/AnimCollections/`. Third-person collections are not
needed for scope attaches. Right-click the map header in the Details panel -> Paste. That
**replaces the whole map**: Copy the header first and merge with any existing entries.

`InternalAnimations.AttachingBySID` - `Map<String, AttachDetachAnimations>`, key = attach SID:

```
(("RU_X2Scope_1",(AttachAnimation=(Character="/Script/Engine.AnimMontage'/Game/_STALKER2/Animations/Player/AnimSequences/shg/d12/Attaches/MG_fp_d12_sight_x2_attach.MG_fp_d12_sight_x2_attach'",Weapon=None,PlayRate=1.000000))),("RU_ColimScope_1",(AttachAnimation=(...))))
```

`AttachDetachAnimations` fields: `AttachAnimation`, `DetachAnimation`, `DetachTwinMagazineShifted`
(each a `CharacterWeaponAnimations`), `AttachAnimBlueprint`. Omitted fields keep defaults; vanilla
scope entries fill only `AttachAnimation`.

`InternalAnimations.ShootingWithScope` - `Map<Name, CharacterWeaponAnimations>`:

```
(("RU_X2Scope_1",(Character="/Script/Engine.AnimMontage'/Game/.../MG_fp_d12_shoot_aim_scope_x2.MG_fp_d12_shoot_aim_scope_x2'",Weapon=None,PlayRate=1.000000)),(...))
```

`CharacterWeaponAnimations` fields: `Character` (player-hands montage), `CharacterLeftHand`,
`Weapon` (weapon montage), `PlayRate`. A single struct value pastes onto one field the same way:
`(Character="...",Weapon=None,PlayRate=1.000000)`.

Rules for borrowing animations from another gun:
- `Character` montages (player skeleton) can be borrowed across guns, but only between guns held
  the same way. Rifle attach montages on the TOZ-34 (2026-10-11) moved the scope through the gun
  body and posed the fingers for an AK grip; the hands carry the scope to where *that* gun's
  receiver is.
- **Never leave an attach entry's `Weapon=None`.** Every working vanilla entry has a weapon
  montage, and with none the attach state never ends: the gun stays uninteractable until
  re-equipped (TOZ-34, 2026-10-10). The weapon montage must be on the gun's own skeleton; a gun
  with no attach animation of its own can use its vanilla equip montage (`MG_<gun>_fp_equip`).
- The scope is shown and mounted by `AnimNotify_AttachItem` markers on the **hands** montage
  (`AttachAction = JoinAttachToHand`, then `RemoveAttachFromHandAndAttachToWeapon`), followed by
  `AnimNotify_WeaponAction` `UnlockLeftHandIdle`. Without them the scope pops on when the montage
  ends. To give a gun with no attach animation a clean one: new montage on `SK_stalker_Skeleton`,
  its own `AS_fp_<gun>_equip` sequence, slot `MainActionSlot`, and those three markers copied
  (Ctrl+C/Ctrl+V on the Notifies track) from a vanilla attach montage, both AttachItem markers in
  the first ~0.1 s while the gun is lowered. Markers on a gun-skeleton montage do nothing.
- The montage editor previews only `DefaultSlot`; on `MainActionSlot` it shows a T-pose. Place
  markers with the slot set to `DefaultSlot`, then switch back before saving.
- `ShootingWithScope` entries borrowed from other guns pose the hands for that gun while aiming;
  with no matching animation, use the gun's own `MG_fp_<gun>_shoot_aim` / `MG_<gun>_fp_shoot_aim`.
- Find candidates in `.asset-registry-cache.json` (paths are lowercased there; the editor
  resolves them case-insensitively), e.g. `grep -oE '"/game/_stalker2/animations/player/animsequences/shg/[^"]*sight[^"]*"'`.
  Montages are the `MG_*` entries; `AS_*` are the sequences behind them.

## Getting the exact shape of any other property

When a format is not listed here, ask the user to right-click the property (or one existing
element) -> Copy and paste the text back; match that. To read current values from a 1013 asset,
`parseUasset` from `src/localization/uasset.mts` returns tagged properties, with object refs as
negative import indices (`imports[-v - 1]`).
