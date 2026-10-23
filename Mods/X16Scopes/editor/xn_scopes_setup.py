"""
X16Scopes editor setup: X8/X16 (and detachable built-in) scope sockets, attach montages and
AnimCollection entries. Run in the Mod Editor's Cmd box (Python):

    py "S:/STALKER2ZoneKit/Stalker2/Saved/xn_scopes_setup.py"

Safe to re-run: existing sockets, montages and map entries are skipped.

1. Sockets: writes SocketCopyPasteBuffer text per skeleton to Saved/xn_sockets/<mesh>.txt
   (X8 copied from X4 where missing, X16 from X8). Open the skeleton, select any bone, Ctrl+V.
2. Montages: duplicates each source hands montage into /X16Scopes and rebinds its
   AnimNotify_AttachItem notifies to the new scope SID.
3. AnimCollections: adds AttachingBySID / ShootingWithScope entries to the checked-out copies
   under /X16Scopes. If Python can't edit them, the collection is re-saved untouched and listed
   at the end, so its map can be pasted instead.
"""
import os
import unreal

MOD = "/X16Scopes"
P = "/Game/_STALKER2/Animations/Player/AnimSequences"  # hands montages
W = "/Game/_STALKER2/Animations/Weapons"  # weapon montages and collections
SM = "/Game/_STALKER2/SkeletalMeshes/weapons"
OUT_DIR = os.path.join(unreal.Paths.project_saved_dir(), "xn_sockets")

# Skeletal mesh -> [(new socket, copied from)]. X16 equals X8 on every working gun.
SOCKETS = {
    f"{SM}/ar/AK74/SK_AK74": [("X8ScopeSocket", "X4ScopeSocket"), ("X16ScopeSocket", "X4ScopeSocket")],
    f"{SM}/ar/fora0/SK_fora0": [("X8ScopeSocket", "X4ScopeSocket"), ("X16ScopeSocket", "X4ScopeSocket")],
    f"{SM}/ar/grim0/SK_grim0": [("X8ScopeSocket", "X4ScopeSocket"), ("X16ScopeSocket", "X4ScopeSocket")],
    f"{SM}/dmr/GP3A/SK_Gp3a": [("X8ScopeSocket", "X4ScopeSocket"), ("X16ScopeSocket", "X4ScopeSocket")],
    f"{SM}/ar/Arev/Sk_arev": [("X16ScopeSocket", "X8ScopeSocket")],
    f"{SM}/dmr/SKP/SK_Skp": [("X16ScopeSocket", "X8ScopeSocket")],
    f"{SM}/sr/mar/SK_mar": [("X16ScopeSocket", "X8ScopeSocket")],
    f"{SM}/sr/m701/SK_m701": [("X16ScopeSocket", "X8ScopeSocket")],
}


def attach(sid, hands_src, hands_name, weapon, aim=None):
    """One scope on one collection: hands montage cloned from hands_src as hands_name."""
    return {"sid": sid, "src": hands_src, "name": hands_name, "weapon": weapon, "aim": aim}


def aim_only(sid, aim):
    return {"sid": sid, "aim": aim}


def x8_x16(family, hands_src, stem, weapon, aim=None):
    """X8 + X16 entries; stem is the new montage name with {X} for the level."""
    x8, x16 = ("EN_X8Scope_1", "EN_X16Scope_1") if family == "EN" else ("RU_X8Scope_1", "UA_X16Scope_1")
    return [
        attach(x8, hands_src, stem.format(X="x8"), weapon, aim),
        attach(x16, hands_src, stem.format(X="x16"), weapon, aim),
    ]


