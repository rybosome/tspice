# `tspice`: Idiomatic TypeScript Wrapper for SPICE

## 🎯 Project Goal

**`tspice`**, an idiomatic TypeScript library that:

- Exposes a **typed, ergonomic API** for SPICE operations
- Supports **Node** and **WASM**
- Hides low-level SPICE details behind a stable TypeScript abstraction

This project **does not** attempt to reimplement SPICE in TypeScript. Instead, it provides a clean, powerful API on top of an existing SPICE core.

## Quickstart

> Note: this repo is a pnpm monorepo (workspace). Packages are currently marked
> `private: true`, so you typically use `tspice` from within this workspace.

Install dependencies:

```bash
pnpm install
```

Minimal usage (defaults to the WASM backend):

```ts
import { createBackend } from "@rybosome/tspice";

async function main() {
  const backend = await createBackend();
  console.log(backend.kind); // "wasm" (default)
  console.log(backend.spiceVersion());
}

main().catch(console.error);
```


## Usage

### Kernel loading (byte-backed; works in WASM)

The WASM backend loads kernels from an in-memory filesystem. To make the same code work in Node **and** WASM, you can read kernel bytes yourself and pass them to `loadKernel()`:

```ts
import fs from "node:fs";
import path from "node:path";

import { createSpice } from "@rybosome/tspice";

const readKernel = (name: string) =>
  fs.readFileSync(path.join(process.cwd(), "kernels", name));

async function main() {
  const spice = await createSpice(); // defaults to WASM

  // Put kernels under ./kernels in your project.
  spice.loadKernel({
    path: "/kernels/naif0012.tls",
    bytes: readKernel("naif0012.tls"),
  });

  // (Load any additional kernels you need: SPKs, PCKs, etc.)
}

main().catch(console.error);
```

Node-only shortcut (native backend): if you select the Node backend, you can load kernels directly from disk paths:

```ts
import { createSpice } from "@rybosome/tspice";

async function main() {
  const spice = await createSpice({ backend: "node" });
  spice.loadKernel("./kernels/naif0012.tls");
}

main().catch(console.error);
```

### Advanced: ephemeris state (`utcToEt` + `getState`)

```ts
import { createSpice } from "@rybosome/tspice";

async function main() {
  const spice = await createSpice();

  // Requires you to have already loaded an LSK + SPK kernels.
  const et = spice.utcToEt("2025-01-01T00:00:00Z");

  const state = spice.getState({
    target: "MARS",
    observer: "EARTH",
    at: et,
    frame: "J2000",
    aberration: "LT+S",
  });

  console.log(state.position, state.velocity, state.lightTime);
}

main().catch(console.error);
```

### Advanced: geometry (`subslr` + `reclat` + `ilumin`)

This example computes the sub-solar point on a target body and then reports illumination angles at that point.

```ts
import { createSpice } from "@rybosome/tspice";

const radToDeg = (radians: number) => (radians * 180) / Math.PI;

async function main() {
  const spice = await createSpice();

  // Requires appropriate kernels (LSK + PCK + SPK, at minimum).
  const et = spice.utcToEt("2025-01-01T00:00:00Z");

  const backend = spice.backend;

  const { spoint } = backend.subslr(
    "Near Point: Ellipsoid",
    "MARS",
    et,
    "IAU_MARS",
    "LT+S",
    "SUN",
  );

  const { lon, lat } = backend.reclat(spoint);

  const { phase, solar, emissn } = backend.ilumin(
    "Ellipsoid",
    "MARS",
    et,
    "IAU_MARS",
    "LT+S",
    "SUN",
    spoint,
  );

  console.log({
    subSolarLonDeg: radToDeg(lon),
    subSolarLatDeg: radToDeg(lat),
    phaseDeg: radToDeg(phase),
    solarIncidenceDeg: radToDeg(solar),
    emissionDeg: radToDeg(emissn),
  });
}

main().catch(console.error);
```

## Monorepo / package map

