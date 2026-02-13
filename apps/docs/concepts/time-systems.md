# Time systems

SPICE’s “native” time variable is **ET**: seconds past J2000, on the TDB time scale.

Most user-facing inputs start as **UTC strings**, so a typical workflow is:

1. Load an LSK (leapseconds) kernel
2. Convert UTC → ET
3. Do all ephemeris/geometry work at ET
4. Convert ET → UTC for display

## What it is

A few time concepts you’ll see constantly:

- **UTC**: civil time with leap seconds.
- **ET (TDB)**: the ephemeris time scale used by SPICE for most geometry/ephemeris routines.
- **J2000 epoch**: the reference epoch SPICE uses; ET is expressed as seconds relative to this epoch.
- **SCLK**: spacecraft clock time; used for spacecraft attitude (CK) and some mission data.

## Why it matters

If you feed the wrong time system into SPICE, the result is usually “plausible but wrong.”

Also: **UTC↔ET is not purely arithmetic** — it depends on leap seconds and time constants loaded into SPICE state.

## Kernels required

- **UTC ↔ ET:** requires an **LSK** (`*.tls`, e.g. `naif0012.tls`).
- **Spacecraft clock conversions (SCLK):** require an **SCLK** kernel (`*.tsc`), and often also an LSK.
- **ET-only computations:** if you already have ET as a number, many routines don’t require the LSK (but your workflow often still does).

## How it maps to tspice

### `kit` (recommended)

`tspice` exposes UTC/ET helpers as:

- `kit.utcToEt(utc: string): SpiceTime`
- `kit.etToUtc(et: SpiceTime, format?: string, prec?: number): string`

```ts
// Async client example; in sync clients, omit `await`.

// UTC ↔ ET requires an LSK (leapseconds) to be loaded.
//
// Node: load from an OS filesystem path
await spice.kit.loadKernel("/path/to/naif0012.tls");

// WASM: load bytes into a virtual path/id (commonly under `/kernels/...`)
// await spice.kit.loadKernel({ path: "/kernels/naif0012.tls", bytes });

const et = await spice.kit.utcToEt("2000 JAN 01 12:00:00");

// Defaults: format = "C", prec = 3
const utc = await spice.kit.etToUtc(et);
```

### `raw` (CSPICE parity)

The underlying primitives are:

- `raw.str2et(time: string): number`
- `raw.et2utc(et: number, format: string, prec: number): string`

```ts
const et = await spice.raw.str2et("2000 JAN 01 12:00:00");
const utc = await spice.raw.et2utc(et, "C", 3);
```

If you need to control SPICE’s global time parsing defaults (TIMDEF), use `raw.timdef(...)`.

## Gotchas

- **LSK is required for UTC↔ET.** If it’s missing, you’ll get a thrown SPICE error.
- **`str2et` is stateful.** It depends on global TIMDEF defaults (SYSTEM/CALENDAR/ZONE). If you change them, you’re changing process/instance-wide behavior.
- **Time strings can be ambiguous.** Prefer explicit formats and time zones when possible.
- **Convert once at the boundary.** Don’t repeatedly bounce between UTC and ET inside inner loops.