# (hands, weapon) aim pairs
AIM = {
    "dnipro": (f"{P}/ar/dnipro/Shoot/MG_fp_dnipro_shoot_aim_scope_x2", f"{W}/ar/dnipro/AnimSequences/fp/Shoot/MG_dnipro_fp_shoot_aim_scope_x2"),
    "kharod": (f"{P}/ar/kharod/Shoot/MG_fp_kharod_shoot_aim_x4", f"{W}/ar/kharod/AnimSequences/fp/Shoot/MG_kharod_fp_shoot_x4"),
    "svu": (f"{P}/sr/svu/Shoot/MG_fp_svu_shoot_aim_scope_x8", f"{W}/sr/svu/AnimSequences/fp/Shoot/MG_svu_fp_shoot_aim_scope_x8"),
    "lavina": (f"{P}/ar/lavina/Shoot/MG_fp_lavina_shoot_aim_x2_scope", f"{W}/ar/lavina/AnimSequences/fp/Shoot/MG_lavina_fp_shoot_aim_x2_scope"),
    "lavina_colim": (f"{P}/ar/lavina/Shoot/MG_FP_Player_lavina_Shoot_Aim_RuColimScope02_01", f"{W}/ar/lavina/AnimSequences/fp/Shoot/MG_FP_Lavina_Shoot_Aim_RuColimScope02_01"),
    "gp37": (f"{P}/ar/gp37/Shoot/MG_fp_gp37_shoot_aim_scope_x4", f"{W}/ar/gp37/AnimSequences/fp/Shoot/MG_gp37_fp_shoot_aim_scope_x4"),
    "m16": (f"{P}/ar/m16/Shoot/MG_fp_m16_shoot_aim_x4_scope", f"{W}/ar/m16/AnimSequences/fp/Shoot/MG_m16_fp_shoot_aim_x4_scope"),
    "m16_holo": (f"{P}/ar/m16/Shoot/MG_fp_m16_shoot_aim_holo_scope", f"{W}/ar/m16/AnimSequences/fp/Shoot/MG_m16_fp_shoot_aim_holo_scope"),
    "ak74": (f"{P}/ar/ak74/Shoot/MG_fp_ak74_shoot_aim_x4_scope", f"{W}/ar/AK74/AnimSequences/fp/Shoot/MG_ak74_fp_shoot_aim_x4_scope"),
    "arev": (f"{P}/ar/Arev/Shoot/MG_FP_Player_Arev_Shoot_Aim_EnX4scope01_01", f"{W}/ar/Arev/AnimSequences/fp/Shoot/MG_FP_Arev_Shoot_Aim_EnX4scope01_01"),
    "fora": (f"{P}/ar/fora/Shoot/MG_fp_fora_shoot_aim_x4", f"{W}/ar/fora/AnimSequences/fp/Shoot/MG_fora_fp_shoot_aim_x4"),
    "grim": (f"{P}/ar/grim/Shoot/MG_fp_grim_shoot_aim_scope_x4", f"{W}/ar/grim/AnimSequences/fp/Shoot/MG_grim_fp_shoot_aim_scope_x4"),
    "gp3a": (f"{P}/dmr/GP3A/Shoot/MG_FP_Player_Gp3a_Shoot_Aim_EnX4Scope_01", f"{W}/dmr/GP3A/AnimSequences/fp/Shoot/MG_FP_Gp3a_Shoot_Aim_EnX4Scope_01"),
    "skp": (f"{P}/dmr/skp/Shoot/MG_FP_Player_Skp_Shoot_Aim_EnScopeX8_01", f"{W}/dmr/skp/AnimSequences/fp/Shoot/MG_FP_Skp_Shoot_Aim_EnScopeX8_01"),
    "mark": (f"{P}/sr/mark/Shoot/MG_fp_mark_shoot_aim_scope_x4", f"{W}/sr/mark/AnimSequences/fp/Shoot/MG_mark_fp_shoot_aim_scope_x4"),
}

# Launcher variants (*_GrenLaunch, *_BuckLaunch) need no entries: tested 2026-10-22, the attach
# animations play correctly with a launcher fitted.

# M701 has no scope attach animation: its entries clone the equip montage, and the three attach
# notifies are copied in by hand afterwards (see M701_MANUAL below).
M701_EQUIP = f"{P}/sr/m701/equip/MG_fp_m701_equip"
M701_WEAPON_EQUIP = f"{W}/sr/m701/AnimSequences/fp/equip/MG_m701_fp_equip"

