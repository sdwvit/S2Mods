"""Voice a short dialog between two speakers with Higgs Audio v3 (native PyTorch path from Higgs_v3-TTS-ComfyUI).

usage: <higgs venv python> -I higgs_dialog.py <script.json> <out_dir>
script.json: {"refs": {"a": {"wav": ..., "text": ...}, "b": {...}},
              "variants": [{"name": "v1", "lines": [{"speaker": "a", "text": "..."}, ...]}, ...]}
Writes <out_dir>/<variant>/<NN>_<speaker>.wav and <out_dir>/<variant>.wav (lines joined with turn-taking gaps).
"""
import json, os, sys
from types import SimpleNamespace

import numpy as np
import soundfile as sf
import torch

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vo_env  # noqa: E402
sys.path.insert(0, vo_env.HIGGS_SRC)
import native  # noqa: E402

MODEL = vo_env.HIGGS_MODEL
script_path, out_dir = sys.argv[1:3]
script = json.load(open(script_path))
model_dir = native.Path(MODEL) / os.listdir(MODEL)[0]
dev, dtype = torch.device("cuda:0"), torch.bfloat16

config = native.read_config(model_dir)
model = native.build_native_model(config, dtype, "sdpa")
native.load_native_weights(model, model_dir, dev, dtype)
model.to(dev).eval()
bundle = SimpleNamespace(model=model, tokenizer=native.load_tokenizer(model_dir),
                         codec=native.HiggsAudioCodec.from_pretrained(model_dir, device=dev, dtype=torch.float32),
                         attention="sdpa")

for variant in script["variants"]:
    vdir = f"{out_dir}/{variant['name']}"
    os.makedirs(vdir, exist_ok=True)
    parts, prev = [], None
    for i, line in enumerate(variant["lines"]):
        ref = script["refs"][line["speaker"]]
        out = native.generate_higgs_audio(
            bundle, text=line["text"], reference_audio=None, reference_audio_path=ref["wav"], reference_text=ref["text"],
            max_new_tokens=1536, temperature=0.8, top_p=0.95, top_k=50, seed=int(line.get("seed", 1234)),
            trim_reference_audio=True, silence_threshold_db=-42.0, max_reference_seconds=30.0)
        audio = out["waveform"].squeeze().numpy() if isinstance(out, dict) else out
        audio = native.trim_silence_edges(torch.from_numpy(audio), native.SAMPLE_RATE, -45.0).numpy()
        sf.write(f"{vdir}/{i:02d}_{line['speaker']}.wav", audio, native.SAMPLE_RATE)
        print(f"{variant['name']} {i:02d} {line['speaker']} {len(audio) / native.SAMPLE_RATE:.1f}s", flush=True)
        if prev is not None:  # quicker hand-over between speakers, a beat when the same man keeps talking
            gap = 0.35 if line["speaker"] != prev else 0.6
            parts.append(np.zeros(int(gap * native.SAMPLE_RATE), np.float32))
        parts.append(audio.astype(np.float32))
        prev = line["speaker"]
    sf.write(f"{out_dir}/{variant['name']}.wav", np.concatenate(parts), native.SAMPLE_RATE)
    print("->", f"{out_dir}/{variant['name']}.wav", f"{sum(map(len, parts)) / native.SAMPLE_RATE:.1f}s", flush=True)
