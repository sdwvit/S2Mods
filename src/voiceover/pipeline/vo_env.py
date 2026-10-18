"""Shared settings for the voiceover pipeline scripts.

Values come from the environment, else from the repo's .env (same names):
  VOICEOVER_ROOT        voice workspace: higgs/, refs/, review/, archive/ (required)
  VOICEOVER_HIGGS_SRC   checkout of github.com/Saganaki22/Higgs_v3-TTS-ComfyUI (default <root>/src/higgs-comfy)
  VOICEOVER_HIGGS_MODEL snapshots dir of bosonai/higgs-tts-3-4b (default: the Hugging Face cache)
  REVIEW_PORT           review server port for progress events (default 8765)
Scripts run with `python -I`, which leaves the script's folder off sys.path, so each one adds it before importing this.
"""
import json, os, sys, urllib.request

PIPE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(os.path.dirname(PIPE)))


def env(name, default=None):
    if os.environ.get(name):
        return os.environ[name]
    try:
        for ln in open(os.path.join(REPO, ".env"), encoding="utf-8"):
            if ln.startswith(name + "=") and ln.split("=", 1)[1].strip():
                return ln.split("=", 1)[1].strip()
    except FileNotFoundError:
        pass
    return default


ROOT = env("VOICEOVER_ROOT") or sys.exit("Set VOICEOVER_ROOT (environment or .env) to the voice workspace.")
HIGGS_SRC = env("VOICEOVER_HIGGS_SRC", os.path.join(ROOT, "src", "higgs-comfy"))
HIGGS_MODEL = env("VOICEOVER_HIGGS_MODEL", os.path.expanduser("~/.cache/huggingface/hub/models--bosonai--higgs-tts-3-4b/snapshots"))
PORT = env("REVIEW_PORT", "8765")


def post_event(ev):
    """Post a progress event to the review site; a stopped server is not an error."""
    try:
        req = urllib.request.Request(f"http://127.0.0.1:{PORT}/api/event", json.dumps(ev).encode(), {"Content-Type": "application/json"})
        urllib.request.urlopen(req, timeout=5).read()
    except OSError as e:
        print("event not posted:", e)
