# `tspice`: Idiomatic TypeScript Wrapper for SPICE

## 🎯 Project Goal

**`tspice`**, an idiomatic TypeScript library that:

- Exposes a **typed, ergonomic API** for SPICE operations
- Supports **Node** and **WASM**
- Hides low-level SPICE details behind a stable TypeScript abstraction

This project **does not** attempt to reimplement SPICE in TypeScript. Instead, it provides a clean, powerful API on top of an existing SPICE core.

## CSPICE / NAIF disclosure

See [`docs/cspice-naif-disclosure.md`](./docs/cspice-naif-disclosure.md) for the canonical disclosure text, NAIF links, and pointers to notice files.

See [`docs/cspice-policy.md`](./docs/cspice-policy.md) for the project’s CSPICE usage and distribution policy (including the mirror prohibition and derived-interface rationale).

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

Two implementations will exist:

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
