"""
X16Scopes: exports the vanilla inventory textures needed to draw the missing X8/X16 weapon icons
(gun bodies, the X4/X8 overlays to align with, rails, scope item icons), each with its _upgrade twin,
as PNG to Saved/xn_icons. Run in the Mod Editor's Cmd box (Python mode):

    exec(open("S:/STALKER2ZoneKit/Stalker2/Saved/xn_export_icons.py").read())

Read-only for assets: nothing is saved or checked out.
"""
import os
import unreal

ROOT = "/Game/GameLite/FPS_Game/UIRemaster/UITextures/Inventory"
OUT = os.path.join(unreal.Paths.project_saved_dir(), "xn_icons")

# folder under ROOT -> texture names (lowercase); each is exported with its _upgrade twin when it exists
WANTED = {
    "WeaponAndAttachments/GP3A": ["t_inv_w_gp3a_body_01", "t_inv_w_gp3a_as02_en_x4scope_1", "t_inv_w_gp3a_toprail_01"],
    "WeaponAndAttachments/Arev": ["t_inv_w_arev_body", "t_inv_w_arev_precise_body", "t_inv_w_arev_x4scope", "t_inv_w_arev_precise_x8scope"],
    "WeaponAndAttachments/Fora": ["t_inv_w_fora_body", "t_inv_w_decider_body", "t_inv_w_fora_en_x4scope_1"],
    "WeaponAndAttachments/Grim": ["t_inv_w_grim_body", "t_inv_w_s15_body", "t_inv_w_grim_en_x4scope_1", "t_inv_w_grim_rail_custom"],
    "WeaponAndAttachments/AK74": ["t_inv_w_ak74_body", "t_inv_w_combatant_body", "t_inv_w_drowned_body", "t_inv_w_ak74_scope"],
    "WeaponAndAttachments/Mark": ["t_inv_w_mark_body", "t_inv_w_partner_body", "t_inv_w_mark_en_x4scope_1", "t_inv_w_mark_en_x8scope_1", "t_inv_w_mark_rail_top"],
    "WeaponAndAttachments/SKP": ["t_inv_w_skp_body", "t_inv_w_skp_x4scope", "t_inv_w_skp_x8scope", "t_inv_w_skp_scoperail"],
    "WeaponAndAttachments/M701": ["t_inv_w_m701_body", "t_inv_w_m701_en_x8scope_1"],
    # Scope art to reuse: RU X8 overlays as drawn on other guns, and the scope item icons.
    "WeaponAndAttachments/SVU": ["t_inv_w_svu_ru_x4scope_1", "t_inv_w_svu_ru_x8scope_1"],
    "WeaponAndAttachments/Gvintar": ["t_inv_w_gvintar_body", "t_inv_w_gvintar_ru_x4scope_1", "t_inv_w_gvintar_ru_x8scope_1"],
    "Attach": ["t_inv_icon_en_x8scope_1", "t_inv_icon_ru_x8scope_1"],
}

assets = unreal.EditorAssetLibrary
os.makedirs(OUT, exist_ok=True)
done, missing = [], []
for folder, names in WANTED.items():
    by_name = {}
    for path in assets.list_assets(f"{ROOT}/{folder}", recursive=False):
        by_name[path.split("/")[-1].split(".")[0].lower()] = path
    for name in names:
        for variant in (name, name + "_upgrade"):
            path = by_name.get(variant)
            if not path:
                if variant == name:
                    missing.append(f"{folder}/{variant}")
                continue
            texture = unreal.load_asset(path)
            task = unreal.AssetExportTask()
            task.object = texture
            task.filename = os.path.join(OUT, path.split("/")[-1].split(".")[0] + ".png")
            task.automated = True
            task.prompt = False
            task.replace_identical = True
            task.exporter = unreal.TextureExporterPNG()
            ok = unreal.Exporter.run_asset_export_task(task)
            (done if ok else missing).append(task.filename if ok else f"FAILED {path}")

unreal.log(f"[xn_icons] exported {len(done)} to {OUT}; missing/failed: {missing}")
