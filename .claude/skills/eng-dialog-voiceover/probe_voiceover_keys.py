# Run in the Zone Kit editor's Output Log (Python mode):
#   PKG = "/<Mod>/<ChainSID>_Voiceover"; OUT = r"S:\vm\voice-clone\probe"; exec(open(r"Z:\home\<user>\IdeaProjects\S2Mods\.claude\skills\eng-dialog-voiceover\probe_voiceover_keys.py").read())
# Read-only: loads one of our _Voiceover runtime data assets and lists the phrase keys the editor sees,
# to tell whether Skif's (pc) entries are lost on load or only at cook. Report: <OUT>\vo_keys.txt
import os
import unreal

for _required in ("PKG", "OUT"):
    if _required not in globals():
        raise RuntimeError(f"probe_voiceover_keys.py: set {_required} before exec (see the header)")
lines = []
log = lines.append
try:
    obj = unreal.load_asset(PKG)
    log(f"loaded {obj} class {obj.get_class().get_name() if obj else None}")
    container = None
    for get in (lambda: obj.get_asset_container(), lambda: obj.get_editor_property("asset_container")):
        try:
            container = get()
            break
        except Exception as e:
            log(f"container getter failed: {e!r}"[:300])
    log(f"container {container} class {container.get_class().get_name() if container else None}")
    if container:
        for name, get in (
            ("get_phrases", lambda: container.get_phrases()),
            ("assets", lambda: container.get_editor_property("assets")),
        ):
            try:
                v = get()
                items = list(v.items()) if hasattr(v, "items") else list(v)
                log(f"{name}: {len(items)}")
                for it in items:
                    log(f"  {it}")
            except Exception as e:
                log(f"{name} failed: {e!r}"[:300])
except Exception as e:
    log(f"FAILED: {e!r}")
os.makedirs(OUT, exist_ok=True)
with open(os.path.join(OUT, "vo_keys.txt"), "w", encoding="utf-8") as fh:
    fh.write("\n".join(str(x) for x in lines))
unreal.log(f"probe_voiceover_keys: {len(lines)} lines in {OUT}\\vo_keys.txt")
