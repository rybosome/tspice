# Lighting / illumination angles (`raw.ilumin`)

This page shows how to compute classic “lighting” angles at a surface point:

- **phase** angle
- **incidence** angle
- **emission** angle

It works the same way in **browser (WASM)** and **Node (native addon)**. The only real difference is
*how you load kernels*.

## Kernels required (and why)

- **LSK** (`*.tls`): needed if you want to convert UTC → ET via `kit.utcToEt()`.
- **SPK** (`*.bsp`): needed for Sun/observer/target positions.
- **PCK** (`*.tpc`): needed for target body radii + the body-fixed frame (e.g. `IAU_MOON`).

## Setup (pick one)

### Browser (WASM + worker)

```ts
import { kernels, spiceClients } from '@rybosome/tspice'

const pack = kernels
  .naif({
    kernelUrlPrefix: 'kernels/naif/',
    baseUrl: import.meta.env.BASE_URL,
  })
  .naif0012_tls()
  .pck00011_tpc()
  .de432s_bsp()
  .pack()

const { spice, dispose } = await spiceClients
  .withKernels(pack)
  .toWebWorker()
```

### Node.js (native addon)

```ts
import { spiceClients } from '@rybosome/tspice'

const { spice, dispose } = await spiceClients.toAsync({ backend: 'node' })

// Load kernels from local filesystem paths.
await spice.kit.loadKernel('/absolute/path/to/naif0012.tls')
await spice.kit.loadKernel('/absolute/path/to/pck00011.tpc')
await spice.kit.loadKernel('/absolute/path/to/de432s.bsp')
```

## Example: lighting at the sub-observer point on the Moon

In this example:

- target body: `MOON`
- observer: `EARTH`
- illumination source: the Sun (this is what CSPICE `ilumin` uses)

```ts
const toDegrees = (rad: number): number => (rad * 180) / Math.PI

try {
  const et = await spice.kit.utcToEt('2024-01-01T00:00:00Z')

  const target = 'MOON'
  const fixref = 'IAU_MOON'
  const observer = 'EARTH'
  const abcorr = 'NONE'

  // Pick a concrete surface point. Here we use the sub-observer point:
  // the nearest point on the Moon to the observer.
  const { spoint } = await spice.raw.subpnt(
    'Near point: Ellipsoid',
    target,
    et,
    fixref,
    abcorr,
    observer,
  )

  // Compute illumination angles at that surface point.
  const out = await spice.raw.ilumin(
    'ELLIPSOID',
    target,
    et,
    fixref,
    abcorr,
    observer,
    spoint,
  )

  console.log({
    phaseDeg: toDegrees(out.phase),
    incidenceDeg: toDegrees(out.incdnc),
    emissionDeg: toDegrees(out.emissn),
  })
} finally {
  await dispose()
}
```

### Notes

- `raw.ilumin()` returns angles in **radians** (matching CSPICE).
- The `method` string controls the surface model.

#### Ellipsoid vs DSK

- `method: "ELLIPSOID"` means a tri-axial ellipsoid defined by PCK radii.
- For high-resolution topography, load a **DSK** and use a DSK method string
  (for example, `"DSK/UNPRIORITIZED"`). DSK-based lighting can be slower and requires additional
  shape kernels.
