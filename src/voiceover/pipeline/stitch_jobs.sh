#!/usr/bin/env bash
# Like alt_jobs.sh, but each text is voiced sentence by sentence ("part|||part|||...") and the parts are stitched, as one job in the review server's queue
# (key line:<sid>, like line_job.sh: it supersedes the line's queued job and stops its running one).
# usage: stitch_jobs.sh <batch> <sid> <feedback_id> <name>[@<ref>] "<text>" [<name>[@<ref>] "<text>" ...]
# Each pair becomes higgs/<batch>/<NN>_<sid>/alt-<name>.wav; @<ref> voices it with another key from the script's refs.
set -u
batch=$1 sid=$2 fid=$3; shift 3
source "$(dirname "$0")/env.sh"
steps=()
while (($# >= 2)); do
  name=${1%%@*} ref=; [[ $1 == *@* ]] && ref=${1#*@}
  ((${#steps[@]})) && steps+=(--then)
  steps+=("$HIGGS_PY" -I "$PIPE/stitch_line.py" "$batch" "$sid" "$2" "$fid" --alt "$name" ${ref:+--ref "$ref"})
  shift 2
done
((${#steps[@]})) || { echo "no <name> <text> pairs"; exit 1; }
n=$(printf '%s\n' "${steps[@]}" | grep -c -- '^--alt$')
exec python3 -I "$PIPE/enqueue.py" --key "line:$sid" --label "$n alternatives for $sid" --group "batch:$batch" --sid "$sid" \
  --feedback-id "$fid" -- "${steps[@]}"
