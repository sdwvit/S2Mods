#!/usr/bin/env bash
# Mirror the approved takes (higgs/final/<spk>_<lang>/) into the mod folder, plus a manifest with each line's text.
# Run from anywhere; the review server calls it after every pick/unpick. Target: VOICEOVER_APPROVED_DIR (environment or
# .env), for example a voice/approved folder in the mod; nothing happens when it is unset.
set -eu
source "$(dirname "$0")/env.sh"
DST=$(envget VOICEOVER_APPROVED_DIR)
[ -n "$DST" ] || { echo "VOICEOVER_APPROVED_DIR not set, nothing to back up"; exit 0; }
mkdir -p "$DST"
rsync -a --delete --include='*/' --include='*.wav' --exclude='*' higgs/final/ "$DST/"
python3 -I - "$DST" <<'PY'
import glob, json, os, re, shutil, sys
dst = sys.argv[1]; out = {}
for js in glob.glob('higgs/*.json'):
    batch = os.path.basename(js)[:-5]
    lines = json.load(open(js, encoding='utf-8'))['lines']
    by_sid = {l['sid']: l for l in lines}
    for l in lines:
        f = f"{batch}/{l['n']:02d}_{l['sid']}.wav"
        if l.get('same_as'):  # same words as another line: reuse its approved take under this sid
            src = by_sid[l['same_as']]
            s = os.path.join(dst, f"{batch}/{src['n']:02d}_{src['sid']}.wav")
            if os.path.exists(s):
                shutil.copyfile(s, os.path.join(dst, f))
        if os.path.exists(os.path.join(dst, f)):
            out[f] = {'sid': l['sid'], 'speaker': l['speaker'], 'text': re.sub(r'<\|[^|]*\|>', '', l['text']).replace('́', '').strip(),
                      'tagged_text': l['text']}
json.dump(out, open(os.path.join(dst, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1, sort_keys=True)
print(len(out), 'approved lines backed up to', dst)
PY
