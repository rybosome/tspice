# `scripts/`

This directory contains repository tools used by workspace commands and GitHub Actions. Run commands from the repository root unless a command says otherwise. Prefer the root `package.json` entrypoints so local runs match CI.

## Validation and release helpers

| File                                 | Purpose / inputs and outputs                                                                                                                                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check-compliance-files.mjs`         | Checks required compliance and disclosure files and links. Run with `pnpm run check:compliance`.                                                                      |
| `verify-native-package-versions.mjs` | Checks that the public facade and platform-native package versions agree. Run with `pnpm run check:versions`.                                                         |
| `doctor.mjs`                         | Read-only prerequisite check for the JS/parity, native, or WASM regeneration profile. Run with `pnpm doctor`, `pnpm doctor:native`, or `pnpm doctor:wasm`.            |
| `doctor.test.mjs`                    | Exercises preflight success and failure behavior using isolated fake tools; run with `pnpm run test:doctor`. Both JS check entrypoints include it.                    |
| `quality-files.mjs`                  | Selects tracked code, config, and documentation files and excludes generated/binary/build output for the quality gates.                                               |
| `quality-check.mjs`                  | Runs real fail-closed `format:check` / `format --write` and `lint` checks, printing the selected file count.                                                          |
| `quality-check.test.mjs`             | Verifies empty scopes fail, real violations fail, and generated files remain untouched; run with `pnpm run test:quality-gates`. Both JS check entrypoints include it. |
| `lint-jsdoc.mjs`                     | Checks or fixes public API JSDoc (`pnpm run lint:jsdoc` / `pnpm run lint:jsdoc:fix`).                                                                                 |
| `smoke-tspice-native.mjs`            | Verifies a packed `@rybosome/tspice` install can resolve and load its optional native addon; CI runs it in a temporary consumer project.                              |
| `set-release-version.mjs`            | Updates package manifests to a release version supplied on the command line; used by the release workflow.                                                            |
| `read-pnpm-version.cjs`              | Reads the exact pnpm version from the root `packageManager` field for bootstrap tooling.                                                                              |
| `ci/ensure-uncompress.sh`            | Ensures the `uncompress` utility required by the macOS CSPICE archive path is available; uses the shared retry helper.                                                |
| `ci/retry.sh`                        | Shell retry helper sourced by CI setup scripts.                                                                                                                       |

## CSPICE and backend build helpers

| File                           | Purpose / inputs and outputs                                                                                                                                                       |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cspice.manifest.json`         | Pins CSPICE versions, source/archive URLs, and platform-specific acquisition metadata.                                                                                             |
| `fetch-cspice.mjs`             | Reads the manifest and fetches/extracts CSPICE into `.cache/cspice`; run with `pnpm run fetch:cspice`. `--source` downloads the source archive.                                    |
| `print-cspice-dir.mjs`         | Prints the resolved CSPICE directory, including the configured cache/override path.                                                                                                |
| `print-spice-version.mjs`      | Prints toolkit/runtime version information for diagnostics.                                                                                                                        |
| `build-backend-wasm.mjs`       | Uses CSPICE sources and Emscripten to regenerate checked-in glue and WASM under `packages/backend-wasm/emscripten/`; this is only needed when changing the compiled WASM artifact. |
| `backend-wasm-assets.mjs`      | Shares canonical filenames for the web glue, Node glue, and WASM binary between build/copy scripts.                                                                                |
| `copy-backend-wasm-assets.mjs` | Stages the checked-in WASM assets into the backend package build output.                                                                                                           |
| `stage-native-platform.mjs`    | Copies the built Node addon into the matching `packages/tspice-native-*` package before package smoke checks. Run with `pnpm run stage:native-platform`.                           |

## Generated inventories and documentation

| File                                         | Purpose / inputs and outputs                                                                                                                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `generate-cspice-inventory.mjs`              | Reconciles `data/cspice-functions.json` with the backend contract and writes `docs/cspice-function-inventory.md`. `--check` checks drift against NAIF's live index; `--refresh-from-naif` refreshes the JSON input first. |
| `generate-naif-generic-kernel-inventory.mjs` | Crawls the NAIF generic-kernel listing and adds curated descriptions to write `apps/docs/guide/kernel-inventory.md`.                                                                                                      |
| `generate-naif-kernel-id-type.mjs`           | Reads `naif-generic-kernel-leaf-paths.json` and writes the generated `NaifKernelId` union in `packages/tspice/src/kernels/naifKernelId.ts`.                                                                               |
| `naif-generic-kernel-leaf-paths.json`        | Curated input list for the generated kernel ID type.                                                                                                                                                                      |
| `naif-generic-kernel-descriptions.json`      | Curated descriptions used by the generated generic-kernel inventory.                                                                                                                                                      |
| `docs-api.mjs`                               | Builds internal TypeScript declarations, then generates facade and backend-contract API reference pages under `apps/docs/api/reference/`; run with `pnpm docs:api`.                                                       |
| `generate-llm.mjs`                           | Generates root/docs `llms.txt`, `llms-full.txt`, and the public `tspice.schema.json`; run with `pnpm generate:llm`. CI checks that generated artifacts are current.                                                       |

## Common root entrypoints

```bash
pnpm run check:js:required
pnpm run check:native:required
pnpm run fetch:cspice
pnpm run stage:native-platform
pnpm docs:api
pnpm docs:build
pnpm generate:llm
```

`check:js:required` does not require Emscripten; it uses the checked-in WASM artifacts. `check:native:required` also needs a C/C++ toolchain, Python/uv for the parity sidecar, and CSPICE. Regenerating the WASM binary needs Emscripten. See [`../docs/development-setup.md`](../docs/development-setup.md) and the project readiness audit for setup steps and validation evidence.
