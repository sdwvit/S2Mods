"""Fits X8/X16 scope overlays onto gun icon canvases (ImageMagick). Regions are hand-picked from gridded previews."""
import subprocess, os, sys
V = "/home/sdwvit/MX500-900/games/stalker-modding/assets/vanilla"
A = "/home/sdwvit/IdeaProjects/S2Mods/Mods/X16Scopes/assets"
OUT = os.environ.get("ICON_OUT", "/home/sdwvit/MX500-900/games/stalker-modding/assets/X16Scopes/out")
os.makedirs(OUT, exist_ok=True)

def mk(*a): return subprocess.run(["magick", *a], check=True, capture_output=True, text=True).stdout.strip()
def size(f): w, h = mk(f, "-format", "%w %h", "info:").split(); return int(w), int(h)

def bbox(f, r):
    """(left, top, right, bottom) of the opaque pixels of f inside region r = (x0, y0, x1, y1)."""
    x0, y0, x1, y1 = r
    g = mk(f, "-crop", f"{x1-x0}x{y1-y0}+{x0}+{y0}", "+repage", "-alpha", "extract", "-threshold", "8%", "-format", "%@", "info:")
    wh, x, y = g.split("+"); w, h = map(int, wh.split("x"))
    return (x0 + int(x), y0 + int(y), x0 + int(x) + w, y0 + int(y) + h)

def clear(f, rects, dst):
    """f with the given rectangles made fully transparent."""
    draw = " ".join(f"rectangle {a},{b} {c},{d}" for a, b, c, d in rects)
    mk(f, "(", "+clone", "-alpha", "extract", "-fill", "black", "-draw", draw, ")", "-alpha", "off", "-compose", "CopyOpacity", "-composite", dst)
    return dst

def clear_poly(f, polys, dst):
    """f with the given polygons (lists of (x, y)) made fully transparent."""
    draw = " ".join("polygon " + " ".join(f"{x},{y}" for x, y in p) for p in polys)
    mk(f, "(", "+clone", "-alpha", "extract", "-fill", "black", "-draw", draw, ")", "-alpha", "off", "-compose", "CopyOpacity", "-composite", dst)
    return dst

def place(layer, s, ox, oy, canvas, base, dst):
    """Layer (whole canvas) scaled by s, its origin put at (ox, oy), over base."""
    cw, ch = canvas
    args = ["-size", f"{cw}x{ch}", "xc:none"]
    if base: args += [base, "-composite"]
    # Lanczos (the default for alpha images is the softer Mitchell); enlarged art also gets a light
    # colour-only unsharp so it stays as crisp as the vanilla art (sharpening alpha would fringe the edges)
    sharpen = ["-channel", "RGB", "-unsharp", "0x0.7+0.8+0.02", "+channel"] if s > 1 else []
    args += ["(", layer, "-filter", "Lanczos", "-resize", f"{s*100:.4f}%", *sharpen, ")", "-geometry", f"{round(ox):+d}{round(oy):+d}", "-compose", "over", "-composite",
             # 8-bit like the vanilla exports: the xc:none canvas is 16-bit, and the editor imports a 16-bit
             # PNG as a linear 16-bit texture, which shows the art washed out
             "-depth", "8", "-strip", f"PNG32:{dst}"]
    mk(*args)

def anchor_fit(layer, ref, tgt, s, canvas, base, dst, margin=2):
    """Puts layer point ref onto canvas point tgt at scale s, shrinking about tgt until the layer fits the canvas."""
    (ax, ay), (tx, ty), (cw, ch) = ref, tgt, canvas
    l, t, r, b = bbox(layer, (0, 0, *size(layer)))
    lim = [s]
    if l < ax: lim.append((tx - margin) / (ax - l))
    if r > ax: lim.append((cw - margin - tx) / (r - ax))
    if t < ay: lim.append((ty - margin) / (ay - t))
    if b > ay: lim.append((ch - margin - ty) / (b - ay))
    s2 = min(lim)
    ox, oy = tx - ax * s2, ty - ay * s2
    place(layer, s2, ox, oy, canvas, base, dst)
    print(f"{os.path.basename(dst)}: s={s2:.3f}" + (f" (shrunk {s2/s:.3f} to fit)" if s2 < s else "") + f" origin {ox:+.0f}{oy:+.0f}")
    return lambda b: tuple(o + v * s2 for o, v in zip((ox, oy) * (len(b) // 2), b))

def fit(layer, ref, tgt, s, align, canvas, base, dst):
    """Maps ref box onto tgt box (left edge + top or bottom edge), scale s; places layer accordingly."""
    ry = ref[3] if align == "bottom" else ref[1]
    ty = tgt[3] if align == "bottom" else tgt[1]
    return anchor_fit(layer, (ref[0], ry), (tgt[0], ty), s, canvas, base, dst)
