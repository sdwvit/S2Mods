# Run in the Zone Kit editor's Output Log (Python mode):
#   exec(open(r"Z:\home\sdwvit\IdeaProjects\S2Mods\Mods\WolfArmorFetch\voice\create_label.py").read())
# Creates (or refills) /WolfArmorFetch/PAK_Quest_WolfArmorFetch, a QuestAssetLabel listing every DialogRuntimeData
# under /WolfArmorFetch - the mod's counterpart of vanilla /Game/.../QuestObjects/PAK_Quest_BaseGame, which is the
# only referencer of every vanilla <Chain>_Voiceover. QuestAssetLabel is scanned under "/" (DefaultGame.ini), so mods
# are included. Saves that one asset; a report goes to S:\vm\voice-clone\probe\label.txt.
import os
import unreal

MOD = "WolfArmorFetch"
FOLDER = f"/{MOD}"
NAME = f"PAK_Quest_{MOD}"
OUT = r"S:\vm\voice-clone\probe"
lines = []
log = lines.append


def report():
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "label.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    unreal.log(f"create_label: {len(lines)} lines in {OUT}\\label.txt")


try:
    reg = unreal.AssetRegistryHelpers.get_asset_registry()
    # right after an editor start the background scan may not have reached the mod yet (one run found 2 of 20)
    reg.scan_paths_synchronous([f"{FOLDER}/Dialogs"], True)
    try:
        reg.wait_for_completion()
    except Exception as e:
        log(f"wait_for_completion: {e!r}")
    found = [a for a in reg.get_assets_by_class(unreal.TopLevelAssetPath("/Script/Stalker2", "DialogRuntimeData"), True)
             if str(a.package_name).startswith(FOLDER + "/")]
    log(f"runtime data under {FOLDER}: {len(found)} (20 expected)")
    lines.extend("  " + str(a.package_name) for a in found)

    path = f"{FOLDER}/{NAME}"
    label = unreal.load_asset(path) if unreal.EditorAssetLibrary.does_asset_exist(path) else None
    if label is None:
        factory = unreal.DataAssetFactory()
        factory.set_editor_property("data_asset_class", unreal.QuestAssetLabel)
        label = unreal.AssetToolsHelpers.get_asset_tools().create_asset(NAME, FOLDER, unreal.QuestAssetLabel, factory)
        log(f"created {label}")
    else:
        log(f"reusing {label}")

    datas = [unreal.load_asset(str(a.package_name)) for a in found]
    for prop, value in [("dialog_runtime_datas", datas), ("DialogRuntimeDatas", datas)]:
        try:
            label.set_editor_property(prop, value)
            log(f"set {prop}: {len(value)}")
            break
        except Exception as e:
            log(f"set {prop} failed: {e!r}")
    try:
        rules = label.get_editor_property("rules")
        rules.set_editor_property("cook_rule", unreal.PrimaryAssetCookRule.ALWAYS_COOK)
        label.set_editor_property("rules", rules)
        log(f"rules: {label.get_editor_property('rules')}")
    except Exception as e:
        log(f"rules failed: {e!r}")
    label.update_bundle_data()
    for prop in ["dialog_runtime_datas", "rules", "asset_bundle_data"]:
        try:
            log(f"{prop} = {label.get_editor_property(prop)!r}"[:2000])
        except Exception as e:
            log(f"{prop}: {e!r}")
    log(f"saved: {unreal.EditorAssetLibrary.save_loaded_asset(label, False)}")
except Exception as e:
    log(f"FAILED: {e!r}")
report()
