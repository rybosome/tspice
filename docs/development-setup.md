# Development setup

This repository uses a pnpm workspace, TypeScript, a Python/SpiceyPy parity sidecar, a native Node addon, and checked-in Emscripten outputs. Most JavaScript contributors do not need to install Emscripten or build CSPICE manually.

## Prerequisites

| Work                                   | Required tools                                                                                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| JS build, typecheck, and parity checks | Node.js 20 or 22; pnpm 10.13.1; `uv`; a CPython 3.11+ interpreter                                                                              |
| Native backend checks                  | JS/parity tools plus a C and C++ compiler, `make`, `tar`, `uncompress`, and a supported CSPICE install                                         |
| Regenerate checked-in WASM outputs     | Node.js, Emscripten (`emcc`), and `tar`/`uncompress` for the first CSPICE source fetch; the build script fetches the pinned source tree itself |

The `doctor` command checks these profiles without installing tools or editing repository files:

```bash
node scripts/doctor.mjs       # works even before pnpm is on PATH
pnpm doctor                   # JS and SpiceyPy parity prerequisites
pnpm doctor:native            # adds compiler, archive, and CSPICE checks
pnpm doctor:wasm              # adds Emscripten; does not require Python/uv
```

The preflight's regression tests use temporary fake tools and need only Node. Run them with `node --test scripts/doctor.test.mjs` or `pnpm run test:doctor`; both JS check entrypoints include them.

## Bootstrap

Install Node.js 20 or 22 and ensure its `bin` directory is on `PATH`. Enable Corepack and activate the repository's exact pnpm version:

```bash
corepack enable
corepack prepare pnpm@10.13.1 --activate
node --version
pnpm --version
```

Workspace scripts call `pnpm` by name, so the Corepack shim (or a standalone pnpm 10.13.1 installation) must also be on `PATH`. For a keg-only Homebrew Node install, add its `bin` directory to `PATH` for the current shell before running Corepack.

Install uv and a compatible Python, then install the frozen JS workspace dependencies:

```bash
uv --version
uv python install 3.11
pnpm install --frozen-lockfile
```

The parity runner starts the Python sidecar with `uv run` from `packages/py-parity-checking/sidecars/spiceypy`. Its `pyproject.toml` and `uv.lock` define SpiceyPy and the supported Python range. The package's `pretest` command prepares the locked environment and imports SpiceyPy before Vitest starts, so dependency setup does not consume the first parity case's timeout. To prepare it separately, run `pnpm -C packages/py-parity-checking setup:sidecar`. The first run may download the Python interpreter/packages and NAIF kernel fixtures, so network access is needed until those are cached.

## Validation tiers

Formatting and linting use Git's tracked-file inventory, print the number of files evaluated, and fail if the selected scope is empty. Run `pnpm format:check` to check hand-maintained JavaScript/TypeScript, JSON/JSONC, YAML, Markdown, CSS, HTML, and Vue files; `pnpm format` applies the formatter. `pnpm lint` checks tracked JavaScript/TypeScript with ESLint correctness rules and the existing public-API JSDoc requirements. Both reject warnings as well as errors. `pnpm lint:jsdoc` remains available for a JSDoc-only pass.

Generated Emscripten glue, build/cache output, the pnpm lockfile, generated API/inventory/schema documents, and the generated kernel ID type belong to their generators and are excluded. Native C/C++ and Python sources are outside these formatter/ESLint scopes and continue to be validated by their compilation and parity lanes. The authoritative file policy is `scripts/quality-files.mjs`; add new source files to Git before checking them. `pnpm run test:quality-gates` exercises actual formatting/lint defects, empty scopes, and generated-file preservation.

Run the JS required lane for routine TypeScript, docs, WASM, and parity changes:

```bash
pnpm doctor
pnpm run check:js:required
```

This lane uses the checked-in WASM binaries and does not need Emscripten or the native addon. It runs the SpiceyPy oracle and WASM-backed cases. CI also runs this lane on Linux and macOS with Node 20 and 22.

For native adapter or cross-backend changes, install the platform's compiler tools and run:

```bash
pnpm doctor:native
pnpm run fetch:cspice
TSPICE_EXPECT_NATIVE=true pnpm run check:native:required
```

The fetch script reads `scripts/cspice.manifest.json`, verifies the archive checksum, and caches CSPICE below `.cache/cspice/`. Set `TSPICE_CSPICE_DIR` to an existing CSPICE install containing `include/SpiceUsr.h`, `lib/cspice.a`, and `lib/csupport.a` to use a local copy. An invalid explicit override fails the check. Automatic archive downloads are configured for macOS arm64/x64 and Linux x64; other platforms need a compatible CSPICE directory. On macOS, `uncompress` is supplied by `ncompress` if it is absent (`brew install ncompress`).

Native CI sets `TSPICE_EXPECT_NATIVE=true`. Turbo forwards this flag to test tasks and includes its value in their cache keys, so a successful optional-native run cannot satisfy a required-native run. The parity suite's native-presence sanity assertion fails when the production addon or backend entrypoint is missing. Local runs without the flag may still skip native cases.

`pnpm run test:native-ci-guard` exercises the actual Turbo configuration and parity sanity assertion in a temporary workspace: optional native absence skips, required absence fails, a test addon alone fails, and production artifact presence runs the assertion. Both JS check entrypoints include this regression. The fixture checks discovery; the full native lane builds, loads, and compares the actual backend against SpiceyPy.

Use the WASM regeneration tier only when changing the C sources compiled into the checked-in WebAssembly binary or glue:

```bash
pnpm doctor:wasm
node scripts/build-backend-wasm.mjs
```

The script fetches the pinned CSPICE source into the ignored `.cache/` tree, stages a patched build copy, runs Emscripten, and writes the generated assets under `packages/backend-wasm/emscripten/`. Review and commit those generated assets with the source change. Normal JS checks consume the checked-in artifacts and do not rebuild them.

## Task and artifact ownership

Turbo owns preparation inside the workspace graph: builds depend on dependency builds, and tests and typechecks depend on their package build. Package lifecycle hooks use `scripts/prepare-package.mjs`; inside a Turbo task they recognize Turbo's supplied `TURBO_HASH` and do not start a second build. Direct package test/typecheck commands still prepare the same filtered build graph. Direct contract builds prepare dependency builds. Parity's sidecar setup still runs before Vitest starts.

Only build tasks write `dist`. Typechecks use `--noEmit` and separate incremental metadata under each package's ignored `.cache` directory. Both the preparation helper and shared compiler configuration are global task inputs. Concurrent independent top-level commands in the same checkout still require separate worktrees if one can rebuild artifacts the other consumes.

The missing-export CI investigation observed two empty reads across 127,845 reads of real Node, contract, and core exports during eight warm Turbo cache restores. The old parity hook could trigger those restores while sibling tests imported those files. `pnpm test:orchestration` holds a duplicate writer at truncation with explicit barriers: its negative control reproduces `createNodeBackend is not a function`, and the real package hooks protect imports with cold/restored build caches. It also checks direct package preparation and graph typecheck prerequisites. This regression does not depend on winning a timing race.

## Host toolchain notes

If `node-gyp` compiles the C/C++ sources but linking fails with an unknown architecture in macOS SDK `.tbd` files, check that the selected Command Line Tools linker understands the selected SDK. This is an SDK/toolchain pairing issue; do not edit project sources to work around it. The local readiness audit records the SDK versions used to validate this checkout.

For contributor changes, run the narrowest relevant package check first, then the required lane above. GitHub Actions remains the merge authority for its full platform matrix and packed-install smoke tests.
