"""Regenerate one line of a batch with new text and report progress to the review site.

usage: <higgs venv python> -I redo_line.py <batch> <sid> "<new text>" [feedback_id] [--alt NAME [--ref SPK]]
With --alt NAME the take is added as alt-NAME.wav (+ alt-NAME.txt with the text) and the script is left alone,
so several alternatives can sit on one line for the user to pick from.
Updates higgs/<batch>.json (and higgs/<base>.json for *_fix batches), generates one s2024 take
(rerolling seeds if the length is off), replaces higgs/<batch>/<NN>_<sid>/s2024.wav and posts
working/regenerated events.
"""
import json, os, shutil, subprocess, sys, tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vo_env  # noqa: E402
os.chdir(vo_env.ROOT)
args = sys.argv[1:]
alt = None
if "--alt" in args:
    i = args.index("--alt"); alt = args[i + 1]; del args[i:i + 2]
ref_spk = None  # --ref SPK: voice this take with another reference from the script's refs (e.g. ward_angry); alt only
if "--ref" in args:
    i = args.index("--ref"); ref_spk = args[i + 1]; del args[i:i + 2]
batch, sid, text = args[:3]
fid = args[3] if len(args) > 3 else None


def event(status, message):
    ev = {"group": f"batch:{batch}", "sid": sid, "status": status, "message": message}
    if fid:
        ev["feedback_id"] = fid
    vo_env.post_event(ev)


line = None
for path in {f"higgs/{batch}.json", f"higgs/{batch.removesuffix('_fix')}.json"}:
    if not os.path.exists(path):
        continue
    s = json.load(open(path, encoding="utf-8"))
    for l in s["lines"]:
        if l["sid"] == sid:
            l["text"] = text
            line, refs = l, s["refs"]
    if not alt:
        json.dump(s, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
if line is None:
    sys.exit(f"{sid} not found in higgs/{batch}.json")
if ref_spk:
    assert alt and ref_spk in refs, "--ref needs --alt and a key in the script's refs"
    line = dict(line, speaker=ref_spk)

event("working", f"Regenerating: {text}")
with tempfile.TemporaryDirectory() as tmp:
    json.dump({"refs": refs, "lines": [line]}, open(f"{tmp}/line.json", "w", encoding="utf-8"), ensure_ascii=False)
    subprocess.run([sys.executable, "-I", os.path.join(vo_env.PIPE, "higgs_lines.py"), f"{tmp}/line.json", f"{tmp}/out", "1", "6"], check=True,
                   stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    name = f"{line['n']:02d}_{sid}"
    takes = [f for f in os.listdir(f"{tmp}/out/{name}") if f.endswith(".wav")]
    if not takes:
        event("question", "No take passed the length check after 6 seeds; text may need changing")
        sys.exit(1)
    os.makedirs(f"higgs/{batch}/{name}", exist_ok=True)
    dst = f"higgs/{batch}/{name}/" + (f"alt-{alt}.wav" if alt else "s2024.wav")
    if alt:
        open(dst[:-4] + ".txt", "w", encoding="utf-8").write(text + "\n")
    shutil.move(f"{tmp}/out/{name}/{takes[0]}", dst)  # tmp may be on another filesystem
event("regenerated", (f"Added alt-{alt} ({takes[0][:-4]}) from: " if alt else f"New take ({takes[0][:-4]}) from: ") + text)
print("->", dst)
