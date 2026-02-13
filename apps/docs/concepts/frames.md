# Frames

In SPICE, almost every vector has an implied coordinate system called a **frame**.

Frames are referenced by name (strings like `"J2000"`), and many frames are **time-dependent**, meaning you need an epoch to transform between them.

## What it is

A **frame** is a named coordinate system.

Common examples:

- `"J2000"`: canonical inertial frame (often the default in SPICE workflows)
- `"IAU_EARTH"`: Earth body-fixed frame (rotates with the Earth)

Two core SPICE primitives:

- `pxform(from, to, et)`: returns a **3×3 rotation matrix**.
- `sxform(from, to, et)`: returns a **6×6 state transformation matrix** (position + velocity).

## Why it matters

A position like `[x, y, z]` is meaningless unless you know the frame.

Frame mistakes are a top source of subtle bugs:

- mixing inertial and body-fixed frames
- transforming a state (pos+vel) with the wrong kind of matrix
- forgetting that transforms can be time-dependent

## Kernels required

It depends on which frames you use:

- **None (sometimes):** some inertial frames and transforms are built in.
- **PCK:** body orientation models (for many body-fixed frames)
- **FK:** frame definitions for mission/instrument frames and custom frames
- **CK + SCLK:** spacecraft attitude/pointing frames (time-dependent)

If a frame isn’t defined by built-ins or loaded kernels, SPICE will throw.

## How it maps to tspice

### `kit.frameTransform(...)` (recommended)

`kit.frameTransform(from, to, et)` is a wrapper around `raw.pxform(...)` that returns a `Mat3` helper.

```ts
const et = await spice.kit.utcToEt("2000 JAN 01 12:00:00");

const R = await spice.kit.frameTransform("J2000", "IAU_EARTH", et);

// Raw SPICE layout (row-major): [m00,m01,m02, m10,m11,m12, m20,m21,m22]
const rowMajor = R.rowMajor;

// Convenience for column-major consumers (WebGL, many math libs)
const colMajor = R.colMajor;
```

### `raw.pxform(...)` / `raw.sxform(...)` (parity)

```ts
const rm = await spice.raw.pxform("J2000", "IAU_EARTH", et);

// If you need a 6x6 state transform (pos+vel), use sxform.
const xform6 = await spice.raw.sxform("J2000", "IAU_EARTH", et);
```

`tspice` encodes matrices from the raw layer in **row-major** order.

If you need to adapt a raw 3×3 row-major array to a column-major array:

```ts
const rm = await spice.raw.pxform(from, to, et);
const cm = [rm[0], rm[3], rm[6], rm[1], rm[4], rm[7], rm[2], rm[5], rm[8]];
```

## Gotchas

- **Direction matters:** `pxform(from, to, et)` transforms a vector *expressed in `from`* into the same vector *expressed in `to`*.
- **Row-major vs column-major:** most rendering/math ecosystems default to column-major; use `Mat3.colMajor` when integrating.
- **Kernel dependencies are easy to miss:** if a frame is kernel-defined, transforms will fail until you load the right FK/PCK/CK/SCLK.
- **Time dependence:** transforms for rotating frames vary with `et`; cache carefully.
