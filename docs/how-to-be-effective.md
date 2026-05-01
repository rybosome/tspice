# How to be effective in this repo

This doc is a quick “mental map” for contributors. It’s intentionally short and links out to canonical READMEs/docs.

## Main entry points (what to touch first)

- **Public API (published package):** `packages/tspice` (`@rybosome/tspice`)
  - Start here for user-facing API changes: `spiceClients`, backend selection, exported surface.
  - Docs: [`../packages/tspice/README.md`](../packages/tspice/README.md)

- **Backend boundaries:**
  - **WASM backend:** `packages/backend-wasm` (`@rybosome/tspice-backend-wasm`)
    - Builds from checked-in Emscripten artifacts under `packages/backend-wasm/emscripten/`.
    - Docs: [`../packages/backend-wasm/README.md`](../packages/backend-wasm/README.md)
  - **Native Node backend:** `packages/backend-node` (`@rybosome/tspice-backend-node`)
    - Owns the Node native addon under `packages/backend-node/native/`.
    - Docs: [`../packages/backend-node/README.md`](../packages/backend-node/README.md)

- **Backend contract (shared types):** `packages/backend-contract` (`@rybosome/tspice-backend-contract`)
  - If you’re changing backend APIs, this is usually the first place to update.
  - Docs: [`../packages/backend-contract/README.md`](../packages/backend-contract/README.md)

- **Example app / integration:** standalone Orrery repo (`https://github.com/rybosome/orrery`)

## Fastest path to run checks/build/test

From the repo root:

```bash
pnpm install

# “JS-only” verification (no native addon build)
pnpm run check:js

# Full verification (includes native addon build)
pnpm run check:native
```

Common single-purpose commands:

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

When iterating on a specific workspace, prefer pnpm filters:

```bash
pnpm --filter @rybosome/tspice run test
pnpm --filter @rybosome/tspice-backend-wasm run build
pnpm --filter @rybosome/tspice-backend-node run build:native
```

## Native + WASM build/release workflow pointers

### WASM backend artifacts

- Regenerate the Emscripten outputs (requires `emcc`):

```bash
node scripts/build-backend-wasm.mjs
```

- Then rebuild/copy into `dist/`:

```bash
pnpm --filter @rybosome/tspice-backend-wasm run build
```

### Native backend + platform staging

The native addon is built in `packages/backend-node/native/`.

```bash
pnpm run fetch:cspice
pnpm -C packages/backend-node run build:native
pnpm run stage:native-platform
```

Notes:

- `pnpm run check:native` runs the full native pipeline (build + stage + build/test).
- Native builds require Python 3 and a working `node-gyp` toolchain.

### linux-arm64 CSPICE source build (`nix develop`, Phase 1)

For `linux-arm64` (`aarch64`), use the repo `flake.nix` dev shell to run the known-good CSPICE source build flow from issue #465.

The flake intentionally exposes this build shell only as `devShells.aarch64-linux.default`.

```bash
# Enter the aarch64 dev shell (includes tcsh/csh, gcc, make, binutils, node)
nix develop .#devShells.aarch64-linux.default

# Fetch CSPICE source and resolve the source-tree location
node scripts/fetch-cspice.mjs --source
TOOLKIT=$(node -p "require('./scripts/cspice.manifest.json').toolkitVersion")
export CSPICE_DIR="$PWD/.cache/cspice/$TOOLKIT/source/cspice"

# Build CSPICE static libraries from source
rm -f "$CSPICE_DIR/lib/cspice.a" "$CSPICE_DIR/lib/csupport.a"
find "$CSPICE_DIR/src/cspice" "$CSPICE_DIR/src/csupport" -maxdepth 1 -type f \( -name '*.o' -o -name '*.a' \) -delete
( cd "$CSPICE_DIR/src/cspice" && tcsh ./mkprodct.csh )
( cd "$CSPICE_DIR/src/csupport" && tcsh ./mkprodct.csh )

# Verify required artifacts and wire into tspice scripts
ls -l "$CSPICE_DIR/lib/cspice.a" "$CSPICE_DIR/lib/csupport.a"
ls -l "$CSPICE_DIR/include/SpiceUsr.h" "$CSPICE_DIR/include/SpiceZfc.h" "$CSPICE_DIR/include/SpiceZmc.h"
TSPICE_CSPICE_DIR="$CSPICE_DIR" node scripts/print-cspice-dir.mjs
```

