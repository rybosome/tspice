# `tspice`

**An idiomatic TypeScript wrapper around NAIF SPICE — for Node *and* the browser.**

`tspice` makes the SPICE toolkit usable from modern TypeScript environments, including WebAssembly-backed browser apps, without forcing you into C, Fortran, or Python bindings.

Until now, using SPICE from JavaScript meant shelling out, re-implementing math, or abandoning browser-based workflows entirely.

`tspice` provides a **typed, ergonomic API** on top of an existing SPICE core, while preserving access to lower-level primitives when you need them.

- Exposes a **clean, typed API** for common SPICE workflows
- Runs in **Node.js** and **WebAssembly** environments
- Supports **multiple interchangeable backends**
- Keeps CSPICE as an **implementation detail**, not a user-facing dependency

> NOTE: This project is currently pre-0.1.0. APIs may change as the design settles, though breaking changes will be intentional and documented.

---

## Who is this for?

`tspice` is designed for:

- 🌍 **Browser-based space visualization** (WebGL, Three.js, custom viewers)
- 🛰️ **SPICE users** who want a modern, typed API
- 🧪 **Researchers and educators** building interactive tools
- 🛠️ **TypeScript / Node developers** who don’t want to bind C or Fortran

It may *not* be a good fit if you are looking for:

- A kernel-free abstraction (SPICE remains kernel-driven)
- A pure TypeScript reimplementation of SPICE (for now…)
- A minimal “just give me positions” black box

---

## What can I do with it?

With `tspice`, you can:

- Convert between **UTC and ephemeris time (ET)**
- Query **positions, velocities, and light-time**
- Perform **geometry and illumination calculations**
- Use the **same API** in Node and the browser
- Drop down to **low-level CSPICE calls** when needed

This unlocks SPICE-accurate ephemerides, lighting, and geometry **directly inside interactive browser visualizations**, without server round-trips or precomputed data.

Below are screenshots from a [real, browser-based solar system visualization](https://tspice-viewer.ryboso.me/) built using `tspice`.

All positions, orientations, lighting angles, and time evolution are computed using SPICE (via WebAssembly). Rendering is handled using WebGL.

*Earth lighting & day/night terminator*

<img src="https://rybosome.github.io/tspice/images/tspice-earth-lighting.png" alt="Earth with day/night terminator" />

<table>
  <tr>
    <td align="center">
      <img src="https://rybosome.github.io/tspice/images/tspice-jupiter-sun.png"
           alt="Jupiter–Sun geometry with labels"
           style="max-width: 100%; height: auto;" />
      <br />
      <em>Labeled Jupiter–Sun geometry</em>
    </td>
    <td align="center">
      <img src="https://rybosome.github.io/tspice/images/tspice-solar-system.png"
           alt="Solar system overview"
           style="max-width: 100%; height: auto;" />
      <br />
      <em>Solar system ephemerides</em>
    </td>
  </tr>
</table>

---

## Quickstart

Install:

```bash
pnpm add @rybosome/tspice
```

Minimal usage:

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

Backends allow `tspice` to preserve a single API surface while adapting to very different runtime constraints.

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
pnpm check
pnpm check:native
```

### Repo commands

When running package-level scripts from the repo root, prefer pnpm filters:

```bash
pnpm --filter @rybosome/tspice run build
pnpm --filter @rybosome/tspice-backend-node run build:native
pnpm --filter @rybosome/tspice-viewer run dev
```

For README conventions and templates, see `docs/readme-conventions.md`.

Native builds require Python 3 and a working `node-gyp` toolchain.

---

## CSPICE disclosure & policy

`tspice` embeds CSPICE-derived components only as an internal implementation detail and follows NAIF redistribution guidance.

- See `docs/cspice-naif-disclosure.md`
- See `docs/cspice-policy.md`

End users typically do **not** need to interact with this directly.

---

## Contact

If this project is relevant to your work and you’d like to reach out, you can email me at:

**tspice@ryboso.me**

I can’t promise rapid responses, but I do read everything.
