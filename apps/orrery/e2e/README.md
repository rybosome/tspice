# Orrery e2e (Playwright)

This folder contains Playwright tests, including visual regression (golden screenshot) tests.

## Run e2e locally

From repo root:

```sh
pnpm -C apps/orrery test:e2e
```

To open the interactive Playwright UI:

```sh
pnpm -C apps/orrery e2e:ui
```

## Update golden images

From repo root:

```sh
pnpm -C apps/orrery e2e --update-snapshots
```

Snapshots are stored alongside each spec in `*-snapshots/` directories.

## Notes for appearance iteration (Phase 0)

- Sun appearance screenshots use `/?e2e=1` and a small e2e-only API exposed on
  `window.__tspice_viewer__e2e`:
  - `setCameraPreset('sun-close' | 'sun-medium' | 'sun-far')`
  - `lockDeterministicLighting()`
  - `renderNTimes(n)` (force N renders for texture upload flush)
  - `samplePerfCounters()` / `getLastPerfCounters()`

These APIs are only installed in e2e mode and should not affect runtime visuals.