COLL = f"{MOD}/_STALKER2/Animations/Weapons"
COLLECTIONS = {
    # Already in the mod: aim poses for X8/X16, plus attaches for the detachable built-ins.
    f"{COLL}/ar/dnipro/AnimCollections/AnimCollection_fp_dnipro": [
        aim_only("EN_X8Scope_1", AIM["dnipro"]),
        aim_only("EN_X16Scope_1", AIM["dnipro"]),
        attach("Gun_Sotnyk_ColimScope", f"{P}/ar/dnipro/Attaches/MG_fp_dnipro_sight_colim_attach", "MG_fp_dnipro_sight_sotnyk_attach",
               f"{W}/ar/dnipro/AnimSequences/fp/Attaches/MG_dnipro_fp_sight_colim_attach", AIM["dnipro"]),
    ],
    f"{COLL}/ar/kharod/AnimCollections/AnimCollection_fp_kharod": [
        aim_only("EN_X8Scope_1", AIM["kharod"]),
        aim_only("EN_X16Scope_1", AIM["kharod"]),
    ],
    f"{COLL}/sr/svu/AnimCollections/AnimCollection_fp_svu": [
        aim_only("RU_X8Scope_1", AIM["svu"]),
        aim_only("UA_X16Scope_1", AIM["svu"]),
    ],
    f"{COLL}/ar/lavina/AnimCollections/AnimCollection_fp_lavina": [
        aim_only("RU_X8Scope_1", AIM["lavina"]),
        aim_only("UA_X16Scope_1", AIM["lavina"]),
        attach("RU_ColimScope_1", f"{P}/ar/lavina/Attaches/MG_FP_Player_Lavina_Attach-RuColimScope02_01", "MG_fp_lavina_sight_rucolim1_attach",
               f"{W}/ar/lavina/AnimSequences/fp/Attaches/MG_FP_Lavina_Attach-RuColimScope02_01", AIM["lavina_colim"]),
    ],
    f"{COLL}/ar/gp37/AnimCollections/AnimCollection_fp_gp37": [
        aim_only("EN_X8Scope_1", AIM["gp37"]),
        aim_only("EN_X16Scope_1", AIM["gp37"]),
        attach("EN_X2Scope_1", f"{P}/ar/gp37/attaches/MG_fp_gp37_sight_x4_attach", "MG_fp_gp37_sight_x2_attach",
               f"{W}/ar/gp37/AnimSequences/fp/attaches/MG_gp37_fp_sight_x4_attach", AIM["gp37"]),
    ],
    f"{COLL}/ar/m16/AnimCollections/AnimCollection_fp_m16": [
        aim_only("EN_X8Scope_1", AIM["m16"]),
        aim_only("EN_X16Scope_1", AIM["m16"]),
        attach("EN_ColimScope_1", f"{P}/ar/m16/Attaches/MG_fp_m16_sight_holographic_attach", "MG_fp_m16_sight_colim_attach",
               f"{W}/ar/m16/AnimSequences/fp/Attaches/MG_m16_fp_sight_holographic_attach", AIM["m16_holo"]),
    ],
    f"{COLL}/ar/m16/AnimCollections/AnimCollection_fp_SharpShooter": [
        aim_only("EN_X8Scope_1", AIM["m16"]),
        aim_only("EN_X16Scope_1", AIM["m16"]),
    ],
    # New guns.
    f"{COLL}/ar/AK74/AnimCollections/AnimCollection_fp_AK74": x8_x16(
        "UA", f"{P}/ar/ak74/Attaches/MG_fp_ak74_sight_x4_attach", "MG_fp_ak74_sight_{X}_attach",
        f"{W}/ar/AK74/AnimSequences/fp/Attaches/MG_ak74_fp_sight_x4_attach", AIM["ak74"]),
    f"{COLL}/ar/Arev/AnimCollection/AnimCollection_fp_Arev": x8_x16(
        "EN", f"{P}/ar/Arev/Attaches/MG_FP_Player_Arev_Attach-EnX4Scope01_01", "MG_fp_arev_sight_{X}_attach",
        f"{W}/ar/Arev/AnimSequences/fp/Attaches/MG_FP_Arev_Attach-EnX4Scope01_01", AIM["arev"]),
    f"{COLL}/ar/fora/AnimCollections/AnimCollection_fp_fora": x8_x16(
        "EN", f"{P}/ar/fora/Attaches/Scopes/MG_fp_fora_sight_x4_attach", "MG_fp_fora_sight_{X}_attach",
        f"{W}/ar/fora/AnimSequences/fp/Attaches/Scopes/MG_fora_fp_sight_x4_attach", AIM["fora"]),
    f"{COLL}/ar/grim/AnimCollections/AnimCollection_fp_grim": x8_x16(
        "EN", f"{P}/ar/grim/Attaches/MG_fp_grim_sight_x4_attach", "MG_fp_grim_sight_{X}_attach",
        f"{W}/ar/grim/AnimSequences/fp/Attaches/MG_grim_fp_sight_x4_attach", AIM["grim"]),
    f"{COLL}/dmr/GP3A/AnimCollections/AnimCollection_fp_gp3a": x8_x16(
        "EN", f"{P}/dmr/GP3A/Attaches/MG_FP_Player_Gp3a_Attach-EnX4Scope01_01", "MG_fp_gp3a_sight_{X}_attach",
        f"{W}/dmr/GP3A/AnimSequences/fp/Attaches/MG_FP_Gp3a_Attach-EnX4Scope01_01", AIM["gp3a"]),
    f"{COLL}/dmr/skp/AnimCollections/AnimCollection_fp_skp": [
        attach("EN_X16Scope_1", f"{P}/dmr/skp/Attaches/MG_FP_Player_Skp_Attach_EnX8Scope01_01", "MG_fp_skp_sight_x16_attach",
               f"{W}/dmr/skp/AnimSequences/fp/Attaches/MG_FP_Skp_Attach_EnX8Scope01_01", AIM["skp"]),
    ],
    f"{COLL}/sr/mark/AnimCollections/AnimCollection_fp_mark": [
        attach("EN_X16Scope_1", f"{P}/sr/mark/Attaches/Sights/MG_fp_mark_x8_sight_attach", "MG_fp_mark_x16_sight_attach",
               f"{W}/sr/mark/AnimSequences/fp/Attaches/Sights/MG_mark_fp_x8_sight_attach", AIM["mark"]),
        # Partner's built-in red dot, now detachable.
        attach("EN_ColimScope_1", f"{P}/sr/mark/Attaches/Sights/MG_fp_mark_x2_sight_attach", "MG_fp_mark_colim_sight_attach",
               f"{W}/sr/mark/AnimSequences/fp/Attaches/Sights/MG_mark_fp_x2_sight_attach"),
    ],
    f"{COLL}/sr/m701/AnimCollections/AnimCollection_fp_m701": [
        attach("EN_X8Scope_1", M701_EQUIP, "MG_fp_m701_sight_x8_attach", M701_WEAPON_EQUIP),
        attach("EN_X16Scope_1", M701_EQUIP, "MG_fp_m701_sight_x16_attach", M701_WEAPON_EQUIP),
        # Cavalier's built-in red dot, now detachable.
        attach("EN_ColimScope_1", M701_EQUIP, "MG_fp_m701_sight_colim_attach", M701_WEAPON_EQUIP),
    ],
}
M701_MANUAL = ["MG_fp_m701_sight_x8_attach", "MG_fp_m701_sight_x16_attach", "MG_fp_m701_sight_colim_attach"]

