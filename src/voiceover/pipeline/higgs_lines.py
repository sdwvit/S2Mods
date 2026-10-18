"""Batch-voice script lines with Higgs Audio v3, keeping N good takes per line.

usage: <higgs venv python> -I higgs_lines.py <lines.json> <out_dir> [takes=2] [max_tries=6]
lines.json: {"refs": {"<spk>": {"wav": ..., "text": ...}},
             "lines": [{"n": NN, "sid": ..., "speaker": ..., "text": "<tagged text>"}, ...]}
A take is kept when its length fits the text (about 13 chars/s, see expected()); otherwise it is discarded
(never written) and the next seed is tried. Writes <out_dir>/<NN>_<sid>/s<seed>.wav, <out_dir>/log.json and
<out_dir>/all.wav (per line: take A, 1 s, take B, then 2 s before the next line).
"""
import json, os, re, sys, time
from types import SimpleNamespace

import numpy as np
import soundfile as sf
import torch

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vo_env  # noqa: E402
sys.path.insert(0, vo_env.HIGGS_SRC)
import native  # noqa: E402

MODEL = vo_env.HIGGS_MODEL
SEEDS = [2024, 7, 11, 99, 123, 555, 31337, 4242]  # 2024 won the first listening tests; later batches lead with it
TOKENS_PER_S = 30  # observed: 105 audio tokens -> 3.5 s

lines_path, out_dir = sys.argv[1:3]
takes = int(sys.argv[3]) if len(sys.argv) > 3 else 2
max_tries = int(sys.argv[4]) if len(sys.argv) > 4 else 6
script = json.load(open(lines_path, encoding="utf-8"))


def expected(text):
    """Rough spoken length in seconds and the accepted window."""
    pauses = text.count("<|prosody:pause|>") * 0.55 + text.count("<|prosody:long_pause|>") * 1.1
    plain = re.sub(r"<\|[^|]*\|>", "", text)
    secs = len(plain) / 13 + pauses
    return secs, (0.55 * secs, 1.7 * secs + 0.6)


model_dir = native.Path(MODEL) / os.listdir(MODEL)[0]
dev, dtype = torch.device("cuda:0"), torch.bfloat16
config = native.read_config(model_dir)
model = native.build_native_model(config, dtype, "sdpa")
native.load_native_weights(model, model_dir, dev, dtype)
model.to(dev).eval()
bundle = SimpleNamespace(model=model, tokenizer=native.load_tokenizer(model_dir),
                         codec=native.HiggsAudioCodec.from_pretrained(model_dir, device=dev, dtype=torch.float32),
                         attention="sdpa")

os.makedirs(out_dir, exist_ok=True)
log, joined = [], []
sr = native.SAMPLE_RATE
for line in script["lines"]:
    ref = script["refs"][line["speaker"]]
    secs, (lo, hi) = expected(line["text"])
    ldir = f"{out_dir}/{line['n']:02d}_{line['sid']}"
    os.makedirs(ldir, exist_ok=True)
    kept, tried = [], []
    for seed in SEEDS[:max_tries]:
        t = time.time()
        out = native.generate_higgs_audio(
            bundle, text=line["text"], reference_audio=None, reference_audio_path=ref["wav"], reference_text=ref["text"],
            max_new_tokens=min(1536, int((hi * 1.3 + 1) * TOKENS_PER_S)), temperature=0.8, top_p=0.95, top_k=50,
            seed=seed, trim_reference_audio=True, silence_threshold_db=-42.0, max_reference_seconds=30.0)
        audio = out["waveform"].squeeze().numpy() if isinstance(out, dict) else out
        audio = native.trim_silence_edges(torch.from_numpy(audio), sr, -45.0).numpy()
        dur = len(audio) / sr
        ok = lo <= dur <= hi
        tried.append({"seed": seed, "dur": round(dur, 2), "ok": ok})
        print(f"{line['n']:02d} {line['sid']} s{seed} {dur:.1f}s (want {lo:.1f}-{hi:.1f}) {'ok' if ok else 'DROP'}"
              f" [{time.time() - t:.0f}s]", flush=True)
        if ok:
            sf.write(f"{ldir}/s{seed}.wav", audio, sr)
            kept.append(audio.astype(np.float32))
            if len(kept) == takes:
                break
    log.append({**line, "expected": round(secs, 2), "tries": tried, "kept": len(kept)})
    json.dump(log, open(f"{out_dir}/log.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for i, a in enumerate(kept):
        joined += [a, np.zeros(int((1.0 if i < len(kept) - 1 else 2.0) * sr), np.float32)]
    if joined:
        sf.write(f"{out_dir}/all.wav", np.concatenate(joined), sr)

short = [f"{l['n']:02d}" for l in log if l["kept"] < takes]
print(f"done: {len(log)} lines, under {takes} takes: {short or 'none'} -> {out_dir}/all.wav", flush=True)