| Path | Package | Purpose |
| --- | --- | --- |
| `packages/tspice` | `@rybosome/tspice` | Public facade: `createBackend()`, `createSpice()`, exported types |
| `packages/backend-wasm` | `@rybosome/tspice-backend-wasm` | WASM backend implementation (**default**) |
| `packages/backend-node` | `@rybosome/tspice-backend-node` | Node.js native-addon backend implementation (opt-in) |
| `packages/backend-contract` | `@rybosome/tspice-backend-contract` | Shared backend interface + types |
| `packages/core` | `@rybosome/tspice-core` | Shared utilities and small helpers |
| `packages/backend-shim-c` | `@rybosome/tspice-backend-shim-c` | WIP / internal shim code |
| `apps/tspice-viewer` | `@rybosome/tspice-viewer` | Example app + Playwright e2e tests |

## Backend selection

`@rybosome/tspice` is the entrypoint most callers should use. It selects an
underlying backend implementation.

- `createBackend()` defaults to `backend: "wasm"`.
- The Node/native backend must be explicitly selected (and requires building the
  native addon; see [`packages/backend-node`](./packages/backend-node/README.md)).

```ts
import { createBackend } from "@rybosome/tspice";

async function main() {
  const wasmBackend = await createBackend();
  const nodeBackend = await createBackend({ backend: "node" });
  console.log(wasmBackend.kind, nodeBackend.kind);
}

main().catch(console.error);
```

## Verification

From the repo root:

```bash
# JS-only checks: compliance, build, typecheck, tests (skips native addon)
pnpm check

# Playwright e2e for the viewer app
pnpm -C apps/tspice-viewer e2e

# Full native build + checks (requires a working node-gyp toolchain)
pnpm check:native
```

Native prerequisites (contributors): Python 3 + `node-gyp` toolchain (compiler,
`make`, etc). The native build will fetch CSPICE into the repo-local `.cache/`.

## CSPICE disclosure & policy

`tspice` is designed to embed CSPICE-derived components only as an internal implementation detail to support its TypeScript API, and not as a general-purpose distribution of CSPICE. This section is an overview; see the policy doc for the canonical constraints.

- See [`docs/cspice-naif-disclosure.md`](./docs/cspice-naif-disclosure.md) for the canonical disclosure text, NAIF links, and pointers to notice files.
- See [`docs/cspice-policy.md`](./docs/cspice-policy.md) for the project's CSPICE usage and distribution policy, including redistribution constraints and third-party interface guidance that contributors and maintainers are expected to follow.

Compliance notes:

- Do **not** commit `.cache/` (it contains fetched CSPICE toolkits and build
  artifacts). The repo ignores `.cache/`, but please keep it local.
- `pnpm check` runs `pnpm run check:compliance`, which executes
  `scripts/check-compliance-files.mjs` as a guardrail to ensure disclosure,
  policy, notices, and linked compliance files stay present and readable.

## Examples

- Unit tests live under `packages/*/test`.
- `apps/tspice-viewer` is a real example consumer (plus an e2e harness).
- `apps/tspice-viewer/src/spice/FakeSpiceClient.ts` is a deterministic stub
  implementation that’s useful for app/dev flows when you don’t want to depend
  on real kernels.

---

## 🧱 High-Level Architecture

Three main layers:

---

### 1️⃣ Backend Layer — “Raw SPICE”

Internal interface for calling SPICE:

```ts
interface RawSpiceBackend {
  furnsh(path: string): void;
  unload(path: string): void;

  str2et(utc: string): number;
  et2utc(et: number, format: string, prec: number): string;

  spkezr(
    target: string,
    et: number,
    ref: string,
    abcorr: string,
    obs: string
  ): { state: number[]; lt: number };

  pxform(from: string, to: string, et: number): number[]; // 3x3
}
```

Two implementations exist:

- **Node backend** — native addon (see CSPICE / NAIF disclosure above)
- **WASM backend** — prebuilt WebAssembly module (see CSPICE / NAIF disclosure above)

The rest of the system should not care which backend is active.

---

### 2️⃣ Core Layer — Typed, “SPICE-Flavored” API

TypeScript-first interface wrapping backend calls.

This layer remains faithful to SPICE concepts (kernels, ET, frames) but in a **safe, typed, ergonomic** package.

---

### 3️⃣ Domain Helpers / High-Level Utilities

Layered atop core services, targeting visualization and real-time applications:

- Helpers for:
  - Ground tracks
  - Sun/Earth/target geometry
  - Preconfigured kernel packs (e.g., DE440 + NAIF LSK)

These are pure TypeScript compositions of the core layer.
