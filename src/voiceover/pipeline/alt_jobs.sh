#!/usr/bin/env bash
# Several alternative takes for one line, generated one after another as a single line job (like line_job.sh).
# usage: alt_jobs.sh <batch> <sid> <feedback_id> <name>[@<ref>] "<text>" [<name>[@<ref>] "<text>" ...]
# Each pair becomes higgs/<batch>/<NN>_<sid>/alt-<name>.wav; @<ref> voices it with another key from the script's refs.
set -u
batch=$1 sid=$2 fid=$3; shift 3
source "$(dirname "$0")/env.sh"
mkdir -p review/jobs
pidf=review/jobs/$sid.pid
if [[ -f $pidf ]] && old=$(cat "$pidf") && kill -0 -- "-$old" 2>/dev/null; then
  kill -- "-$old" 2>/dev/null && echo "cancelled running job for $sid (pgid $old)"
fi
# post queued now: the line shows as pending and agents' open-feedback lists skip it
curl -s -XPOST "127.0.0.1:${REVIEW_PORT:-8765}/api/event" -H 'Content-Type: application/json' --data-binary @- >/dev/null <<JSON || true
{"feedback_id": "$fid", "group": "batch:$batch", "sid": "$sid", "status": "queued", "message": "Queued: $(( $# / 2 )) alternatives"}
JSON
setsid bash -c '
batch=$1 sid=$2 fid=$4; shift 4
while (($# >= 2)); do
  name=${1%%@*} ref=; [[ $1 == *@* ]] && ref=${1#*@}
  flock review/jobs/gpu.lock "$HIGGS_PY" -I "$PIPE/redo_line.py" "$batch" "$sid" "$2" "$fid" --alt "$name" ${ref:+--ref "$ref"}
  shift 2
done
rm -f "review/jobs/$sid.pid"' _ "$batch" "$sid" "${2:-}" "$fid" "$@" > "review/jobs/$sid.log" 2>&1 < /dev/null &
echo $! > "$pidf"
echo "started $(( $# / 2 )) alternatives for $sid (pgid $!)"
