# tspice-viewer

Minimal Vite + React + TypeScript app that renders a basic Three.js scene using an imperative `canvas` setup (no `@react-three/fiber`).

This workspace is intended to evolve into a renderer / Three.js viewer for tspice.

## Development

From repo root:

- `pnpm install`
- `pnpm -C apps/tspice-viewer dev`

## Scripts

- `pnpm -C apps/tspice-viewer build`
- `pnpm -C apps/tspice-viewer typecheck`
- `pnpm -C apps/tspice-viewer test`

## Conventions

### Frames / world space

- Canonical world (inertial) frame: `J2000`.
- `x/y/z` axis mapping is **1:1** with Three.js world axes.
- Handedness: follow SPICE conventions for the requested frame (for `J2000`, treat it as a right-handed inertial frame).

### Time

- `et` is **ephemeris time** in **seconds past the J2000 epoch**.
- In this codebase we represent it as a plain `number` (`EtSeconds`).

> Note: The exact J2000 epoch in SPICE is `2000-01-01 12:00:00 TT`.

### Units

- Positions are expressed in **kilometers** (`positionKm`).
- Velocities are expressed in **kilometers per second** (`velocityKmPerSec`).
- Radii (for rendering) are expressed in **kilometers** (`radiusKm`).

### Scaling to renderer units

SPICE scales are huge for typical WebGL scenes.

A reasonable starting point is:

- `1 threeUnit = 1,000 km` (`kmToWorld = 1 / 1000`)

Tune this depending on camera near/far planes and desired precision.

### Frame transforms

`SpiceClient.getFrameTransform({ from, to, et })` returns a `Mat3` rotation matrix.

- Representation: a flat `number[9]` in **column-major** order to match Three.js `Matrix3`.
- Indexing:
  - `m = [
      m00, m10, m20,
      m01, m11, m21,
      m02, m12, m22
    ]`
  - This corresponds to columns `c0=(m00,m10,m20)`, `c1=(m01,m11,m21)`, `c2=(m02,m12,m22)`.

The transform is intended to be applied as:

- `v_to = M(from->to) * v_from`

## What’s included

- `src/spice/SpiceClient.ts`: a minimal renderer-facing interface
- `src/spice/createSpiceClient.ts`: viewer integration layer (defaults to the tspice fake backend)
- `src/spice/createCachedSpiceClient.ts`: single-entry (`et`-keyed) cache wrapper for viewer perf
- `src/scene/SceneModel.ts`: types describing bodies and render styling

## Visual regression testing

Playwright e2e tests live in `apps/tspice-viewer/e2e`.

From repo root:

- `pnpm -C apps/tspice-viewer e2e`
