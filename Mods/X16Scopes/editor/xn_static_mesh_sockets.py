"""
X16Scopes: X8/X16 scope sockets on the guns' world static meshes (what a dropped gun shows).
Run in the Mod Editor's Cmd box (Python mode):

    exec(open("S:/STALKER2ZoneKit/Stalker2/Saved/xn_static_mesh_sockets.py").read())

Each target is the gun skeleton's X8ScopeSocket / X16ScopeSocket (jnt_offset), shifted by the small
offset between the mesh's own X4 socket and the skeleton's (2026-10-23 values). Missing sockets are
added; existing ones are moved there. Safe to re-run. The meshes must be checked out into X16Scopes.
"""
import unreal

MOD = "/X16Scopes/_Stalker_2/weapons"

# mesh -> {socket: (x, y, z)}
TARGETS = {
    "sturm_riffle/SM_ar_gp3/SM_GP3": {"X8ScopeSocket": (14.081, -0.108, 12.717), "X16ScopeSocket": (14.081, -0.108, 12.717)},
    "sturm_riffle/SM_ar_kharod000/SM_kha": {"X8ScopeSocket": (8.951, 0.040, 11.733), "X16ScopeSocket": (8.951, 0.040, 11.733)},
    "sturm_riffle/st_lav/SM_lav": {"X8ScopeSocket": (8.896, -2.082, 3.091), "X16ScopeSocket": (8.896, -2.082, 3.091)},
    "sturm_riffle/SM_ar_dnipro/SM_dnipr": {"X8ScopeSocket": (1.075, -0.019, 9.804), "X16ScopeSocket": (1.078, -0.019, 9.800)},
    "sniper_riffle/sr_svm/SM_svm": {"X8ScopeSocket": (13.835, -2.180, 4.809), "X16ScopeSocket": (13.835, -2.180, 4.809)},
    "sturm_riffle/SM_ar_fora0/SM_fora0": {"X8ScopeSocket": (-6.000, 0.500, 10.800), "X16ScopeSocket": (-6.000, 0.500, 10.800)},
    "sturm_riffle/SK_ar_grim0/SM_grim0": {"X8ScopeSocket": (-0.513, 0.000, 10.170), "X16ScopeSocket": (-0.513, 0.000, 10.170)},
    "sturm_riffle/st_ak74/SM_AK74": {"X8ScopeSocket": (6.572, -2.527, 3.352), "X16ScopeSocket": (6.572, -2.527, 3.352)},
    "DMR/dmr_gp3a/SM_Wpn_Gp3a_01": {"X8ScopeSocket": (11.000, 0.010, 12.713), "X16ScopeSocket": (11.000, 0.010, 12.713)},
    "sturm_riffle/st_arev/SM_Wpn_Arev_StaticMesh": {"X16ScopeSocket": (10.764, 0.000, 10.374)},
    "DMR/dmr_skp/SM_SKP": {"X16ScopeSocket": (15.455, 0.000, 9.786)},
    "sniper_riffle/sr_carabine_mar/SM_mar": {"X16ScopeSocket": (20.109, 0.033, 10.664)},
    "sniper_riffle/sr_m701/SM_m701": {"X16ScopeSocket": (17.420, 0.000, 9.581)},
}

assets = unreal.EditorAssetLibrary
report = []


def log(msg):
    report.append(msg)
    unreal.log(f"[xn_sm_sockets] {msg}")


for rel, sockets in TARGETS.items():
    path = f"{MOD}/{rel}"
    mesh = unreal.load_asset(path)
    if not mesh:
        log(f"NOT CHECKED OUT {path}")
        continue
    changes = []
    for name, (x, y, z) in sockets.items():
        loc = unreal.Vector(x, y, z)
        socket = mesh.find_socket(name)
        if socket:
            old = socket.get_editor_property("relative_location")
            if abs(old.x - x) + abs(old.y - y) + abs(old.z - z) < 0.0005:
                continue
            socket.set_editor_property("relative_location", loc)
            changes.append(f"moved {name} ({old.x:.3f},{old.y:.3f},{old.z:.3f}) -> ({x},{y},{z})")
        else:
            socket = unreal.new_object(unreal.StaticMeshSocket, outer=mesh)
            socket.set_editor_property("socket_name", name)
            socket.set_editor_property("relative_location", loc)
            mesh.add_socket(socket)
            changes.append(f"added {name} ({x},{y},{z})")
    if changes:
        mesh.modify()
        assets.save_asset(path, only_if_is_dirty=False)
        log(f"{rel.split('/')[-1]}: " + "; ".join(changes))
    else:
        log(f"{rel.split('/')[-1]}: ok")

unreal.log("[xn_sm_sockets] ---- report ----\n" + "\n".join(report))
