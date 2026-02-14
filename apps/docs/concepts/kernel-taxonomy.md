# Kernel taxonomy

SPICE data comes from **kernels**: files that define ephemerides, constants, frames, pointing, and more.

Knowing which kernel type you need is half of “using SPICE successfully.”

## What it is

Common kernel types:

- **LSK** (leapseconds, `*.tls`): required for many UTC↔ET conversions.
- **SPK** (ephemeris, `*.bsp`): position/velocity of bodies over time.
- **PCK** (planetary constants, `*.tpc`/`*.bpc`): body radii, orientation models, constants.
- **FK** (frames, `*.tf`): defines custom frames and relationships between frames.
- **CK** (C-kernel pointing, `*.bc`): spacecraft attitude/pointing vs time.
- **SCLK** (spacecraft clock, `*.tsc`): converts spacecraft clock time ↔ ET.
- **IK** (instrument, `*.ti`): instrument parameters (FOV, boresight, mounting frames).
- **DSK** (digital shape, often `*.bds`/`*.dsk`): high-resolution body shape models.

SPICE also has “meta-kernels” (`*.tm`) that list other kernels to load, and EK kernels for event/observation databases — but the list above covers most geometry workflows.

### Kernel pool (and why load order matters)

In addition to “loaded files,” SPICE maintains a global **kernel pool**: a key/value store populated by text kernels and meta-kernels.

Implications:

- Loading kernels is a **global side effect**.
- **Load order can change results**, especially when multiple kernels define the same variables.
- `kclear()` resets both the loaded-kernel table and the kernel pool.

## Why it matters

Most SPICE calls fail (or quietly change meaning) if the right kernels aren’t loaded.

Examples:

- UTC↔ET needs an LSK.
- `spkezr`/`spkpos` need SPKs for the target/observer.
- Many frame transforms need FK/PCK/CK/SCLK.

## Kernels required

None to read this page.

For actual computations, the required kernels depend on the routine; each Concepts page calls out its own prerequisites.

## How it maps to tspice

### Loading and clearing

Use `kit` helpers for a backend-portable experience:

- `kit.loadKernel(kernel)` wraps `raw.furnsh(...)`
- `kit.unloadKernel(path)` unloads by **virtual kernel identifier**
- `kit.kclear()` / `raw.kclear()` clears everything

At the raw layer:

- `raw.furnsh(kernel)` loads a kernel (filesystem path in Node; virtual path/id in WASM)
- `raw.unload(path)` unloads a previously loaded kernel

### Introspection (`ktotal` / `kdata` / `kinfo`)

SPICE provides a loaded-kernel table you can inspect:

```ts
const n = await spice.raw.ktotal("ALL");

for (let which = 0; which < n; which++) {
  const k = await spice.raw.kdata(which, "ALL");
  if (!k.found) continue;
  console.log(k.file, k.filtyp, k.source);
}

// Query by filename/id (when available)
const info = await spice.raw.kinfo("/kernels/naif0012.tls");
if (info.found) {
  console.log(info.filtyp, info.source);
}
```

## Gotchas

- **Path semantics differ by backend:**
  - Node: `furnsh("...")` expects an OS filesystem path.
  - WASM: `furnsh({ path, bytes })` uses a virtual path/id (commonly under `/kernels/...`).
- **Unloading isn’t “undo”:** removing a kernel doesn’t necessarily restore prior kernel-pool values when there were conflicts.
- **Prefer `kclear()` for isolation:** especially in tests, REPLs, and long-lived processes.
- **Text kernels show up as `TEXT`:** SPICE often reports `filtyp: "TEXT"` even when the kernel is logically an LSK/FK/IK/etc.
