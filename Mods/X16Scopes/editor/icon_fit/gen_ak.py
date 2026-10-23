from fit import *
V2 = "/home/sdwvit/MX500-900/games/stalker-modding/assets/vanilla"
w = lambda b: b[2] - b[0]
for U, tube_gv, tube_ak, mnt in [
    ("", (240, 0, 520, 56), (320, 0, 560, 70), {"gv": (280, 58, 430, 135), "gv16": (280, 80, 430, 140), "ak": (370, 72, 480, 140)}),
    ("_upgrade", (500, 0, 1300, 170), (400, 0, 1000, 100), {"gv": (780, 220, 1000, 340), "gv16": (800, 260, 1050, 380), "ak": (620, 150, 800, 210)}),
]:
    gv4, gv8, gv16 = f"{V2}/T_inv_w_gvintar_ru_x4scope_1{U}.png", f"{V2}/T_inv_w_gvintar_ru_x8scope_1{U}.PNG", f"{A}/T_inv_w_gvintar_ua_x16scope_1{U}.PNG"
    ak4 = f"{V2}/T_inv_w_ak74_scope{U}.png"
    s = w(bbox(ak4, tube_ak)) / w(bbox(gv4, tube_gv))
    ak_mount = bbox(ak4, mnt["ak"])
    fit(gv8, bbox(gv4, mnt["gv"]), ak_mount, s, "bottom", size(ak4), None, f"{OUT}/T_inv_w_ak74_ru_x8scope_1{U}.png")
    fit(gv16, bbox(gv16, mnt["gv16"]), ak_mount, s, "bottom", size(ak4), None, f"{OUT}/T_inv_w_ak74_ua_x16scope_1{U}.png")
