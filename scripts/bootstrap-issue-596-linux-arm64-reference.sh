#!/usr/bin/env bash
set -euo pipefail

phase() {
  printf '\n========== %s =========='"\n" "$1"
}

ensure_user_var() {
  if [ -z "${USER:-}" ]; then
    export USER
    USER="$(id -un)"
  fi
}

load_nix_env() {
  ensure_user_var

  local profileScript
  for profileScript in \
    "$HOME/.nix-profile/etc/profile.d/nix.sh" \
    "/nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh" \
    "/etc/profile.d/nix.sh"
  do
    if [ -f "$profileScript" ]; then
      # shellcheck disable=SC1090
      . "$profileScript"
      break
    fi
  done

  export PATH="$HOME/.nix-profile/bin:$PATH"

  if ! command -v nix >/dev/null 2>&1; then
    echo "ERROR: nix command is unavailable after environment setup." >&2
    exit 1
  fi
}

configure_nix() {
  mkdir -p "$HOME/.config/nix"
  local nixConf="$HOME/.config/nix/nix.conf"
  if [ ! -f "$nixConf" ]; then
    printf 'experimental-features = nix-command flakes\n' > "$nixConf"
    return
  fi

  if ! grep -Eq '^[[:space:]]*experimental-features[[:space:]]*=.*(nix-command.*flakes|flakes.*nix-command)' "$nixConf"; then
    printf '\nexperimental-features = nix-command flakes\n' >> "$nixConf"
  fi
}

main() {
  local repoRoot
  repoRoot="$(git rev-parse --show-toplevel)"
  cd "$repoRoot"

  local prNumber="467"
  local prHeadSha="50a3d804f11857608e6954acf68728c84091ffce"
  local prRef="refs/remotes/origin/pr/${prNumber}-head"
  local prWorktree
  local parityScript
  local cspiceOut

  prWorktree="$(mktemp -d "${TMPDIR:-/tmp}/tspice-pr${prNumber}-XXXXXX")"
  parityScript="$(mktemp "${TMPDIR:-/tmp}/parity-tkvrsn-XXXXXX.ts")"

  cleanup() {
    if [ -n "${parityScript:-}" ]; then
      rm -f "$parityScript"
    fi
    if [ -n "${prWorktree:-}" ]; then
      git worktree remove --force "$prWorktree" >/dev/null 2>&1 || true
      rm -rf "$prWorktree"
    fi
  }
  trap cleanup EXIT

  phase "Phase 1: Install and configure Nix"
  if command -v nix >/dev/null 2>&1 || [ -x "$HOME/.nix-profile/bin/nix" ]; then
    echo "Nix already installed."
  else
    local nixInstaller
    nixInstaller="$(mktemp "${TMPDIR:-/tmp}/nix-installer-XXXXXX.sh")"
    curl --proto '=https' --tlsv1.2 -fsSL https://nixos.org/nix/install -o "$nixInstaller"
    NIX_INSTALLER_NO_MODIFY_PROFILE=1 sh "$nixInstaller" --no-daemon --yes
    rm -f "$nixInstaller"
  fi
  load_nix_env
  configure_nix
  nix --version

  phase "Phase 2: Verify Nix by launching a base flake"
  nix shell github:NixOS/nixpkgs/nixos-25.05#hello --command hello

  phase "Phase 3: Fetch PR #467 deterministically and build hermetic CSPICE"
  git fetch --no-tags origin "refs/pull/${prNumber}/head:${prRef}"
  local actualPrSha
  actualPrSha="$(git rev-parse "$prRef")"
  if [ "$actualPrSha" != "$prHeadSha" ]; then
    echo "ERROR: PR #${prNumber} head SHA mismatch. Expected ${prHeadSha}, got ${actualPrSha}." >&2
    exit 1
  fi

  git worktree add --detach "$prWorktree" "$prHeadSha" >/dev/null
  (
    cd "$prWorktree"
    nix build .#cspice-linux-arm64 --print-build-logs
  )

  cspiceOut="$(readlink -f "$prWorktree/result")"
  test -f "$cspiceOut/include/SpiceUsr.h"
  test -f "$cspiceOut/lib/cspice.a"
  test -f "$cspiceOut/lib/csupport.a"

  echo "Hermetic CSPICE output: $cspiceOut"
  TSPICE_CSPICE_DIR="$cspiceOut" node scripts/print-cspice-dir.mjs

  phase "Phase 4: Install JS dependencies and build required workspace packages"
  pnpm install --frozen-lockfile
  pnpm -w turbo run build --filter=@rybosome/tspice

  phase "Phase 5: Build backend-node against hermetic CSPICE"
  TSPICE_CSPICE_DIR="$cspiceOut" pnpm -C packages/backend-node run build:native

  phase "Phase 6: Self-test parity runner forwarding via toolkit version call"
  cat > "$parityScript" <<'TS'
(async () => {
  const repoRoot = process.env.TSPICE_REPO_ROOT;
  if (!repoRoot) {
    throw new Error("TSPICE_REPO_ROOT is required");
  }

  const { createCspiceRunner } = await import(
    `${repoRoot}/packages/parity-checking/src/index.ts`
  );

  const runner = await createCspiceRunner();
  try {
    const result = await runner.runCase({
      schemaVersion: 3,
      manifest: { id: "methods/time/tkvrsn@v3", kind: "method" },
      contract: {
        contractMethod: "time.tkvrsn",
        canonicalMethod: "time.tkvrsn"
      },
      args: ["TOOLKIT"],
      workflow: { steps: [{ op: "callContract" }] }
    });

    if (!result.ok) {
      throw new Error(JSON.stringify(result.error));
    }

    console.log(String(result.result));
  } finally {
    await runner.dispose?.();
  }
})();
TS

  local toolkitVersionRaw
  toolkitVersionRaw="$({
    TSPICE_CSPICE_DIR="$cspiceOut" \
      TSPICE_REPO_ROOT="$repoRoot" \
      pnpm -C packages/parity-checking exec tsx "$parityScript"
  })"
  local toolkitVersion
  toolkitVersion="$(printf '%s\n' "$toolkitVersionRaw" | tail -n1)"

  if [[ "$toolkitVersion" != CSPICE_* ]]; then
    echo "ERROR: unexpected toolkit version output: $toolkitVersionRaw" >&2
    exit 1
  fi

  echo "Parity forwarding toolkit version: $toolkitVersion"

  phase "Done"
}

main "$@"
