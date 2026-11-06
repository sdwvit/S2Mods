#!/usr/bin/env bash
# One generation job per line, through the review server's queue: a new job for a line supersedes its queued job and
# stops its running one. The queue runs one GPU job at a time (log: review/jobs/<job id>.log).
# usage: line_job.sh <sid> <redo_line args: batch sid text [feedback_id] [--alt NAME [--ref SPK]]>
set -u
sid=$1; shift
source "$(dirname "$0")/env.sh"
batch=$1 fid=${4:-}
[[ $fid == --* ]] && fid=
exec python3 -I "$PIPE/enqueue.py" --key "line:$sid" --label "redo $sid" --group "batch:$batch" --sid "$sid" \
  ${fid:+--feedback-id "$fid"} -- "$HIGGS_PY" -I "$PIPE/redo_line.py" "$@"
