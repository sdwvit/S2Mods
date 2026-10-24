"""
ScopedDrahunka: imports the PU 3.5X scope's inventory icon (assets/T_inv_icon_threeline_scope.png, the
same art as UberToz's) into the mod. Texture settings are copied from UberToz's copy when that mod is in
the SDK; sRGB is always on. Run in the Mod Editor's Cmd box (Python mode):

    exec(open("Z:/home/sdwvit/IdeaProjects/S2Mods/Mods/ScopedDrahunka/editor/import_icon.py").read())

Re-running replaces the texture in place. Saves the imported asset.
"""
import unreal

SRC = "Z:/home/sdwvit/IdeaProjects/S2Mods/Mods/ScopedDrahunka/assets/T_inv_icon_threeline_scope.png"
DEST = "/ScopedDrahunka/GameLite/FPS_Game/UIRemaster/UITextures/Inventory/Attach"
NAME = "T_inv_icon_threeline_scope"
TEMPLATE = "/UberToz/_STALKER2/SkeletalMeshes/weapons/shg/TOZ34/threeline_scope_icon"
SETTINGS = ["compression_settings", "lod_group", "mip_gen_settings", "never_stream", "filter",
            "address_x", "address_y", "power_of_two_mode", "compression_no_alpha"]

task = unreal.AssetImportTask()
task.filename = SRC
task.destination_path = DEST
task.destination_name = NAME
task.automated = True
task.replace_existing = True
task.save = False
unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])

path = f"{DEST}/{NAME}"
texture = unreal.load_asset(path)
template = unreal.load_asset(TEMPLATE)
if not texture:
    unreal.log_error(f"[scoped_drahunka] import failed: {SRC}")
else:
    if template:
        for name in SETTINGS:
            try:
                texture.set_editor_property(name, template.get_editor_property(name))
            except Exception:
                pass
    else:
        unreal.log_warning("[scoped_drahunka] UberToz template not found, keeping import defaults")
        texture.set_editor_property("lod_group", unreal.TextureGroup.TEXTUREGROUP_UI)
        texture.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_EDITOR_ICON)
        texture.set_editor_property("mip_gen_settings", unreal.TextureMipGenSettings.TMGS_NO_MIPMAPS)
    texture.set_editor_property("srgb", True)
    unreal.EditorAssetLibrary.save_asset(path, only_if_is_dirty=False)
    unreal.log(f"[scoped_drahunka] imported {path}")
