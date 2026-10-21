# Run in the Zone Kit editor's Output Log (Python mode), after dump_face_anim.py or on its own:
#   exec(open(r"Z:\home\sdwvit\IdeaProjects\S2Mods\Mods\WolfArmorFetch\voice\probe_api.py").read())
# Read-only: writes what Python can see of the dialog runtime data / anim editing API to
# S:\vm\voice-clone\facedump\api.txt so the asset-creating scripts can be written against it.
import unreal

lines = []
def dump(label, obj):
    if obj is None:
        lines.append(f"## {label}: MISSING")
        return
    lines.append(f"## {label}")
    for n in sorted(dir(obj)):
        if n.startswith("_"):
            continue
        try:
            doc = (getattr(obj, n).__doc__ or "").strip().splitlines()
        except Exception:
            doc = []
        lines.append(f"{n}: {doc[0] if doc else ''}")

for cls in ["DialogRuntimeData", "DialogFunctionLibrary", "DialogPhraseAssetContainer", "LocalizedDialogPhraseAssetContainer",
            "NameToAssetAssetContainer", "DialogAssetType", "EDialogAssetType", "AnimationLibrary", "AnimationDataController",
            "AnimDataModel", "DataAssetFactory", "EditorAssetLibrary"]:
    dump(cls, getattr(unreal, cls, None))
lines.append("## unreal names containing Dialog")
lines += sorted(n for n in dir(unreal) if "Dialog" in n)

# a vanilla runtime data asset next to Wolf's hub dialogs, to read its property layout
vanilla = "/Game/_Stalker_2/maps/_Stalker2_WorldMap/QuestObjects/Dialogs/Hubs/RookieVillage/Guide/RookieVillage_Hub_volk_1_Meet_Voiceover"
rd = unreal.load_asset(vanilla)
lines.append(f"## vanilla {vanilla}: {rd}")
if rd:
    for p in ["asset_type", "asset_container", "AssetType", "AssetContainer"]:
        try:
            v = rd.get_editor_property(p)
            lines.append(f"{p} = {v!r}")
            for q in dir(v):
                if not q.startswith("_"):
                    lines.append(f"   .{q}")
        except Exception as e:
            lines.append(f"{p}: {e}")
anim = unreal.load_asset("/Game/_STALKER2/Animations/CharacterHead/Hubs/RookieVillage_Hub/volk/EN/AS_FAC_EN_volk_RookieVillage_Hub_volk_1_Meet_Meet_62346")
if anim:
    for p in ["controller", "data_model"]:
        try:
            lines.append(f"anim.{p} = {anim.get_editor_property(p)!r}")
        except Exception as e:
            lines.append(f"anim.{p}: {e}")

with open(r"S:\vm\voice-clone\facedump\api.txt", "w") as fh:
    fh.write("\n".join(lines))
unreal.log(f"[VoiceProbe] {len(lines)} lines -> S:\\vm\\voice-clone\\facedump\\api.txt")
