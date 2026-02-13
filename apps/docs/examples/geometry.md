# Geometry (Node-first): ray/surface intercepts (`raw.sincpt`)

This recipe is **Node.js-first** and uses the native addon backend (`backend: "node"`).

We’ll compute a surface intercept point on the Moon by tracing a ray from Earth toward the Moon.

## Kernels required (and why)

- **LSK** (`*.tls`): required for `kit.utcToEt()`.
- **SPK** (`*.bsp`): required to get Earth→Moon state/position.
- **PCK** (`*.tpc`): required for `IAU_MOON` + Moon radii (ellipsoid shape).

## Load kernels from filesystem paths

In Node, kernel sources are just filesystem paths (strings):

```ts
import path from 'node:path'
import { spiceClients } from '@rybosome/tspice'

const kernelsDir = path.resolve('kernels')

const { spice, dispose } = await spiceClients.toSync({ backend: 'node' })

try {
  spice.kit.loadKernel(path.join(kernelsDir, 'naif0012.tls'))
  spice.kit.loadKernel(path.join(kernelsDir, 'pck00011.tpc'))
  spice.kit.loadKernel(path.join(kernelsDir, 'de432s.bsp'))

  // …geometry query…
} finally {
  await dispose()
}
```

## Example: intercept the Moon along an Earth→Moon ray

```ts
const toDegrees = (rad: number): number => (rad * 180) / Math.PI

const et = spice.kit.utcToEt('2024-01-01T00:00:00Z')

const method = 'ELLIPSOID'
const target = 'MOON'
const fixref = 'IAU_MOON'
const abcorr = 'NONE'
const observer = 'EARTH'

// Direction reference frame for the ray.
const dref = 'J2000'

// Aim the ray at the Moon by using the Earth→Moon position vector.
const { pos: earthToMoon } = spice.raw.spkpos(target, et, dref, abcorr, observer)

const out = spice.raw.sincpt(
  method,
  target,
  et,
  fixref,
  abcorr,
  observer,
  dref,
  earthToMoon,
)

if (!out.found) {
  throw new Error('Ray missed the target (no intercept found)')
}

// `spoint` is the intercept point in the target body-fixed frame (`fixref`).
const { spoint, trgepc, srfvec } = out

// Convert rectangular coordinates -> planetocentric lon/lat (radians).
const { radius, lon, lat } = spice.raw.reclat(spoint)

console.log({
  trgepc,
  spointKm: spoint,
  observerToSurfaceKm: srfvec,
  lonDeg: toDegrees(lon),
  latDeg: toDegrees(lat),
  radiusKm: radius,
})
```

## Interpreting the result

- `found: false` means the ray does not hit the target body.
- `spoint` is the intercept point in the **target body-fixed frame** you passed as `fixref`.
  In this example that’s `IAU_MOON`.
- `srfvec` is the vector from the observer to the surface point (in the `fixref` frame).
- `trgepc` is the “target epoch” (it can differ from your input `et` when you use aberration
  corrections other than `"NONE"`).
