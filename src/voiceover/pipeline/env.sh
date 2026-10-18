# Sourced by the pipeline's shell scripts. Sets VOICEOVER_ROOT (environment, else the repo's .env), PIPE (this folder)
# and HIGGS_PY (Python of the Higgs venv, VOICEOVER_HIGGS_PYTHON or <root>/.venv-higgs/bin/python), then cds to the root.
PIPE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO=$(cd "$PIPE/../../.." && pwd)
envget() { # envget NAME: environment value, else the last NAME= line of the repo's .env
  local v=${!1:-}
  [[ -z $v && -f $REPO/.env ]] && v=$(sed -n "s/^$1=//p" "$REPO/.env" | tail -1)
  printf '%s' "$v"
}
VOICEOVER_ROOT=$(envget VOICEOVER_ROOT)
: "${VOICEOVER_ROOT:?set VOICEOVER_ROOT (environment or .env) to the voice workspace}"
HIGGS_PY=$(envget VOICEOVER_HIGGS_PYTHON)
HIGGS_PY=${HIGGS_PY:-$VOICEOVER_ROOT/.venv-higgs/bin/python}
export VOICEOVER_ROOT PIPE HIGGS_PY
cd "$VOICEOVER_ROOT" || exit 1
