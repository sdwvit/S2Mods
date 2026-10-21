# Run in the Zone Kit editor's Output Log (Python mode):
#   exec(open(r"Z:\home\sdwvit\IdeaProjects\S2Mods\Mods\WolfArmorFetch\voice\gfd_scan_label.py").read())
# The game finds dialog runtime data through QuestAssetLabels (vanilla: PAK_Quest_BaseGame), which DefaultGame.ini
# scans at startup. A mod is a GameFeature plugin, and a plugin's own primary assets are scanned from its
# GameFeatureData's PrimaryAssetTypesToScan, which the ModKit leaves empty. This adds the QuestAssetLabel rule for
# /WolfArmorFetch to /WolfArmorFetch/WolfArmorFetch and saves it. Report: S:\vm\voice-clone\probe\gfd.txt
import os
import unreal

MOD = "WolfArmorFetch"
OUT = r"S:\vm\voice-clone\probe"
lines = []
log = lines.append


def try_set(obj, names, value):
    for n in names:
        try:
            obj.set_editor_property(n, value)
            return n
        except Exception as e:
            log(f"  set {n}: {e!r}"[:300])
    return None


try:
    gfd = unreal.load_asset(f"/{MOD}/{MOD}")
    log(f"gfd: {gfd} class {gfd.get_class().get_name()}")
    scan = None
    for n in ("primary_asset_types_to_scan", "PrimaryAssetTypesToScan"):
        try:
            scan = list(gfd.get_editor_property(n))
            prop = n
            break
        except Exception as e:
            log(f"get {n}: {e!r}"[:300])
    log(f"existing rules: {len(scan) if scan is not None else None}")
    for r in scan or []:
        log(f"  {r}")
    if scan is not None and not any("QuestAssetLabel" in str(r) for r in scan):
        info = unreal.PrimaryAssetTypeInfo()
        for k, v in info.__class__.__dict__.items():
            pass
        log("set type: " + str(try_set(info, ["primary_asset_type", "PrimaryAssetType"], "QuestAssetLabel")))
        log("set class: " + str(try_set(info, ["asset_base_class", "AssetBaseClass"], unreal.QuestAssetLabel.static_class())))
        d = unreal.DirectoryPath()
        d.set_editor_property("path", f"/{MOD}")
        log("set dirs: " + str(try_set(info, ["directories", "Directories"], [d])))
        rules = unreal.PrimaryAssetRules()
        rules.set_editor_property("cook_rule", unreal.PrimaryAssetCookRule.ALWAYS_COOK)
        log("set rules: " + str(try_set(info, ["rules", "Rules"], rules)))
        try_set(info, ["has_blueprint_classes", "bHasBlueprintClasses"], False)
        try_set(info, ["is_editor_only", "bIsEditorOnly"], False)
        log(f"new rule: {info}")
        scan.append(info)
        log("set scan: " + str(try_set(gfd, [prop], scan)))
    after = gfd.get_editor_property(prop) if scan is not None else []
    log(f"rules now: {len(after)}")
    for r in after:
        for f in ("primary_asset_type", "asset_base_class", "directories", "rules"):
            try:
                log(f"  {f} = {r.get_editor_property(f)}")
            except Exception as e:
                log(f"  {f}: {e!r}"[:200])
    log(f"saved: {unreal.EditorAssetLibrary.save_loaded_asset(gfd, False)}")
except Exception as e:
    log(f"FAILED: {e!r}")
os.makedirs(OUT, exist_ok=True)
with open(os.path.join(OUT, "gfd.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
unreal.log(f"gfd_scan_label: {len(lines)} lines in {OUT}\\gfd.txt")
