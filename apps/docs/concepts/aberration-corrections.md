# Aberration corrections

When you ask SPICE for “where is body A relative to body B?”, there are (at least) two answers:

- the **geometric** position (instantaneous, ignoring the speed of light)
- the **apparent** position (accounting for light travel time and optionally stellar aberration)

SPICE controls this via the “aberration correction” flag (`abcorr`).

## What it is

Two related effects:

- **Light time**: light takes time to travel between observer and target, so the target’s apparent position corresponds to an earlier (or later) target epoch.
- **Stellar aberration**: the observer’s velocity changes the apparent direction to the target.

In CSPICE, you select these with strings like:

- `"NONE"`: geometric
- `"LT"`, `"LT+S"`: one-way light time, with optional stellar aberration
- `"CN"`, `"CN+S"`: converged Newtonian light time (iterative), with optional stellar aberration
- `"XLT"`, `"XLT+S"`, `"XCN"`, `"XCN+S"`: transmission-case variants

## Why it matters

At solar-system distances, light time is not a rounding error — it can be minutes.

If you’re doing:

- observer-centric visualization (“what does the observer see?”)
- instrument pointing / attitude computations
- high-precision geometry

…you usually want consistent aberration correction choices.

## Kernels required

- **SPK**: required (you need ephemerides for the target/observer)
- **LSK**: not required by `spkezr` itself (it takes ET), but commonly required if you start from UTC strings
- **Frames kernels (FK/PCK/CK/SCLK)**: required if you request states in non-trivial frames

## How it maps to tspice

### `kit.getState({ aberration })`

`tspice` exposes aberration correction as the `aberration` field on `kit.getState(...)`.

- Default is `"NONE"`.
- The returned `StateVector` includes `lightTime` (one-way seconds).

```ts
const et = await spice.kit.utcToEt("2000 JAN 01 12:00:00");

// Geometric state (default aberration: "NONE")
const geom = await spice.kit.getState({ target: "MARS", observer: "EARTH", at: et });

// Apparent state with one-way light time + stellar aberration
const app = await spice.kit.getState({
  target: "MARS",
  observer: "EARTH",
  at: et,
  aberration: "LT+S",
});

console.log(app.lightTime);
```

### `raw.spkezr(...)` / `raw.spkpos(...)` (parity)

`kit.getState(...)` is a structured wrapper around `raw.spkezr(...)`.

```ts
const { state, lt } = await spice.raw.spkezr("MARS", et, "J2000", "LT+S", "EARTH");
const { pos, lt: lt2 } = await spice.raw.spkpos("MARS", et, "J2000", "LT+S", "EARTH");
```

## Gotchas

- **Be consistent:** comparing vectors computed with different `abcorr` choices is a common source of confusion.
- **Transmission (`X...`) vs reception:** SPICE distinguishes “where was the target when the observer received the photons?” (no `X`) from “where is the target when the observer transmits the photons?” (`X...`). Pick the convention that matches your model.
- **Iterative corrections cost more:** `CN`/`XCN` are typically slower than `LT`/`XLT`.
- **`lightTime` is one-way seconds:** it’s not automatically “round trip.”
