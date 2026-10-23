# Plan: X8 + X16 for every long-range gun

Goal: every gun below takes a removable `X8` and `X16` scope, with attach animations, aim poses and
inventory icons. Existing guns get their animation gaps closed.

## Audit (2026-10-22)

Sources: vanilla `AnimCollection_fp_*` / skeletons from `Content/Paks/FullEditor-WindowsModEditor.pak`,
mod copies from `SDK/Stalker2/Mods/X16Scopes/Content`.

### Guns already in the mod: what's missing

| Collection | X8 attach | X16 attach | X8/X16 aim (`ShootingWithScope`) |
|---|---|---|---|
| dnipro, gp37, gvintar, kharod, lavina, m16, SharpShooter, svu, svdm | yes | yes | **missing** (vanilla Mark/SKP have X8 aim entries) |
| launcher variants (`*_GrenLauncher`, `*_BuckLauncher`) | not needed: tested 2026-10-22, attach animations play correctly with a launcher fitted | | |

Unique guns have no collections of their own: Sotnyk uses dnipro, Merc gvintar, Trophy lavina,
Whip svu, Lynx svdm, Unknown/SOFMOD m16.

### New guns

| Setup SID(s) | Family | Skeleton (sockets now) | Collections | X4 attach montage to clone |
|---|---|---|---|---|
| `GunMark_SP` | EN | `SKEL_mar` (X4, X8) | mark | has vanilla X8 → clone `MG_fp_mark_x8_sight_attach` for X16 |
| `GunSKP_DMR_GS` | EN | `SK_Skp_Skeleton` (X4, X8) | skp | has vanilla X8 → clone `MG_FP_Player_Skp_Attach_EnX8Scope01_01` for X16 |
| `GunGP3A_DMR_GS` | EN | `SKEL_Gp3a` (X4) | gp3a | `MG_FP_Player_Gp3a_Attach-EnX4Scope01_01` |
| `GunArev_ST_GS`, `GunArevPrecise_AR_GS` | EN | `Sk_arev_Skeleton` (X4, X8) | Arev | `MG_FP_Player_Arev_Attach-EnX4Scope01_01` |
| `GunM701_SP` | EN | `SK_m701_Skeleton` (X8 only) | m701 | **none**: the M701 has no scope attach animation at all |
| `GunFora_ST`, `Gun_Decider_AR_GS` | EN | `SKEL_fora0` (X4) | fora | `MG_fp_fora_sight_x4_attach` |
| `GunGrim_ST`, `Gun_S15_AR` | EN | `SK_grim0_Skeleton` (X4) | grim | `MG_fp_grim_sight_x4_attach` |
| `GunAK74_ST`, `Gun_Combatant_AR_GS`, `Gun_Drowned_AR_GS` | UA | `SK_AK74_Skeleton` (X4) | AK74 | `MG_fp_ak74_sight_x4_attach` |

Children with `{bskipref}` CompatibleAttachments (Decider, S15, Combatant, Drowned, ArevPrecise)
need their own map entries; they don't inherit the parent's patch.

## Decisions (2026-10-22)

