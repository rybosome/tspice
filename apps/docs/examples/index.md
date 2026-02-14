# Examples

This section is a set of copy/paste-friendly recipes for common **tspice** tasks.

At a high level, there are two supported runtime environments:

## Browser (WASM)

- Run the **WASM backend** in a **Web Worker** (recommended for UI responsiveness).
- Kernels must be loaded as bytes (`{ path, bytes }`) because the browser can’t read arbitrary
  filesystem paths.
- In practice you host kernels as static assets (or on a CDN) and `fetch()` them.

## Node.js (native addon)

- Use the **native addon backend** (`backend: "node"`) for speed and full filesystem access.
- Kernels are loaded from local filesystem paths (plain strings).

## Pages

- [Browser ephemeris (WASM + worker, `kit.getState`)](/examples/browser-ephemeris)
- [Lighting / illumination angles (`raw.ilumin`)](/examples/lighting)
- [Geometry (ray/surface intercepts via `raw.sincpt`)](/examples/geometry)
