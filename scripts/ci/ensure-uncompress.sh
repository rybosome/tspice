#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=./retry.sh
source "$SCRIPT_DIR/retry.sh"

log() {
  echo "[ensure-uncompress] $*" >&2
}

ensure_linux() {
  if command -v uncompress >/dev/null 2>&1; then
    log "uncompress already present"
    return 0
  fi

  # Assumes ubuntu-latest; update if the Linux distribution changes.
  if ! command -v apt-get >/dev/null 2>&1; then
    echo "This step assumes an Ubuntu/Debian-based Linux runner with apt-get available. Update the workflow before using a different Linux image." >&2
    exit 1
  fi

  retry 3 sudo apt-get update

  if ! sudo apt-get install -y --no-install-recommends ncompress; then
    echo "Failed to install 'ncompress'. Verify that it is available on ubuntu-latest or adjust the workflow to use an alternative package/source." >&2
    exit 1
  fi

  if ! command -v uncompress >/dev/null 2>&1; then
    echo "'uncompress' still not found after installing ncompress." >&2
    exit 1
  fi

  log "installed ncompress (uncompress now present)"
}

ensure_macos() {
  if command -v uncompress >/dev/null 2>&1; then
    log "uncompress already present"
    return 0
  fi

  if ! command -v brew >/dev/null 2>&1; then
    echo "uncompress not found and Homebrew (brew) is missing; cannot install ncompress on the macOS CI runner." >&2
    exit 1
  fi

  log "installing ncompress via Homebrew"
  if retry 3 brew install ncompress; then
    :
  else
    local install_status=$?
    log "brew install ncompress failed (exit $install_status)"

    # `brew update` can be flaky; do best-effort updates with retries but don't
    # hard fail on an update failure.
    if ! retry 3 brew update; then
      log "brew update failed; continuing anyway (best-effort)"
    fi

    log "re-attempting brew install ncompress"
    if ! retry 3 brew install ncompress; then
      echo "Failed to install ncompress via Homebrew, even after a best-effort brew update + retries." >&2
      exit 1
    fi
  fi

  if ! command -v uncompress >/dev/null 2>&1; then
    echo "Installed ncompress but uncompress is still missing from PATH." >&2
    exit 1
  fi

  log "installed ncompress (uncompress now present)"
}

case "${RUNNER_OS:-}" in
  Linux)
    ensure_linux
    ;;
  macOS)
    ensure_macos
    ;;
  *)
    echo "Unsupported RUNNER_OS: ${RUNNER_OS:-<unset>}" >&2
    exit 1
    ;;
esac