assets = unreal.EditorAssetLibrary
report = []


def log(msg):
    report.append(msg)
    unreal.log(f"[xn_scopes] {msg}")


def mod_path(game_path, name):
    return f"{MOD}{os.path.dirname(game_path)[len('/Game'):]}/{name}"


def socket_block(i, name, s):
    """s is the source socket; the copy differs only in its name."""
    loc, rot, scale = s.relative_location, s.relative_rotation, s.relative_scale
    return "\n".join([
        "IsOnSkeleton=1",
        f'Begin Object Class=/Script/Engine.SkeletalMeshSocket Name="SkeletalMeshSocket_{i}"',
        f'   SocketName="{name}"',
        f'   BoneName="{s.bone_name}"',
        f"   RelativeLocation=(X={loc.x:.6f},Y={loc.y:.6f},Z={loc.z:.6f})",
        f"   RelativeRotation=(Pitch={rot.pitch:.6f},Yaw={rot.yaw:.6f},Roll={rot.roll:.6f})",
        f"   RelativeScale=(X={scale.x:.6f},Y={scale.y:.6f},Z={scale.z:.6f})",
        "End Object",
    ])


def do_sockets():
    os.makedirs(OUT_DIR, exist_ok=True)
    for mesh_path, pairs in SOCKETS.items():
        mesh = unreal.load_asset(mesh_path)
        if not mesh:
            log(f"MISSING mesh {mesh_path}")
            continue
        blocks = []
        for new, src in pairs:
            if mesh.find_socket(new):
                continue
            s = mesh.find_socket(src)
            if not s:
                log(f"{mesh_path}: no {src} to copy {new} from")
                continue
            blocks.append(socket_block(len(blocks), new, s))
        if not blocks:
            log(f"sockets ok: {os.path.basename(mesh_path)}")
            continue
        out = os.path.join(OUT_DIR, f"{os.path.basename(mesh_path)}.txt")
        with open(out, "w") as f:
            f.write(f"SocketCopyPasteBuffer\nNumSockets={len(blocks)}\n" + "\n".join(blocks) + "\n")
        log(f"sockets to paste: {out}")


