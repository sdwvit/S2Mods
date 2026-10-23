from fit import *
w = lambda b: b[2] - b[0]
# --- X8 onto GP3A / Fora / Grim: Mark's X8 (with mount), placed on each gun's X4 mount line ---
mark_x4 = f"{V}/T_inv_w_mark_en_x4scope_1.png"; mark_x8 = f"{V}/T_inv_w_mark_en_x8scope_1.png"
ref_cluster = bbox(mark_x4, (480, 0, 640, 110)); ref_scope = bbox(mark_x4, (480, 0, 640, 68))
mark_tube = bbox(mark_x8, (400, 0, 640, 58))
mark_mount = (525, 80)  # bottom-centre of the X8 mount plate
x8_tubes = {}
# rail: where the mount plate's bottom-centre goes when the X4 cluster bottom is not the rail line
for gun, f, cluster, scope_rows, rail in [
    ("gp3a", f"{V}/T_Inv_W_Gp3a_As02_En_x4scope_1.png", (500, 0, 700, 110), (500, 0, 700, 68), (580, 75)),
    ("fora", f"{V}/T_inv_w_fora_en_x4scope_1.png", (300, 0, 430, 80), (300, 0, 430, 60), None),
    ("grim", f"{V}/T_inv_w_grim_en_x4scope_1.png", (250, 0, 420, 80), (250, 0, 420, 52), None),
]:
    s = w(bbox(f, scope_rows)) / w(ref_scope)
    to = anchor_fit(mark_x8, mark_mount, rail, s, size(f), None, f"{OUT}/T_inv_w_{gun}_en_x8scope_1.png") if rail else fit(mark_x8, ref_cluster, bbox(f, cluster), s, "bottom", size(f), None, f"{OUT}/T_inv_w_{gun}_en_x8scope_1.png")
    x8_tubes[gun] = (f"{OUT}/T_inv_w_{gun}_en_x8scope_1.png", to(mark_tube), to)
# --- X16 onto every X8: Sharpshooter's X16 with its own mount, mount bottom-centre on the X8 mount's
# (scale = X8 tube / Sharpshooter X8 tube). Only the rail and sights of the X8 overlay are kept (ARev). ---
ss_tube = bbox(f"{V}/T_inv_w_sharpshooter_en_x8scope_1.PNG", (280, 0, 520, 58))
x16, ss_mount = f"{A}/T_inv_w_sharpshooter_en_x16scope_1.png", (409, 75)
# gun: (canvas, base layer or None, X8 tube box, X8 mount bottom-centre)
targets = {g: (size(f), None, tube, to(mark_mount)) for g, (f, tube, to) in x8_tubes.items()}
arev_x8 = f"{V}/T_inv_w_arev_precise_x8scope.png"
arev_rail = clear_poly(arev_x8, [[(255, 0), (480, 0), (480, 70), (255, 68)]], f"{OUT}/_arev_x8_rail.png")
for gun, f, tube_region, mount, base in [
    ("mark", mark_x8, (400, 0, 640, 58), (465, 89), None),  # on the body's front rail (x 430-500)
    ("m701", f"{V}/T_inv_w_m701_en_x8scope_1.png", (400, 0, 650, 56), (530, 82), None),
    ("skp", f"{V}/T_inv_w_skp_x8scope.png", (400, 0, 650, 54), (530, 68), None),
    ("arev", arev_x8, (255, 0, 460, 57), (360, 74), arev_rail),
]:
    targets[gun] = (size(f), base, bbox(f, tube_region), mount)
shrink = {"mark": 0.88}  # Mark: smaller, so it sits on the short handguard rail
for gun, (canvas, base, tube, mount) in targets.items():
    anchor_fit(x16, ss_mount, mount, w(tube) / w(ss_tube) * shrink.get(gun, 1), canvas, base, f"{OUT}/T_inv_w_{gun}_en_x16scope_1.png")
