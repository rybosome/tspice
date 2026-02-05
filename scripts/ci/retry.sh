# Shared retry helper for CI shell scripts.
#
# Usage:
#   source ./scripts/ci/retry.sh
#   retry [tries] some-command --with args

retry() {
  if [ "$#" -eq 0 ]; then
    echo "[retry] usage: retry [tries] <command...>" >&2
    return 2
  fi

  local tries=3

  # Optional leading `tries` argument.
  if [[ "$1" =~ ^[0-9]+$ ]]; then
    tries=$1
    shift
    if [ "$tries" -le 0 ]; then
      echo "[retry] tries must be a positive integer; got: $tries" >&2
      return 2
    fi
  elif [[ "$1" =~ ^-?[0-9]+$ ]]; then
    # Looks numeric but isn't a valid positive integer.
    echo "[retry] tries must be a positive integer; got: $1" >&2
    return 2
  fi

  if [ "$#" -eq 0 ]; then
    echo "[retry] usage: retry [tries] <command...>" >&2
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