- [x] **Built-in scopes** become regular, detachable scopes (MasterMod's `uniqueAttachmentsToAlternatives`):
      M701/Arev Precise/Sharpshooter → `EN_X8Scope_1`, SVU/Whip → `RU_X8Scope_1`,
      Gvintar/Merc/SVDM/Lynx → `RU_X4Scope_1`. Built-in red dots and X2s too. Sotnyk's scope → `RU_X2Scope_1` with the Sotnyk mesh on the gun's entry; its aiming-time bonus moved onto the Sotnyk item.
- [x] **M701 attach animation**: new montage from `AS_fp_m701_equip` + the three attach notifies.
- [x] **Icons**: closest vanilla icon as placeholder; you make the real ones later.

## Automatic (cfg + scripts, I do these)

- [x] `xNCompatibleScopeByWeapon.mts`: entries for every setup SID above (X16 only for Mark/SKP,
      which have vanilla X8). AK74 family = UA (`RU_X8Scope_1` / `UA_X16Scope_1`), rest EN.
- [x] `meta.mts`: built-in scopes detachable (`makeFixedScopesDetachable`); new entries clone the gun's own X4/X8 entry (`template`).
- [x] `meta.mts`: add Fora, Decider, Grim, S15, AK74, Combatant, Drowned to `SKIF_ALLOWED_WEAPON_SIDS`, plus the 3 launchers and the new rails.
- [ ] `FittingWeaponsSIDs` update themselves from the map; check the "Fits" lines after `prepare-configs`.
- [x] Description weapon list + changenote. (M16 is still not in the description list.)
- [x] Wrote `editor/xn_scopes_setup.py` (hand-kept table; not generated from the map).
- [x] Verified the saved assets (2026-10-22): 20 montages bound, 15 collections hold their X8/X16/built-in entries.
- [x] `npm run prepare-configs` + PIE copy of the cfgs into the main mod.

## Editor: one Python script (`py "S:/.../xn_scopes_setup.py"`)

Prerequisite: check out into X16Scopes with the Mod Editor checkout tool: the 8 skeletons and the
collections listed above (new guns only). Then the script does this per gun:

- [x] **Sockets** pasted, plus aim camera sockets named after each scope SID on `jnt_wpn_*`. Copy `X8ScopeSocket` from `X4ScopeSocket` where missing, and `X16ScopeSocket` from
      `X8ScopeSocket` (rule from the working guns: X16 = X8). Uses `SkeletalMesh.find_socket` /
      `add_socket(..., add_to_skeleton=True)`. If `add_socket` isn't exposed, it prints a
      `SocketCopyPasteBuffer` block per skeleton instead: select any bone in the skeleton tree, Ctrl+V.
- [x] **Hands montages.** Duplicate the X4 attach montage (table above) to
      `/X16Scopes/_STALKER2/Animations/Player/AnimSequences/<class>/<gun>/Attaches/MG_fp_<gun>_sight_x{8,16}_attach`
      and set `BindedAttachSid` on its `AnimNotify_AttachItem` notifies to the new scope SID
      (same as the existing mod montages, e.g. `MG_fp_kharod_sight_x8_attach`).
- [x] **AnimCollections.** Add `AttachingBySID[X8/X16] = (new hands montage, gun's X4 weapon montage)`
      and `ShootingWithScope[X8/X16] = the X4 aim montage`, in the base collections,
      for new guns and for the existing gaps above.
- [x] Save all touched assets and print a report.
- [x] Not needed: Python edits the maps (save needs `only_if_is_dirty=False`). Fallback if the collection struct isn't editable from Python: the script saves the checked-out
      collections untouched (that turns them into a format I can read). I then give you one paste
      block per map: right-click the `AttachingBySID` / `ShootingWithScope` header → Paste. The block
      replaces the whole map, so it already contains the existing entries.

## Editor: by hand

- [ ] Tune socket positions per gun (copied X4 positions are only a starting point), in PIE as in `HANDOVER.md`.
- [x] (2026-10-23: option (b), Sotnyk's `RU_X2Scope_1` entry now uses `X2ScopeSocket`; verify in PIE) Sotnyk's X2 aims slightly off (seen in game 2026-10-22). It now mounts `RU_X2Scope_1` on
      `SotnykColimScopeSocket`, but the aim camera is the shared `RU_X2Scope_1` socket on
      `SK_dnipro_Skeleton` (`jnt_wpn_dnipro`, -5.300, 1.620, 9.670), placed for the Dnipro's own X2 mount.
      The old built-in's camera, `Gun_Sotnyk_ColimScope`, sits at -7.000, 1.630, 10.070. One skeleton can
      hold one `RU_X2Scope_1` camera, so options: (a) move it toward the Sotnyk value and re-check the
      Dnipro X2; (b) mount the Sotnyk's X2 on the Dnipro's `X2ScopeSocket` so the existing camera fits
      (the Sotnyk mesh override may then need its own offset).
- [x] (fixed by the same socket change; verify in PIE) Sotnyk's X2 attach animation is off too. Sotnyk and Dnipro share `AnimCollection_fp_dnipro`, so
      `RU_X2Scope_1` plays the Dnipro's X2 attach (`MG_fp_dnipro_sight_x2_attach`), whose hands carry the
      scope to the Dnipro's X2 mount, not to `SotnykColimScopeSocket`. Collections are keyed by scope SID,
      so the two guns can't have different `RU_X2Scope_1` attaches. Goes with the camera choice above:
      option (b) (same mount as the Dnipro) fixes both. `MG_fp_dnipro_sight_sotnyk_attach` (bound to
      `Gun_Sotnyk_ColimScope`) is now unused by the new SID.
- [x] M701 montages (x8, x16, colim): equip clone + AttachItem notifies on jnt_l_weapon, equip-end PlayerAction removed.
- [ ] Revert the stray `SK_m160` mesh checkout from `HANDOVER.md` before the cook (`SKEL_mar`, `SK_m701_Skeleton` and `AnimCollection_fp_mark` are now needed, keep them).

## Build + test (you run these)

- [ ] `npm run cook-inject` in `Mods/X16Scopes`.
- [ ] In game: `XStartQuestNodeBySID Skif_X16Scopes`; per gun: attach/detach X8 and X16 with and
      without an underbarrel launcher, aim, check the reticle and the "Fits" line.
