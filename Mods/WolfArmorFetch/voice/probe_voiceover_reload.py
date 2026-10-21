# Run in the Zone Kit editor's Output Log (Python mode):
#   exec(open(r"Z:\home\sdwvit\IdeaProjects\S2Mods\Mods\WolfArmorFetch\voice\probe_voiceover_reload.py").read())
# Lists the keys of one _Voiceover runtime data asset as loaded, then reloads the package from disk and lists them
# again: tells whether the editor holds a stale copy. Nothing is saved. Report: S:\vm\voice-clone\probe\vo_reload.txt
import os
import unreal

OUT = r"S:\vm\voice-clone\probe"
PKG = "/WolfArmorFetch/WolfArmorFetch_Decider_Accept_Voiceover"
lines = []
log = lines.append


def dump(tag):
    obj = unreal.load_asset(PKG)
    assets = obj.get_editor_property("asset_container").get_editor_property("assets")
    log(f"{tag}: {len(assets)} keys")
    for k, v in assets.items():
        try:
            path = v.export_text()
        except Exception:
            path = str(v)
        log(f"  {k} -> {path}")


FILE = r"S:\STALKER2ZoneKit\Stalker2\Mods\WolfArmorFetch\Content\WolfArmorFetch_Decider_Accept_Voiceover.uasset"
try:
    log(f"file {os.path.getsize(FILE)} bytes")
except Exception as e:
    log(f"file size failed: {e!r}")
try:
    dump("before reload")
    pkg = unreal.find_package(PKG) if hasattr(unreal, "find_package") else unreal.load_package(PKG)
    unreal.EditorLoadingAndSavingUtils.reload_packages([pkg], unreal.ReloadPackagesInteractionMode.ASSUME_POSITIVE)
    dump("after reload")
except Exception as e:
    log(f"FAILED: {e!r}")
os.makedirs(OUT, exist_ok=True)
with open(os.path.join(OUT, "vo_reload.txt"), "w", encoding="utf-8") as fh:
    fh.write("\n".join(str(x) for x in lines))
unreal.log(f"probe_voiceover_reload: {len(lines)} lines in {OUT}\\vo_reload.txt")
