"""
X16Scopes: imports the drawn X8/X16 weapon-specific scope icons (editor/icon_fit, reviewed PNGs in
assets/X16Scopes) into the mod, next to the existing ones under WeaponAndAttachments/<Gun>, each with
its _upgrade twin (the game derives the _upgrade texture by name). Texture settings are copied from the
mod's Sharpshooter X16 icons; sRGB is always on. Run in the Mod Editor's Cmd box (Python mode):

    exec(open("Z:/home/sdwvit/IdeaProjects/S2Mods/Mods/X16Scopes/editor/xn_import_icons.py").read())

Re-running replaces the textures in place. Saves the imported assets.
"""
import unreal

SRC = "Z:/home/sdwvit/MX500-900/games/stalker-modding/assets/X16Scopes"
ROOT = "/X16Scopes/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/WeaponAndAttachments"
TEMPLATE = f"{ROOT}/M16/T_inv_w_sharpshooter_en_x16scope_1"

# folder under ROOT -> texture names; each is imported with its _upgrade twin
ICONS = {
    "GP3A": ["T_inv_w_gp3a_en_x8scope_1", "T_inv_w_gp3a_en_x16scope_1"],
    "Fora": ["T_inv_w_fora_en_x8scope_1", "T_inv_w_fora_en_x16scope_1"],
    "Grim": ["T_inv_w_grim_en_x8scope_1", "T_inv_w_grim_en_x16scope_1"],
    "AK74": ["T_inv_w_ak74_ru_x8scope_1", "T_inv_w_ak74_ua_x16scope_1"],
    "Arev": ["T_inv_w_arev_en_x16scope_1"],
    "Mark": ["T_inv_w_mark_en_x16scope_1"],
    "SKP": ["T_inv_w_skp_en_x16scope_1"],
    "M701": ["T_inv_w_m701_en_x16scope_1"],
}
# srgb is set on explicitly below. The PNGs must be 8-bit: a 16-bit PNG imports as a linear 16-bit texture
# and shows the art washed out (icon_fit/fit.py writes 8-bit).
SETTINGS = ["compression_settings", "lod_group", "mip_gen_settings", "never_stream", "filter",
            "address_x", "address_y", "power_of_two_mode", "compression_no_alpha"]

assets = unreal.EditorAssetLibrary


def template_settings(path):
    texture = unreal.load_asset(path)
    if not texture:
        unreal.log_warning(f"[xn_icons] template {path} not found, keeping import defaults")
        return {}
    out = {}
    for name in SETTINGS:
        try:
            out[name] = texture.get_editor_property(name)
        except Exception:
            pass
    return out


tasks = []
for folder, names in ICONS.items():
    for name in names:
        for variant in (name, name + "_upgrade"):
            task = unreal.AssetImportTask()
            task.filename = f"{SRC}/{variant}.png"
            task.destination_path = f"{ROOT}/{folder}"
            task.destination_name = variant
            task.automated = True
            task.replace_existing = True
            task.save = False
            tasks.append(task)
unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks(tasks)

settings = {"": template_settings(TEMPLATE), "_upgrade": template_settings(TEMPLATE + "_upgrade")}
done, failed = [], []
for task in tasks:
    path = f"{task.destination_path}/{task.destination_name}"
    texture = unreal.load_asset(path)
    if not texture:
        failed.append(task.filename)
        continue
    for name, value in settings["_upgrade" if path.endswith("_upgrade") else ""].items():
        texture.set_editor_property(name, value)
    texture.set_editor_property("srgb", True)
    texture.post_edit_change()
    assets.save_asset(path, only_if_is_dirty=False)
    done.append(path)

unreal.log(f"[xn_icons] imported {len(done)} of {len(tasks)}; failed: {failed}")
