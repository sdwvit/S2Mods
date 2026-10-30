"""Fit audio -> face-channel regression on one vanilla speaker's face anims and predict tracks for new lines.

usage: python -I fit_lipsync.py <facedump_dir> <voices_root> <final_dir> <out_json>
facedump_dir: JSONs from dump_face_anim.py (curves + per-frame bone transforms) of one vanilla speaker; the speaker
              is read from the anim names (AS_FAC_<EN|UA>_<speaker>_<key>)
voices_root:  <ZoneKit>/O/Voices (English(US)/S2_Live/VO_<speaker>_<key>.wav ...)
final_dir:    {en,uk}/VO_<speaker>_<SID>.wav (the new lines, e.g. wwise_stage/); every speaker but pc (Skif has no face)
Writes out_json: {"fps", "channels": {name: held-out corr},
                  "anims": {asset_name: {"length", "frames", "base", "base_path", "tracks": {channel: [v per frame]}}}}
"base_path" is the base anim's path under the dumped folder (dump_face_anim.py's VANILLA).
Channel names: "curve:<name>" or "bone:<bone>:<tx|ty|tz|roll|pitch|yaw>".
"""
import glob, json, os, sys
import numpy as np
import soundfile as sf
import torch, torchaudio

dump_dir, voices_root, final_dir, out_json = sys.argv[1:5]
LANG = {"EN": "English(US)", "UA": "Ukrainian(UA)"}
CTX = 6  # frames of audio context on each side
DOF = ["tx", "ty", "tz", "roll", "pitch", "yaw"]


def load_anim(path):
    d = json.load(open(path))
    n, length = d["frames"], d["length"]
    t = np.linspace(0, length, n)
    ch = {}
    for name, keys in d["curves"].items():
        k = np.array(keys) if keys else np.zeros((0, 2))
        if len(k):
            ch[f"curve:{name}"] = np.interp(t, k[:, 0], k[:, 1])
    for bone, frames in d["bones"].items():
        a = np.array(frames)
        for i, dof in enumerate(DOF):
            ch[f"bone:{bone}:{dof}"] = a[:, i]
    return d, n, length, ch


def features(wav, n_frames, length):
    audio, sr = sf.read(wav, dtype="float32")
    if audio.ndim > 1:
        audio = audio.mean(1)
    x = torchaudio.functional.resample(torch.from_numpy(audio), sr, 16000)
    hop = 16000 * length / max(1, n_frames - 1)
    mel = torchaudio.transforms.MelSpectrogram(16000, n_fft=1024, hop_length=int(round(hop)), n_mels=40)(x)
    f = torch.log(mel + 1e-5).T.numpy()  # frames x 40
    f = np.pad(f, ((0, max(0, n_frames - len(f))), (0, 0)), mode="edge")[:n_frames]
    pad = np.pad(f, ((CTX, CTX), (0, 0)), mode="edge")
    return np.hstack([pad[i:i + n_frames] for i in range(2 * CTX + 1)])


# ---- training pairs
pairs = []
base_path = {}  # asset name -> its path under the dumped folder
for p in sorted(glob.glob(f"{dump_dir}/*.json")):
    d, n, length, ch = load_anim(p)
    asset = os.path.basename(d["name"])  # AS_FAC_EN_<speaker>_<key>
    _, _, lang, speaker, key = asset.split("_", 4)
    wav = f"{voices_root}/{LANG[lang]}/S2_Live/VO_{speaker}_{key}.wav"
    if not os.path.exists(wav):
        print("no wav for", asset)
        continue
    base_path[asset] = d["name"]
    pairs.append((asset, n, length, ch, features(wav, n, length)))
print(len(pairs), "training pairs")
fps = np.median([(n - 1) / l for _, n, l, _, _ in pairs])

names = sorted(set.intersection(*[set(c) for _, _, _, c, _ in pairs]))
Y = np.vstack([np.stack([c[k] for k in names], 1) for _, _, _, c, _ in pairs])
X = np.vstack([f for *_, f in pairs])
keep = Y.std(0) > 1e-3
names = [k for k, m in zip(names, keep) if m]
Y = Y[:, keep]
mx, sx = X.mean(0), X.std(0) + 1e-6
my, sy = Y.mean(0), Y.std(0) + 1e-6


def ridge(X, Y, lam=30.0):
    Xn = np.hstack([(X - mx) / sx, np.ones((len(X), 1))])
    return np.linalg.solve(Xn.T @ Xn + lam * np.eye(Xn.shape[1]), Xn.T @ ((Y - my) / sy))


def predict(W, X):
    return (np.hstack([(X - mx) / sx, np.ones((len(X), 1))]) @ W) * sy + my


# ---- held-out validation: leave every 5th line out
test = set(range(0, len(pairs), 5))
tr = [i for i in range(len(pairs)) if i not in test]
idx = np.cumsum([0] + [p[1] for p in pairs])
rows = lambda ids: np.concatenate([np.arange(idx[i], idx[i + 1]) for i in ids])
W = ridge(X[rows(tr)], Y[rows(tr)])
P, T = predict(W, X[rows(test)]), Y[rows(test)]
corr = np.array([np.corrcoef(P[:, j], T[:, j])[0, 1] if T[:, j].std() > 1e-6 else 0 for j in range(len(names))])
order = np.argsort(-corr)
print("best-predicted channels (held-out corr):")
for j in order[:25]:
    print(f"  {corr[j]:.2f}  {names[j]}")
driven = [j for j in range(len(names)) if corr[j] > 0.35]
print(len(driven), "of", len(names), "channels driven by audio")

# ---- final fit on all lines, predict new ones
W = ridge(X, Y)
out = {"fps": float(fps), "channels": {names[j]: float(corr[j]) for j in driven}, "anims": {}}
for lang_dir, lang in (("en", "EN"), ("uk", "UA")):
    for wav in sorted(glob.glob(f"{final_dir}/{lang_dir}/VO_*.wav")):
        speaker, key = os.path.basename(wav)[3:-4].split("_", 1)
        if speaker == "pc":
            continue
        info = sf.info(wav)
        length = info.frames / info.samplerate
        n = int(round(length * fps)) + 1
        pred = predict(W, features(wav, n, length))
        # base anim for the channels audio doesn't drive: the shortest vanilla line at least as long
        cands = sorted([(l, a) for a, _, l, _, _ in pairs if a.split("_")[2] == lang and l >= length]) or \
                sorted([(-l, a) for a, _, l, _, _ in pairs if a.split("_")[2] == lang])
        out["anims"][f"AS_FAC_{lang}_{speaker}_{key}"] = {
            "length": length, "frames": n, "base": cands[0][1], "base_path": base_path[cands[0][1]],
            "tracks": {names[j]: [round(float(v), 4) for v in pred[:, j]] for j in driven},
        }
        print(f"AS_FAC_{lang}_{speaker}_{key}: {length:.2f}s, base {cands[0][1]}")
json.dump(out, open(out_json, "w"))
print("->", out_json)
