"""Voice a line sentence by sentence (each sentence with its own tags) and stitch the parts into one alt take.

usage: <higgs venv python> -I stitch_line.py <batch> <sid> "<part1>|||<part2>|||..." <feedback_id> --alt NAME
Each part is generated on its own (same length check and seed rerolls as redo_line.py), parts are joined with a
short gap and written as alt-NAME.wav (+ alt-NAME.txt with the parts joined by a space). The script is left alone.
"""
import json, os, subprocess, sys, tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np  # noqa: E402
import soundfile as sf  # noqa: E402
import vo_env  # noqa: E402
os.chdir(vo_env.ROOT)
args = sys.argv[1:]
i = args.index("--alt"); alt = args[i + 1]; del args[i:i + 2]
batch, sid, text = args[:3]
fid = args[3] if len(args) > 3 else None
parts = [p.strip() for p in text.split("|||") if p.strip()]
GAP = 0.3  # seconds between sentences


def event(status, message):
    ev = {"group": f"batch:{batch}", "sid": sid, "status": status, "message": message}
    if fid:
        ev["feedback_id"] = fid
    vo_env.post_event(ev)


s = json.load(open(f"higgs/{batch}.json", encoding="utf-8"))
line = next(l for l in s["lines"] if l["sid"] == sid)
name = f"{line['n']:02d}_{sid}"
event("working", f"Stitching {len(parts)} sentences: {' '.join(parts)}")
audio = []
with tempfile.TemporaryDirectory() as tmp:
    lines = [dict(line, n=k, sid=f"p{k}", text=p) for k, p in enumerate(parts)]
    json.dump({"refs": s["refs"], "lines": lines}, open(f"{tmp}/line.json", "w", encoding="utf-8"), ensure_ascii=False)
    subprocess.run([sys.executable, "-I", os.path.join(vo_env.PIPE, "higgs_lines.py"), f"{tmp}/line.json", f"{tmp}/out", "1", "6"],
                   check=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    sr = None
    for k in range(len(parts)):
        d = f"{tmp}/out/{k:02d}_p{k}"
        wavs = sorted(f for f in os.listdir(d) if f.endswith(".wav")) if os.path.isdir(d) else []
        if not wavs:
            event("question", f"No take passed the length check for sentence {k + 1}: {parts[k]}")
            sys.exit(1)
        a, sr = sf.read(f"{d}/{wavs[0]}", dtype="float32")
        if audio:
            audio.append(np.zeros(int(GAP * sr), np.float32))
        audio.append(a)
    dst = f"higgs/{batch}/{name}/alt-{alt}.wav"
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    sf.write(dst, np.concatenate(audio), sr)
open(dst[:-4] + ".txt", "w", encoding="utf-8").write(" ".join(parts) + "\n")
event("regenerated", f"Added alt-{alt} (stitched from {len(parts)} sentences): {' '.join(parts)}")
print("->", dst)
