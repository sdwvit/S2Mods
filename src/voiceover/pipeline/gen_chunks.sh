#!/usr/bin/env bash
# Generate a script in chunks of N lines, taking the GPU lock per chunk so redo jobs can run in between.
# usage: gen_chunks.sh <spk_lang> <takes> [chunk=8]     e.g. gen_chunks.sh <speaker>_en 3
# Line folders land in higgs/<spk_lang>/; lines that already have a folder are skipped.
set -eu
source "$(dirname "$0")/env.sh"
b=$1; takes=$2; chunk=${3:-8}
tmp=$(mktemp -d)
mkdir -p "higgs/$b" review/jobs
python3 -I - "$b" "$chunk" "$tmp" <<'PY'
import json, os, sys
b, chunk, tmp = sys.argv[1], int(sys.argv[2]), sys.argv[3]
sc = json.load(open(f'higgs/{b}.json', encoding='utf-8'))
todo = [l for l in sc['lines'] if not os.path.isdir(f"higgs/{b}/{l['n']:02d}_{l['sid']}")]
for i in range(0, len(todo), chunk):
    json.dump({'refs': sc['refs'], 'lines': todo[i:i + chunk]}, open(f'{tmp}/chunk{i // chunk:03d}.json', 'w', encoding='utf-8'), ensure_ascii=False)
print(len(todo), 'lines to generate')
PY
for c in "$tmp"/chunk*.json; do
  [ -e "$c" ] || continue
  out="${c%.json}_out"
  flock review/jobs/gpu.lock "$HIGGS_PY" -I "$PIPE/higgs_lines.py" "$c" "$out" "$takes" 8 >> "higgs/$b.gen.log" 2>&1 || true
  for d in "$out"/*_*/; do [ -d "$d" ] || continue; n=$(basename "$d"); [ -d "higgs/$b/$n" ] || mv "$d" "higgs/$b/$n"; done
  echo "$(date +%T) $(basename "$c") done: $(ls -d higgs/$b/*_*/ 2>/dev/null | wc -l) lines in higgs/$b"
done
