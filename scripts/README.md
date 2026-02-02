# `scripts/`

This directory contains **repo-internal** helper scripts used by pnpm scripts and CI.

In most cases, you should prefer invoking these via the **workspace root** `package.json` scripts (so CI and local usage stay consistent).

## Common entry points

From the repo root:

```bash
pnpm run check:compliance
pnpm run check:versions
pnpm run fetch:cspice
pnpm run stage:native-platform
```

See the full script list in [`../package.json`](../package.json).

## What lives here

| File | Purpose / when to look here |
| --- | --- |
| `check-compliance-files.mjs` | Validates required compliance/disclosure files and links are present (CI guard). |
| `verify-native-package-versions.mjs` | Ensures `tspice-native-*` package versions match `@rybosome/tspice`. |
| `fetch-cspice.mjs` | Fetches the pinned CSPICE sources/archives used by native + wasm builds. |
| `cspice.manifest.json` | Manifest (pins + URLs) consumed by `fetch-cspice.mjs`. |
| `build-backend-wasm.mjs` | Regenerates the checked-in wasm artifacts under `packages/backend-wasm/emscripten/` (requires Emscripten). |
| `backend-wasm-assets.mjs` | Shared constants for wasm asset filenames used by build/copy scripts. |
| `copy-backend-wasm-assets.mjs` | Copies wasm assets from `packages/backend-wasm/emscripten/` into `packages/backend-wasm/dist/`. |
| `stage-native-platform.mjs` | Stages a built native `.node` addon into the appropriate `packages/tspice-native-*/` package. |
| `set-release-version.mjs` | Helper for setting release versions (used during publishing workflows). |
| `print-spice-version.mjs` | Prints toolkit/runtime version info (useful for debugging). |
| `print-cspice-dir.mjs` | Prints the CSPICE directory being used (useful for debugging build env issues). |
| `read-pnpm-version.cjs` | Utility for reading the pinned pnpm version (CI/bootstrap helper). |
