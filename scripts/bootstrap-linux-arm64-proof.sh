#!/usr/bin/env bash
set -euo pipefail

phase() {
  printf '\n========== %s =========='"\n" "$1"
}

PARITY_SCRIPT=""
NIX_BUILD_DIR=""

PINNED_CSPICE_SOURCE_SHA="50a3d804f11857608e6954acf68728c84091ffce"
PINNED_CSPICE_FLAKE_REF="github:rybosome/tspice/${PINNED_CSPICE_SOURCE_SHA}#cspice-linux-arm64"

parse_opt_in_flag() {
  local envName="$1"
  local raw="${2:-0}"
  case "$raw" in
    0|"")
      printf '0'
      ;;
    1)
      printf '1'
      ;;
    *)
      echo "ERROR: ${envName} must be 0 or 1 (received: ${raw})." >&2
      exit 1
      ;;
  esac
}

print_bootstrap_help() {
  cat >&2 <<'HELP'
Bootstrap options:
  - TSPICE_BOOTSTRAP_INSTALL_NIX=1
      Allow network install of Nix when `nix` is missing.
      Default is 0 (off): script fails with instructions instead of auto-installing.

  - TSPICE_BOOTSTRAP_CONFIGURE_NIX=1
      Allow writing `experimental-features = nix-command flakes` to ~/.config/nix/nix.conf.
      Default is 0 (off): no global Nix config mutation.
HELP
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

nix_flakes() {
  nix --extra-experimental-features 'nix-command flakes' "$@"
}

validate_cspice_dir() {
  local dir="$1"
  [ -f "$dir/include/SpiceUsr.h" ] && [ -f "$dir/lib/cspice.a" ] && [ -f "$dir/lib/csupport.a" ]
}

main() {
  local repoRoot
  repoRoot="$(git rev-parse --show-toplevel)"
  cd "$repoRoot"

  local platformArch
  platformArch="$(node -e 'process.stdout.write(`${process.platform}-${process.arch}`)')"
  if [ "$platformArch" != "linux-arm64" ]; then
    echo "ERROR: this bootstrap flow is only supported on linux-arm64 (current: $platformArch)." >&2
    exit 1
  fi

  local toolkitVersion
  toolkitVersion="$({
    node -e 'const fs=require("node:fs"); const p="scripts/cspice.manifest.json"; const m=JSON.parse(fs.readFileSync(p,"utf8")); if(typeof m.toolkitVersion!=="string"){throw new Error(`Missing toolkitVersion in ${p}`);} process.stdout.write(m.toolkitVersion);'
  })"

  local cacheDir
  cacheDir="$repoRoot/.cache/cspice/$toolkitVersion/linux-arm64"
  local cacheLink
  cacheLink="$cacheDir/cspice"

  local bootstrapInstallNix
  bootstrapInstallNix="$(parse_opt_in_flag "TSPICE_BOOTSTRAP_INSTALL_NIX" "${TSPICE_BOOTSTRAP_INSTALL_NIX:-0}")"
  local bootstrapConfigureNix
  bootstrapConfigureNix="$(parse_opt_in_flag "TSPICE_BOOTSTRAP_CONFIGURE_NIX" "${TSPICE_BOOTSTRAP_CONFIGURE_NIX:-0}")"

  PARITY_SCRIPT="$(mktemp "${TMPDIR:-/tmp}/parity-tkvrsn-XXXXXX.ts")"

  cleanup() {
    if [ -n "${PARITY_SCRIPT:-}" ]; then
      rm -f "$PARITY_SCRIPT"
    fi
    if [ -n "${NIX_BUILD_DIR:-}" ]; then
      rm -rf "$NIX_BUILD_DIR"
    fi
  }
  trap cleanup EXIT

  phase "Phase 1: Ensure Nix is available"
  if command -v nix >/dev/null 2>&1 || [ -x "$HOME/.nix-profile/bin/nix" ]; then
    echo "Nix already installed."
  else
    if [ "$bootstrapInstallNix" != "1" ]; then
      echo "ERROR: nix is required, but no nix installation was found." >&2
      echo "Install Nix first: https://nixos.org/download/" >&2
      echo "Or opt in to automatic install for this command:" >&2
      echo "  TSPICE_BOOTSTRAP_INSTALL_NIX=1 pnpm run bootstrap:linux-arm64-proof" >&2
      print_bootstrap_help
      exit 1
    fi

    local nixInstaller
    nixInstaller="$(mktemp "${TMPDIR:-/tmp}/nix-installer-XXXXXX.sh")"
    curl --proto '=https' --tlsv1.2 -fsSL https://nixos.org/nix/install -o "$nixInstaller"
    NIX_INSTALLER_NO_MODIFY_PROFILE=1 sh "$nixInstaller" --no-daemon --yes
    rm -f "$nixInstaller"
  fi
  load_nix_env

  if [ "$bootstrapConfigureNix" = "1" ]; then
    configure_nix
  else
    echo "Skipping ~/.config/nix/nix.conf mutation (set TSPICE_BOOTSTRAP_CONFIGURE_NIX=1 to opt in)."
  fi

  nix --version

  phase "Phase 2: Verify Nix by launching a base flake"
  nix_flakes shell github:NixOS/nixpkgs/nixos-25.05#hello --command hello

  phase "Phase 3: Build hermetic CSPICE and stage repo cache"
  if validate_cspice_dir "$cacheLink"; then
    echo "Reusing cached CSPICE layout: $cacheLink"
  else
    echo "Building pinned hermetic CSPICE source: $PINNED_CSPICE_FLAKE_REF"
    NIX_BUILD_DIR="$(mktemp -d "${TMPDIR:-/tmp}/tspice-cspice-build-XXXXXX")"
    (
      cd "$NIX_BUILD_DIR"
      nix_flakes build "$PINNED_CSPICE_FLAKE_REF" --print-build-logs
    )

    local cspiceOut
    cspiceOut="$(readlink -f "$NIX_BUILD_DIR/result")"
    if ! validate_cspice_dir "$cspiceOut"; then
      echo "ERROR: Hermetic CSPICE build output is missing required layout: $cspiceOut" >&2
      exit 1
    fi

    mkdir -p "$cacheDir"
    rm -rf "$cacheLink"
    ln -s "$cspiceOut" "$cacheLink"
    echo "Hermetic CSPICE output: $cspiceOut"
    echo "Linked repo cache: $cacheLink"
  fi

  if ! validate_cspice_dir "$cacheLink"; then
    echo "ERROR: Cache link does not contain required CSPICE layout: $cacheLink" >&2
    exit 1
  fi

  node scripts/print-cspice-dir.mjs

  phase "Phase 4: Install JS dependencies"
  pnpm install --frozen-lockfile

  phase "Phase 5: Build backend-node against staged CSPICE"
  pnpm -C packages/backend-node run build:native

  phase "Phase 6: Build strict proof-mode parity runner"
  PARITY_PROOF_NATIVE_V2=1 pnpm -C packages/parity-checking run pretest

  phase "Phase 7: Self-test parity runner forwarding via toolkit version call"
  cat > "$PARITY_SCRIPT" <<'TS'
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
      workflow: { steps: [{ op: "call", call: "self", in: ["$args.0"] }] }
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
    TSPICE_REPO_ROOT="$repoRoot" \
      pnpm -C packages/parity-checking exec tsx "$PARITY_SCRIPT"
  })"
  local toolkitVersionResolved
  toolkitVersionResolved="$(printf '%s\n' "$toolkitVersionRaw" | tail -n1)"

  if [[ "$toolkitVersionResolved" != CSPICE_* ]]; then
    echo "ERROR: unexpected toolkit version output: $toolkitVersionRaw" >&2
    exit 1
  fi

  echo "Parity forwarding toolkit version: $toolkitVersionResolved"

  phase "Done"
}

main "$@"
