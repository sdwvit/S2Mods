"""Speaker similarity of takes to the reference voices (WavLM x-vectors, cosine). CPU only. No ASR.

usage: <venv with torch + transformers> -I voice_sim.py <spk_lang> <wav>...
Prints each take's similarity to its own reference (refs/higgs/<spk_lang>.wav) and to the other EN/UA references,
and flags takes that sit closer to another voice or below the own-ref threshold.
"""
import glob, os, sys
import numpy as np, soundfile as sf, torch
from transformers import AutoFeatureExtractor, WavLMForXVector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vo_env  # noqa: E402
os.chdir(vo_env.ROOT)
torch.set_num_threads(8)
FE = AutoFeatureExtractor.from_pretrained('microsoft/wavlm-base-plus-sv')
M = WavLMForXVector.from_pretrained('microsoft/wavlm-base-plus-sv').eval()


def load16(p):
    x, sr = sf.read(p, dtype='float32'); x = x.mean(1) if x.ndim > 1 else x
    if sr != 16000:
        t = np.arange(0, len(x) / sr, 1 / 16000); x = np.interp(t, np.arange(len(x)) / sr, x).astype('float32')
    return x


def emb(p):
    with torch.no_grad():
        e = M(**FE(load16(p), sampling_rate=16000, return_tensors='pt')).embeddings[0]
    return torch.nn.functional.normalize(e, dim=-1)


own = sys.argv[1]
refs = {os.path.basename(p)[:-4]: emb(p) for p in sorted(glob.glob('refs/higgs/*_en.wav') + glob.glob('refs/higgs/*_uk.wav'))}
for p in sys.argv[2:]:
    e = emb(p)
    sims = sorted(((float(e @ r), k) for k, r in refs.items()), reverse=True)
    mine = dict((k, s) for s, k in sims)[own]
    flag = '' if sims[0][1] == own or sims[0][1].startswith(own.split('_')[0]) else '  <-- closer to ' + sims[0][1]
    print(f'{mine:.3f} {p}  (best: {sims[0][1]} {sims[0][0]:.3f}, 2nd: {sims[1][1]} {sims[1][0]:.3f}){flag}')
