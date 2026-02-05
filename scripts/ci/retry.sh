# Shared retry helper for CI shell scripts.
#
# Usage:
#   source ./scripts/ci/retry.sh
#   retry 3 some-command --with args

retry() {
  local tries=${1:-3}
  shift || true

  if [ "$#" -eq 0 ]; then
    echo "[retry] usage: retry <tries> <command...>" >&2
    return 2
  fi

  local n=1
  local cmd=("$@")

  while true; do
    printf '[retry] attempt %d/%d: ' "$n" "$tries" >&2
    printf '%q ' "${cmd[@]}" >&2
    printf '\n' >&2

    if "${cmd[@]}"; then
      return 0
    fi

    if [ "$n" -ge "$tries" ]; then
      echo "[retry] exhausted $tries attempts" >&2
      return 1
    fi

    local backoff_s=$((2 * n))
    echo "[retry] sleeping ${backoff_s}s before retry..." >&2
    sleep "$backoff_s"
    n=$((n + 1))
  done
}
