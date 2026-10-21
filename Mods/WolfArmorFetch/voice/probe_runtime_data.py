# Run in the Zone Kit editor's Output Log (Python mode):
#   exec(open(r"Z:\home\sdwvit\IdeaProjects\S2Mods\Mods\WolfArmorFetch\voice\probe_runtime_data.py").read())
# Read-only: for every runtime data asset on disk under /WolfArmorFetch/Dialogs, reports what the asset registry knows
# and whether it loads. Report: S:\vm\voice-clone\probe\runtime_data.txt
import os
import unreal

OUT = r"S:\vm\voice-clone\probe"
DIR = r"S:\STALKER2ZoneKit\Stalker2\Mods\WolfArmorFetch\Content\Dialogs"
lines = []
log = lines.append
reg = unreal.AssetRegistryHelpers.get_asset_registry()
try:
    log(f"loading assets: {reg.is_loading_assets()}")
    for path in ["/WolfArmorFetch/Dialogs", "/WolfArmorFetch"]:
        assets = reg.get_assets_by_path(path, True)
        log(f"get_assets_by_path {path}: {len(assets)}")
        for a in assets:
            if "Dialogs" in str(a.package_name):
                log(f"  {a.package_name} class {a.asset_class_path}")
    for f in sorted(os.listdir(DIR)):
        name = f[:-7]
        pkg = f"/WolfArmorFetch/Dialogs/{name}"
        data = reg.get_asset_by_object_path(f"{pkg}.{name}")
        line = f"{name}: registry {'valid' if data.is_valid() else 'MISSING'}"
        try:
            obj = unreal.load_asset(pkg)
            line += f", load {obj.get_class().get_name() if obj else None}"
        except Exception as e:
            line += f", load FAILED {e!r}"[:300]
        line += f", after load {'valid' if reg.get_asset_by_object_path(f'{pkg}.{name}').is_valid() else 'MISSING'}"
        log(line)
except Exception as e:
    log(f"FAILED: {e!r}")
os.makedirs(OUT, exist_ok=True)
with open(os.path.join(OUT, "runtime_data.txt"), "w", encoding="utf-8") as fh:
    fh.write("\n".join(lines))
unreal.log(f"probe_runtime_data: {len(lines)} lines in {OUT}\\runtime_data.txt")