def rebind_attach_notifies(montage, sid):
    """Points every AnimNotify_AttachItem at sid. Returns (attach notifies found, changed)."""
    found = changed = 0
    # Notifies is protected on the montage; the library hands back events holding the same notify objects.
    for event in unreal.AnimationLibrary.get_animation_notify_events(montage):
        notify = event.get_editor_property("notify")
        if not notify or "AttachItem" not in notify.get_class().get_name():
            continue
        found += 1
        if str(notify.get_editor_property("binded_attach_sid")) != sid:
            notify.set_editor_property("binded_attach_sid", sid)
            changed += 1
    return found, changed


def do_montage(entry):
    dst = mod_path(entry["src"], entry["name"])
    created = not assets.does_asset_exist(dst)
    if created and not assets.duplicate_asset(entry["src"], dst):
        log(f"FAILED duplicate {entry['src']} -> {dst}")
        return None
    # Rebinds on every run, so a montage duplicated by an interrupted run still gets its SID.
    montage = unreal.load_asset(dst)
    found, changed = rebind_attach_notifies(montage, entry["sid"])
    if created or changed:
        assets.save_loaded_asset(montage)
        log(f"montage {entry['name']}: {found} attach notifies, {changed} rebound -> {entry['sid']}")
    if not found:
        log(f"NO ATTACH NOTIFIES in {entry['name']}: add them by hand")
    return dst


def anims(character, weapon):
    a = unreal.CharacterWeaponAnimations()
    a.set_editor_property("character", unreal.load_asset(character))
    a.set_editor_property("weapon", unreal.load_asset(weapon))
    a.set_editor_property("play_rate", 1.0)
    return a


def do_collection(path, entries):
    coll = unreal.load_asset(path)
    if not coll:
        log(f"NOT CHECKED OUT {path}")
        return
    hands = {e["sid"]: do_montage(e) for e in entries if "src" in e}
    try:
        internal = coll.get_editor_property("internal_animations")
        attaching = internal.get_editor_property("attaching_by_sid")
        shooting = internal.get_editor_property("shooting_with_scope")
        added = []
        for e in entries:
            sid = e["sid"]
            if hands.get(sid) and sid not in attaching:
                entry = unreal.AttachDetachAnimations()
                entry.set_editor_property("attach_animation", anims(hands[sid], e["weapon"]))
                attaching[sid] = entry
                added.append(f"attach {sid}")
            if e.get("aim") and sid not in shooting:
                shooting[sid] = anims(*e["aim"])
                added.append(f"aim {sid}")
        internal.set_editor_property("attaching_by_sid", attaching)
        internal.set_editor_property("shooting_with_scope", shooting)
        coll.set_editor_property("internal_animations", internal)
        # Read back: proves the edit landed on the asset, not on a copy.
        saved = coll.get_editor_property("internal_animations")
        missing = [e["sid"] for e in entries
                   if (hands.get(e["sid"]) and e["sid"] not in saved.get_editor_property("attaching_by_sid"))
                   or (e.get("aim") and e["sid"] not in saved.get_editor_property("shooting_with_scope"))]
        # Python property edits don't mark the package dirty, so save unconditionally.
        assets.save_loaded_asset(coll, only_if_is_dirty=False)
        log(f"collection {os.path.basename(path)}: added {added or 'nothing (already there)'}"
            + (f"; MISSING after write: {missing}" if missing else ""))
    except Exception as ex:  # property not exposed to Python: re-save so the map can be read outside
        assets.save_asset(path, only_if_is_dirty=False)
        log(f"PASTE NEEDED {os.path.basename(path)} ({ex})")


do_sockets()
for collection_path, collection_entries in COLLECTIONS.items():
    do_collection(collection_path, collection_entries)
log("By hand: in " + ", ".join(M701_MANUAL) + " copy the three attach notifies from MG_fp_mark_x8_sight_attach "
    "(AttachItem JoinAttachToHand, RemoveAttachFromHandAndAttachToWeapon, WeaponAction UnlockLeftHandIdle), "
    "then set each AttachItem's BindedAttachSid to the montage's scope.")
unreal.log("[xn_scopes] ---- report ----\n" + "\n".join(report))
