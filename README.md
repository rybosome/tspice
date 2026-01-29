# `tspice`

**An idiomatic TypeScript wrapper around NAIF SPICE — for Node *and* the browser.**

`tspice` makes the SPICE toolkit usable from modern TypeScript environments, including WebAssembly-backed browser apps, without forcing you into C, Fortran, or Python bindings.

It provides a **typed, ergonomic API** on top of an existing SPICE core, while preserving access to lower-level primitives when you need them.

- Exposes a **clean, typed API** for common SPICE workflows
- Runs in **Node.js** and **WebAssembly** environments
- Supports **multiple interchangeable backends**
- Keeps CSPICE as an **implementation detail**, not a user-facing dependency

> NOTE: This project is currently in a pre-0.1.0 state; API stability between versions is not guaranteed.

---

## Who is this for?

`tspice` is designed for:

- 🌍 **Browser-based space visualization** (WebGL, Three.js, custom viewers)
- 🛰️ **SPICE users** who want a modern, typed API
- 🧪 **Researchers and educators** building interactive tools
- 🛠️ **TypeScript / Node developers** who don’t want to bind C or Fortran

It may *not* be a good fit if you are looking for:

- A kernel-free abstraction
- A pure TypeScript reimplementation of SPICE (for now...)
- A minimal “just give me positions” black box

---

## What can I do with it?

With `tspice`, you can:

- Convert between **UTC and ephemeris time (ET)**
- Query **positions, velocities, and light-time**
- Perform **geometry and illumination calculations**
- Use the **same API** in Node and the browser
- Drop down to **low-level CSPICE calls** when needed

Below are screenshots from a [real, browser-based solar system visualization](https://tspice-viewer.ryboso.me/) built using `tspice`.

All positions, orientations, lighting angles and time evolution are computed using SPICE (via WebAssembly). Rendering is handled using WebGL.

*Earth lighting & day/night terminator*
<img src="https://rybosome.github.io/tspice/images/tspice-earth-lighting.png" alt="Earth with day/night terminator" />


*Labeled Jupiter–Sun geometry*
<img src="https://rybosome.github.io/tspice/images/tspice-jupiter-sun.png" alt="Jupiter–Sun geometry with labels" />


*Solar system ephemerides*
<img src="https://rybosome.github.io/tspice/images/tspice-solar-system.png" alt="Solar system overview" />

---

## Quickstart

Install:

```bash
pnpm add @rybosome/tspice
```

Minimal usage

```ts
import { createSpice } from "@rybosome/tspice";

async function main() {
  const spice = await createSpice({ backend: "wasm" });

  console.log(spice.cspice.kind); // "wasm"
  console.log(spice.kit.toolkitVersion());
}

main().catch(console.error);
```

---

## Usage

### Backend selection

`tspice` runs SPICE through interchangeable **backends**, allowing the same API to work across environments.

- **`wasm`** — Portable WebAssembly backend (browser-realistic), also runnable outside the browser
- **`node`** — Native Node.js addon

```ts
import { createSpice } from "@rybosome/tspice";

const wasm = await createSpice({ backend: "wasm" });
const node = await createSpice({ backend: "node" });

console.log(wasm.cspice.kind); // "wasm"
console.log(node.cspice.kind); // "node"
```

---

## Kernel loading

SPICE is **kernel-driven**. Before performing meaningful computations, you must load the appropriate kernels (LSK, SPK, etc.).

Which kernels you load — and how — depends on your use case and environment.

- **Node** can load kernels directly from disk paths.
- **Browsers / WASM** load kernel *bytes* into an in-memory filesystem.
- `tspice` supports both with the same API.

---

### Which kernels do I need?

At a minimum, most applications will load:

- **LSK** — Leap seconds  
  Required for UTC ↔ ET conversion  
  Example: `naif0012.tls`

- **SPK** — Ephemeris data  
  Required for positions and velocities  
  Example: `de440.bsp`

Often, you will also load:

- **PCK** — Body constants / orientation  
  Example: `pck00010.tpc`
- **FK / CK / SCLK / IK** — Frames, spacecraft attitude, clocks, instrument geometry

You can obtain official kernels from the NAIF archive:  
https://naif.jpl.nasa.gov/naif/data.html

---

### Node kernel loading (filesystem paths)

If you are using the Node backend, kernels can be loaded directly from disk.

```ts
import { createSpice } from "@rybosome/tspice";

const spice = await createSpice({ backend: "node" });

spice.kit.loadKernel("/path/to/naif0012.tls");
```

---

### WASM kernel loading (browser-realistic)

```ts
import { createSpice } from "@rybosome/tspice";

async function fetchKernel(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

const spice = await createSpice({ backend: "wasm" });

spice.kit.loadKernel({
  path: "/kernels/naif0012.tls",
  bytes: await fetchKernel("/kernels/naif0012.tls"),
});
```

---

## Examples

### Ephemeris state

```ts
const et = spice.kit.utcToEt("2025-01-01T00:00:00Z");

const state = spice.kit.getState({
  target: "MARS",
  observer: "EARTH",
  at: et,
  frame: "J2000",
  aberration: "LT+S",
});

```

---

### Geometry and illumination

This example computes the sub-solar point and illumination angles on a body.

```ts
const { spoint } = spice.cspice.subslr(
  "Near Point: Ellipsoid",
  "MARS",
  et,
  "IAU_MARS",
  "LT+S",
  "SUN",
);
```

---

## Repository layout

| Path | Purpose |
| --- | --- |
| `packages/tspice` | Public facade |
| `packages/backend-wasm` | WASM backend |
| `packages/backend-node` | Node native addon |
| `packages/backend-fake` | Deterministic stub |
| `packages/backend-contract` | Shared backend interface |
| `packages/core` | Shared utilities |
| `apps/tspice-viewer` | Internal example / visualization app |

---

## Development & verification

```bash
pnpm check          # JS-only checks
pnpm check:native   # Full native build
```

Native builds require Python 3 and a working `node-gyp` toolchain.

---

## CSPICE disclosure & policy

`tspice` embeds CSPICE-derived components only as an internal implementation detail and follows NAIF redistribution guidance.

- See [`docs/cspice-naif-disclosure.md`](./docs/cspice-naif-disclosure.md)
- See [`docs/cspice-policy.md`](./docs/cspice-policy.md)

End users typically do **not** need to interact with this directly.

