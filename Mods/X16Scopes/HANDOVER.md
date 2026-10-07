# X16Scopes handover (2026-10-06)

2.0 (UE 5.5) port of X16Scopes. Nothing is committed or published. The last cook-inject was early on 2026-10-06, so the game build predates everything below except the X8 scopes in the Skif generator.

## Done this session (source, uncommitted)

- **Skif debug node** `XStartQuestNodeBySID Skif_X16Scopes` gives both X16 scopes, both X8 scopes (`EN_X8Scope_1`, `RU_X8Scope_1`) and an explicit allowlist of 26 assault rifles, DMRs and sniper rifles (`SKIF_ALLOWED_WEAPON_SIDS` in `meta.mts`). New weapon prototypes are only included when added to that list.
- **GP37 in that generator** comes with `GunG37_Upgrade_Attachment_Rail` (`Upgrades` block) and the `RailPicatiniGP37` attach installed (`Attaches` block). See `requiredUpgradeIDsOf` and `attachesUnlockedByUpgrade` in `meta.mts`. Untested in game.
- **Lynx X16 inventory icon** now reuses the SVDM one, `T_inv_w_svdm_ua_x16scope_1` (`xNCompatibleScopeByWeapon.mts`). The Lynx-specific texture never existed.
- **Changenote** in `meta.mts` covers all of the above.

## Open: X16 scopes have no reticle (in game and in the editor)

Cause, confirmed by dumping mesh sections in the editor:

| Mesh | Sections |
|---|---|
| vanilla `SM_ss01_en_x8scope_1` | Scope 16520 tris, Lens 888, **Mark 14** (plane at x = -13.01, `MI_en_x8scope_1_mark`) |
| ours `SM_ss01_en_x16scope_1` | Scope 16520, Lens 888 |
| vanilla `SM_ss01_ru_x8scope_1` | Lens 444, Scope 10236, **Mark 14** (plane at x = -17.21, `MI_ru_x8scope_1_mark`) |
| ours `SM_ua_x16scope` | Lens 444, Scope 10236 |

In 2.0 the reticle is the separate 14-triangle Mark section. Our X16 meshes are the X8 geometry with a different body texture and are missing that section. Adding an empty "Mark" material slot does nothing. The slot needs the triangles.

Plan for tomorrow (editor): duplicate the vanilla X8 mesh into the mod folder and set its **Scope** slot to our body material.
- EN: `SM_ss01_en_x8scope_1` → `/X16Scopes/_Stalker_2/weapons/attachments/ss/SM_ss01_en_x16scope_1/`, Scope slot (index 0) = `MI_ss01_en_x16scope_1_a`
- UA: `SM_ss01_ru_x8scope_1` → `/X16Scopes/_Stalker_2/weapons/attachments/ss/SM_ss01_ua_x16scope_1/`, Scope slot (index 1; order is Lens, Scope, Mark) = `MI_ua_x16scope`
- Then update the two `MeshPath`s in `transformMeshPrototypes` (`meta.mts`) if the asset names change.

Watch out: on 2026-10-06 the old `SM_ss01_en_x16scope_1` got an extra slot (renamed None → Mark) and the editor hung rebuilding it. It may hold an unsaved or half-saved edit. Discard it or delete the old mesh once the duplicate is in use.

A cfg-only alternative was tried and rejected by the user: point `MeshPath` at the vanilla X8 meshes and swap the body via `Materials { [0] { MaterialSlot, MaterialPath } }`.

## Other open items

- In-game report (2026-10-07): unique Arev (`GunArevPrecise_AR`) has no X8 attach animation and its X8 socket is misplaced; M701's X8 socket is also misplaced. SDK `WeaponGeneralSetupPrototypes.cfg` already gives both `M701_Scope` on `X8ScopeSocket`, preinstalled with `bHiddenInInventory = true`. `M701_Scope` inherits `EN_X8Scope_1`. Neither weapon is added by the X16Scopes compatibility map or current generated weapon-setup patches. Arev's unique scope is therefore vanilla fixed-scope behavior, not newly enabled compatibility. Inspect the shared Arev animation override and M701 skeleton override in the editor; cfg inspection does not establish socket transforms or animation-map values.
- Stray SDK checkouts to revert with the Mod Editor's checkout tool: `SK_m701_Skeleton`, `SKEL_mar`, `AnimCollection_fp_mark`. New since then: `SK_m160` (the M16-family skeletal mesh, saved 2026-10-06 22:15). The SK_* meshes were meant to stay out of the mod.
- The `SK_m160_Skeleton` socket edits made after 21:57 on 2026-10-06 were lost in an editor crash.
- Per-gun socket tuning continues from in-game reports. Dnipro and Kharod are near release-ready.
- `src/ensure-cooked.mts` empty-staged fix is uncommitted.

## Live-editing scopes in Play In Editor

The cfgs are a separate SDK plugin (`X16ScopesCfg`) that the Mod Editor does not load, so they have to be copied into the main mod by hand:

1. `npm run prepare-configs` in `Mods/X16Scopes` (its push step deletes the copies below).
2. Copy `SDK/Stalker2/Mods/X16ScopesCfg/Content/GameLite` into `SDK/Stalker2/Mods/X16Scopes/Content/`.
3. Copy three vanilla files into the same relative spots under `X16Scopes/Content/GameLite/GameData/`: `ItemPrototypes.cfg`, `MeshPrototypes.cfg`, `ItemPrototypes/AttachPrototypes.cfg`. In the editor, a patch's `refurl=../X.cfg` resolves inside the mod folder. Without these the X16 structs lose their parent and spawning one stack-overflows the editor. Pointing `refurl` at the vanilla file instead makes the editor loop forever.
4. Restart Play In Editor. Cfgs are re-parsed at every session start.

Spawn items one by one with `XCreateItemInInventoryByID <SID> 0 1 1` (list at the bottom of `xNCompatibleScopeByWeapon.mts`).

**Before any cook-inject**, remove all of step 2 and 3 from `X16Scopes/Content/GameLite/GameData`. Otherwise the patches ship twice and every vanilla attachment, mesh and item ships in the mod.

Editor tips:
- The editor log is in the Proton prefix: `.../Heroic/Prefixes/default/S.T.A.L.K.E.R. 2 Zone Kit/drive_c/users/steamuser/AppData/Local/Stalker2/Saved/Logs/Stalker2.log`. A stack overflow leaves no crash report. The Heroic `launch.log` shows `virtual_setup_exception stack overflow`.
- The Output Log tab freezes the UI on a big log. Use the Cmd box at the bottom, or read the file.
- Python scripts must live under `S:` (the SDK drive), e.g. `py "S:/STALKER2ZoneKit/Stalker2/Saved/reticle_dbg.py"`. The sandbox cannot see `/tmp`.
- Never minimize a floating asset editor under Wine: it vanishes and cannot be restored. Set Editor Preferences → Asset Editor Open Location → Main Window.
- A stale SDK lock from a killed cook blocks prepare-configs. If the PID in `$TMPDIR/s2mods-sdk-mutation.lock/owner.json` is dead, remove the directory (same as pressing Y).
