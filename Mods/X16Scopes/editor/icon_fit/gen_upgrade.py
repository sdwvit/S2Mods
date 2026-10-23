from fit import *
w = lambda b: b[2] - b[0]
U = "_upgrade"
mark_x4 = f"{V}/T_inv_w_mark_en_x4scope_1{U}.png"; mark_x8 = f"{V}/T_inv_w_mark_en_x8scope_1{U}.png"
ref_cluster = bbox(mark_x4, (500, 50, 900, 260)); ref_scope = bbox(mark_x4, (550, 50, 900, 190))
mark_tube = bbox(mark_x8, (500, 0, 1100, 215))
mark_mount = (748, 247)  # bottom-centre of the X8 mount plate
x8 = {}
# rail: where the mount plate's bottom-centre goes when the X4 cluster bottom is not the rail line
for gun, f, cluster, scope_rows, rail in [
    ("gp3a", f"{V}/T_Inv_W_Gp3a_As02_En_x4scope_1_Upgrade.png", (480, 50, 900, 320), (540, 50, 900, 190), (704, 226)),
    ("fora", f"{V}/T_inv_w_fora_en_x4scope_1{U}.png", (640, 0, 1000, 240), (680, 0, 1000, 150), None),
    ("grim", f"{V}/T_inv_w_grim_en_x4scope_1{U}.png", (700, 0, 1100, 220), (700, 0, 1100, 150), None),
]:
    s = w(bbox(f, scope_rows)) / w(ref_scope)
    dst = f"{OUT}/T_inv_w_{gun}_en_x8scope_1{U}.png"
    to = anchor_fit(mark_x8, mark_mount, rail, s, size(f), None, dst) if rail else fit(mark_x8, ref_cluster, bbox(f, cluster), s, "bottom", size(f), None, dst)
    x8[gun] = (dst, to(mark_tube), to)
ss_tube = bbox(f"{V}/T_inv_w_sharpshooter_en_x8scope_1{U}.PNG", (400, 0, 1100, 200))
x16, ss_mount = f"{A}/T_inv_w_sharpshooter_en_x16scope_1{U}.png", (700, 225)
targets = {g: (size(f), None, tube, to(mark_mount)) for g, (f, tube, to) in x8.items()}
arev_x8 = f"{V}/T_inv_w_arev_precise_x8scope{U}.png"
arev_rail = clear_poly(arev_x8, [[(695, 0), (1200, 0), (1200, 233), (1160, 226), (700, 143), (695, 143)]], f"{OUT}/_arev_x8_rail{U}.png")
for gun, f, region, mount, base in [
    ("mark", mark_x8, (500, 0, 1100, 215), (930, 292), None),  # on the body's front rail (x 850-1010)
    ("m701", f"{V}/T_inv_w_m701_en_x8scope_1{U}.png", (480, 0, 1100, 190), (730, 203), None),
    ("skp", f"{V}/T_inv_w_skp_x8scope{U}.png", (480, 0, 1050, 190), (700, 188), None),
    ("arev", arev_x8, (600, 0, 1200, 130), (860, 195), arev_rail),
]:
    targets[gun] = (size(f), base, bbox(f, region), mount)
shrink = {"mark": 0.88}  # Mark: smaller, so it sits on the short handguard rail
for gun, (canvas, base, tube, mount) in targets.items():
    anchor_fit(x16, ss_mount, mount, w(tube) / w(ss_tube) * shrink.get(gun, 1), canvas, base, f"{OUT}/T_inv_w_{gun}_en_x16scope_1{U}.png")