If you're on a non-`aarch64` host, pass `--system aarch64-linux` and use emulation or a remote `aarch64-linux` builder.

The shell exports these required NAIF build overrides:

- `TKCOMPILER=gcc`
- `TKCOMPILEOPTIONS='-c -ansi -O2 -fPIC -DNON_UNIX_STDIO'`
- `TKLINKOPTIONS='-lm'`

### linux-arm64 CSPICE hermetic package (`mkDerivation`, Phase 2)

Phase 2 converts the validated shell flow into a hermetic derivation at `packages.aarch64-linux.cspice-linux-arm64` (also exposed as `.#cspice-linux-arm64`).

The derivation fetches pinned CSPICE source from `scripts/cspice.manifest.json`, builds static libs with the same NAIF env vars as Phase 1, and installs outputs into `$out/include` + `$out/lib`.

```bash
# Build hermetic CSPICE output (creates ./result symlink)
nix build .#cspice-linux-arm64

# Verify required artifacts
OUT="$(readlink -f ./result)"
ls -l "$OUT/lib/cspice.a" "$OUT/lib/csupport.a"
ls -l "$OUT/include/SpiceUsr.h" "$OUT/include/SpiceZfc.h" "$OUT/include/SpiceZmc.h"

# Verify archive members are aarch64 objects
TMPDIR="$(mktemp -d)"
CSPICE_OBJ="$(ar t "$OUT/lib/cspice.a" | sed -n '1p')"
CSUPPORT_OBJ="$(ar t "$OUT/lib/csupport.a" | sed -n '1p')"
ar p "$OUT/lib/cspice.a" "$CSPICE_OBJ" > "$TMPDIR/cspice.o"
ar p "$OUT/lib/csupport.a" "$CSUPPORT_OBJ" > "$TMPDIR/csupport.o"
file "$TMPDIR/cspice.o" "$TMPDIR/csupport.o"
rm -rf "$TMPDIR"
```

For a quick reproducibility check, compare repeated no-link builds:

```bash
OUT1="$(nix build --no-link --print-out-paths .#cspice-linux-arm64)"
OUT2="$(nix build --no-link --print-out-paths .#cspice-linux-arm64)"
test "$OUT1" = "$OUT2" && echo "repeatable output path: $OUT1"
```

### Publishing `@rybosome/tspice`

The publishable entry point is `@rybosome/tspice`.

- `pnpm run build` produces `packages/tspice/dist-publish/`.
- The release script lives in `packages/tspice`:

```bash
pnpm --filter @rybosome/tspice run release
```

(That script runs `verify:dist-publish` and uses `np` to publish from `dist-publish/`.)

## Compliance / redistribution checklist

Before publishing artifacts or changing anything related to CSPICE-derived components:

- Read the canonical docs:
  - Disclosure text + NAIF links: [`cspice-naif-disclosure.md`](./cspice-naif-disclosure.md)
  - Project policy: [`cspice-policy.md`](./cspice-policy.md)

- Make sure notices are correct:
  - Repo-wide: [`../THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md)
  - Backend notices:
    - [`../packages/backend-node/NOTICE`](../packages/backend-node/NOTICE)
    - [`../packages/backend-wasm/NOTICE`](../packages/backend-wasm/NOTICE)

- Run the repo guards:

```bash
pnpm run check:compliance
pnpm run check:versions
```
