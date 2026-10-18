#!/usr/bin/env bash
# One generation job per line: kills the line's running job (if any), then runs redo_line.py in the background.
# Jobs queue on review/jobs/gpu.lock, so only one generation uses the GPU at a time.
# usage: line_job.sh <sid> <redo_line args...>
# Jobs: review/jobs/<sid>.pid (process group id) and review/jobs/<sid>.log
set -u
sid=$1; shift
source "$(dirname "$0")/env.sh"
mkdir -p review/jobs
pidf=review/jobs/$sid.pid
if [[ -f $pidf ]]; then
  old=$(cat "$pidf")
  if kill -0 -- "-$old" 2>/dev/null; then
    kill -- "-$old" 2>/dev/null && echo "cancelled running job for $sid (pgid $old)"
  fi
  rm -f "$pidf"
fi
setsid bash -c 'flock review/jobs/gpu.lock "$HIGGS_PY" -I "$PIPE/redo_line.py" "$@"; rm -f "review/jobs/'"$sid"'.pid"' _ "$@" > "review/jobs/$sid.log" 2>&1 &
echo $! > "$pidf"
echo "started job for $sid (pgid $!)"
