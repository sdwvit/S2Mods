# Run in the Zone Kit editor's Output Log (Python mode), setting the inputs first on the same line:
#   VANILLA = "/Game/_STALKER2/Animations/CharacterHead/Hubs/RookieVillage_Hub/volk"; OUT = r"S:\vm\voice-clone\facedump"; exec(open(r"Z:\home\<user>\IdeaProjects\S2Mods\.claude\skills\eng-dialog-voiceover\lipsync\dump_face_anim.py").read())
# VANILLA: content folder holding one vanilla speaker's AS_FAC_* face anims (searched recursively).
# OUT: Windows path of the folder the JSONs go to (fit_lipsync.py's <facedump_dir>).
# Dumps every face animation under VANILLA (float curves + per-frame bone transforms) to JSON so the
# mouth channels can be found and fitted against the matching voice lines. Read-only: saves nothing.
import json
import unreal

for _required in ("VANILLA", "OUT"):
    if _required not in globals():
        raise RuntimeError(f"dump_face_anim.py: set {_required} before exec (see the header)")
BASE = VANILLA
lib = unreal.AnimationLibrary
# every face anim in the folder (EN + UA): training pairs for the audio -> mouth fit
NAMES = sorted(
    str(a.package_name)[len(BASE) + 1:]
    for a in unreal.AssetRegistryHelpers.get_asset_registry().get_assets_by_path(BASE, recursive=True)
    if str(a.asset_name).startswith("AS_FAC_")
)
unreal.log(f"[VoiceDump] {len(NAMES)} anims under {BASE}")


def tr(t):
    r = t.rotation.rotator()
    return [round(v, 4) for v in (t.translation.x, t.translation.y, t.translation.z, r.roll, r.pitch, r.yaw)]


import os
os.makedirs(OUT, exist_ok=True)
for name in NAMES:
    anim = unreal.load_asset(f"{BASE}/{name}")
    if not anim:
        unreal.log_warning(f"[VoiceDump] missing {name}")
        continue
    frames = lib.get_num_frames(anim)
    out = {
        "name": name,
        "length": lib.get_sequence_length(anim),
        "frames": frames,
        "skeleton": anim.get_editor_property("skeleton").get_path_name(),
        "curves": {},
        "bones": {},
    }
    for c in lib.get_animation_curve_names(anim, unreal.RawCurveTrackTypes.RCT_FLOAT):
        times, values = lib.get_float_keys(anim, c)
        out["curves"][str(c)] = [[round(t, 4), round(v, 4)] for t, v in zip(times, values)]
    for b in lib.get_animation_track_names(anim):
        out["bones"][str(b)] = [tr(lib.get_bone_pose_for_frame(anim, b, f, False)) for f in range(frames)]
    path = os.path.join(OUT, name.replace("/", "_") + ".json")
    with open(path, "w") as fh:
        json.dump(out, fh)
    unreal.log(f"[VoiceDump] {name}: {frames} frames, {len(out['curves'])} curves, {len(out['bones'])} bones -> {path}")
