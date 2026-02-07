# `SpiceBackend` ↔ CSPICE mapping (backend-contract parity)

This doc maps each `SpiceBackend` domain method from `packages/backend-contract/src/domains/*` to the underlying CSPICE routine(s) the backend is expected to call.

## Scope

Included domains (from `packages/backend-contract/src/domains/`):

- `time`
- `ids-names`
- `frames`
- `kernels`
- `error`
- `ephemeris`
- `geometry`
- `coords-vectors`

## Contract + type conventions (shared)

Shared types are defined in `packages/backend-contract/src/shared/types.ts`.

- **Units** follow NAIF/SPICE conventions unless otherwise stated:
  - `et`: seconds past J2000 **TDB**
  - distances: km
  - angles: radians
- **Optional results** use `Found<T>`:

  ```ts
  export type Found<T> = { found: false } | ({ found: true } & T);
  ```

  Backends must return `{ found: false }` for legitimate “not found” outcomes and must not throw in those cases.
- **Vectors/matrices**:
  - `SpiceVector3`: `[number, number, number]`
  - `Mat3RowMajor`: length-9 array in row-major order: `[m00,m01,m02, m10,m11,m12, m20,m21,m22]`
  - `SpiceMatrix6x6` / `Mat6RowMajor`: length-36 array in row-major order

### Suggested numeric comparison tolerances (starting point)

When comparing backend implementations (e.g. node vs wasm), use element-wise comparisons for vectors/matrices.
These tolerances are a reasonable *starting point*; tighten/loosen as needed for specific kernels and platforms.

- Pure math (coords/vectors): `atol = 1e-12`
- Frame transforms (pxform/sxform): `atol = 1e-12`
- Ephemeris/geometry vectors in km: `atol = 1e-9` km
- Epochs/light time in seconds: `atol = 1e-9` s


## Kernel fixtures present in this repo

These are useful when writing tests/fixtures for stateful routines (time conversions, ephemeris, body constants, etc.).

- LSK (leapseconds):
  - `apps/orrery/public/kernels/naif/naif0012.tls`
  - `packages/tspice/test/fixtures/kernels/naif0012.tls`
- PCK (planetary constants, text):
  - `apps/orrery/public/kernels/naif/pck00011.tpc`
- SPK (ephemeris):
  - `apps/orrery/public/kernels/naif/de432s.bsp`
- SCLK (spacecraft clock, text):
  - `packages/tspice/test/fixtures/kernels/cook_01.tsc`
- Meta-kernel placeholders:
  - `packages/backend-node/test/fixtures/minimal.tm`
  - `packages/backend-wasm/test/fixtures/minimal.tm`

### Kernel types not currently present (suggested NAIF/mission kernels)

Some APIs below require kernels that don’t appear in-repo today (e.g. CK pointing, frame kernels).

Typical inputs by category:

- FK: frame definitions (often mission-specific `*.tf`)
- IK: instrument definitions / FOV parameters (often mission-specific `*.ti`)
- SCLK: spacecraft clock coefficients (`*.tsc`)
- CK: attitude/pointing (`*.bc`)
- SPK: ephemerides (`*.bsp`)

For generic solar system work, these NAIF standards are commonly used:

- `naif0012.tls` (LSK) — needed for many UTC↔ET conversions
- `pck00011.tpc` (text PCK) — body radii/shape constants for ellipsoid geometry
- `de432s.bsp` (SPK) — planetary ephemerides

---

## Domain: `time` (`TimeApi`)

| domain.method | CSPICE entrypoint(s) | Args (TS shape) | Returns (TS shape) | Comparison notes (tolerance/normalization) | Statefulness / required kernels |
| --- | --- | --- | --- | --- | --- |
| `time.spiceVersion()` | `tkvrsn_c("TOOLKIT")` | `(): string` | `string` | exact string match | none |
| `time.tkvrsn(item)` | `tkvrsn_c` | `(item: "TOOLKIT"): string` | `string` | exact string match | none |
| `time.str2et(time)` | `str2et_c` | `(time: string): number` | `number` | floating compare (ET seconds) | requires LSK (`*.tls`); may depend on loaded time constants in kernel pool |
| `time.et2utc(et, format, prec)` | `et2utc_c` | `(et: number, format: string, prec: number): string` | `string` | exact string match (format-dependent) | requires LSK (`*.tls`) |
| `time.timout(et, picture)` | `timout_c` | `(et: number, picture: string): string` | `string` | exact string match (picture-dependent) | requires LSK (`*.tls`) for many pictures |
| `time.scs2e(sc, sclkch)` | `scs2e_c` | `(sc: number, sclkch: string): number` | `number` | floating compare (ET seconds) | requires SCLK kernel (`*.tsc`) for `sc`; typically also needs LSK |
| `time.sce2s(sc, et)` | `sce2s_c` | `(sc: number, et: number): string` | `string` | exact string match | requires SCLK kernel (`*.tsc`) for `sc`; typically also needs LSK |

Notes:

- `spiceVersion()` is a convenience alias; the contract also exposes `tkvrsn("TOOLKIT")` explicitly.

---

## Domain: `ids-names` (`IdsNamesApi`)

| domain.method | CSPICE entrypoint(s) | Args (TS shape) | Returns (TS shape) | Comparison notes (tolerance/normalization) | Statefulness / required kernels |
| --- | --- | --- | --- | --- | --- |
| `ids-names.bodn2c(name)` | `bodn2c_c` | `(name: string): Found<{ code: number }>` | `Found<{ code: number }>` | exact integer match | requires kernels defining body names/IDs (commonly PCK/SPK and/or mission kernels); “not found” is reported via `found` output flag |
| `ids-names.bodc2n(code)` | `bodc2n_c` | `(code: number): Found<{ name: string }>` | `Found<{ name: string }>` | exact string match | requires kernels defining body names/IDs; “not found” is reported via `found` output flag |

---

## Domain: `frames` (`FramesApi`)

| domain.method | CSPICE entrypoint(s) | Args (TS shape) | Returns (TS shape) | Comparison notes (tolerance/normalization) | Statefulness / required kernels |
| --- | --- | --- | --- | --- | --- |
| `frames.namfrm(name)` | `namfrm_c` | `(name: string): Found<{ code: number }>` | `Found<{ code: number }>` | exact integer match | requires FK and/or built-in frame definitions; **CSPICE quirk:** `namfrm_c` returns `0` when not found (no `found` output), so backends must convert `0` → `{ found: false }` |
| `frames.frmnam(code)` | `frmnam_c` | `(code: number): Found<{ name: string }>` | `Found<{ name: string }>` | exact string match | requires FK and/or built-in frame definitions; “not found” is reported via `found` output flag |
| `frames.cidfrm(center)` | `cidfrm_c` | `(center: number): Found<{ frcode: number; frname: string }>` | `Found<{ frcode: number; frname: string }>` | exact integer/string match | requires kernels defining center→frame associations (FK / PCK / mission kernels); “not found” via `found` |
| `frames.cnmfrm(centerName)` | `cnmfrm_c` | `(centerName: string): Found<{ frcode: number; frname: string }>` | `Found<{ frcode: number; frname: string }>` | exact integer/string match | requires kernels defining name→center and center→frame associations; “not found” via `found` |
| `frames.ckgp(inst, sclkdp, tol, ref)` | `ckgp_c` | `(inst: number, sclkdp: number, tol: number, ref: string): Found<{ cmat: Mat3RowMajor; clkout: number }>` | `Found<{ cmat: Mat3RowMajor; clkout: number }>` | matrix element-wise float tolerance; `clkout` float tolerance | **stateful**: requires loaded CK (pointing) + SCLK (`*.tsc`); `ref` frame must be defined (FK); “not found” via `found` |
| `frames.ckgpav(inst, sclkdp, tol, ref)` | `ckgpav_c` | `(inst: number, sclkdp: number, tol: number, ref: string): Found<{ cmat: Mat3RowMajor; av: SpiceVector3; clkout: number }>` | `Found<{ cmat: Mat3RowMajor; av: SpiceVector3; clkout: number }>` | matrix/vector element-wise float tolerance | **stateful**: requires loaded CK + SCLK; `ref` frame must be defined; “not found” via `found` |
| `frames.pxform(from, to, et)` | `pxform_c` | `(from: string, to: string, et: number): Mat3RowMajor` | `Mat3RowMajor` | matrix element-wise float tolerance | **stateful**: depends on loaded frame definitions (FK, PCK, CK for dynamic frames) |
| `frames.sxform(from, to, et)` | `sxform_c` | `(from: string, to: string, et: number): SpiceMatrix6x6` | `SpiceMatrix6x6` | matrix element-wise float tolerance | **stateful**: depends on loaded frame definitions; may require CK for rotating frames |

Notes:

- Matrix outputs in this contract are encoded in **row-major** order (see `Mat3RowMajor` / `SpiceMatrix6x6`).

---

## Domain: `kernels` (`KernelsApi`)

| domain.method | CSPICE entrypoint(s) | Args (TS shape) | Returns (TS shape) | Comparison notes (tolerance/normalization) | Statefulness / required kernels |
| --- | --- | --- | --- | --- | --- |
| `kernels.furnsh(kernel)` | `furnsh_c` | `(kernel: KernelSource): void` | `void` | n/a | **stateful**: mutates kernel pool + loaded-kernel set; `KernelSource` may be a path or `{ path, bytes }` where backend writes bytes then furnshes the path |
| `kernels.unload(path)` | `unload_c` | `(path: string): void` | `void` | n/a | **stateful**: unloads a previously loaded kernel |
| `kernels.kclear()` | `kclear_c` | `(): void` | `void` | n/a | **stateful**: clears all loaded kernels and the kernel pool |
| `kernels.ktotal(kind?)` | `ktotal_c` | `(kind?: KernelKind): number` | `number` | exact integer match | **stateful**: returns count of currently loaded kernels (optionally filtered) |
| `kernels.kdata(which, kind?)` | `kdata_c` | `(which: number, kind?: KernelKind): Found<KernelData>` | `Found<KernelData>` | exact string/integer match | **stateful**: queries loaded-kernel table; returns `{ found: false }` when `which` is out of range for the selected kind |

---

## Domain: `error` (`ErrorApi`)

| domain.method | CSPICE entrypoint(s) | Args (TS shape) | Returns (TS shape) | Comparison notes (tolerance/normalization) | Statefulness / required kernels |
| --- | --- | --- | --- | --- | --- |
| `error.failed()` | `failed_c` | `(): boolean` | `boolean` | exact boolean | **stateful**: reflects the CSPICE error status flag |
| `error.reset()` | `reset_c` | `(): void` | `void` | n/a | **stateful**: clears the CSPICE error status and stored messages |
| `error.getmsg(which)` | `getmsg_c` | `(which: "SHORT" \| "LONG" \| "EXPLAIN"): string` | `string` | exact string match | **stateful**: reads CSPICE error message buffers |
| `error.setmsg(message)` | `setmsg_c` | `(message: string): void` | `void` | n/a | **stateful**: sets the long message text used by `sigerr` |
| `error.sigerr(short)` | `sigerr_c` | `(short: string): void` | `void` | n/a | **stateful**: signals an error; typically causes subsequent backend calls to throw unless reset |
| `error.chkin(name)` | `chkin_c` | `(name: string): void` | `void` | n/a | **stateful**: pushes `name` onto the SPICE traceback stack |
| `error.chkout(name)` | `chkout_c` | `(name: string): void` | `void` | n/a | **stateful**: pops `name` from the SPICE traceback stack |

---

## Domain: `ephemeris` (`EphemerisApi`)

| domain.method | CSPICE entrypoint(s) | Args (TS shape) | Returns (TS shape) | Comparison notes (tolerance/normalization) | Statefulness / required kernels |
| --- | --- | --- | --- | --- | --- |
| `ephemeris.spkezr(target, et, ref, abcorr, observer)` | `spkezr_c` | `(target: string, et: number, ref: string, abcorr: AbCorr \| string, observer: string): SpkezrResult` | `{ state: [x,y,z,vx,vy,vz], lt: number }` | float tolerance on each component + `lt` | **stateful**: requires SPK (`*.bsp`); may also require FK/PCK/CK depending on `ref`; aberration correction must match CSPICE `abcorr` parsing |
| `ephemeris.spkpos(target, et, ref, abcorr, observer)` | `spkpos_c` | `(target: string, et: number, ref: string, abcorr: AbCorr \| string, observer: string): SpkposResult` | `{ pos: [x,y,z], lt: number }` | float tolerance on each component + `lt` | **stateful**: requires SPK; may also require FK/PCK/CK depending on `ref` |

---

## Domain: `geometry` (`GeometryApi`)

| domain.method | CSPICE entrypoint(s) | Args (TS shape) | Returns (TS shape) | Comparison notes (tolerance/normalization) | Statefulness / required kernels |
| --- | --- | --- | --- | --- | --- |
| `geometry.subpnt(method, target, et, fixref, abcorr, observer)` | `subpnt_c` | `(method: string, target: string, et: number, fixref: string, abcorr: AbCorr \| string, observer: string): SubPointResult` | `{ spoint: SpiceVector3; trgepc: number; srfvec: SpiceVector3 }` | float tolerance on vectors + `trgepc` | **stateful**: requires SPK (observer/target positions) and body shape/frames (often PCK + FK); method choice may require additional kernels (e.g. DSK for high-res shapes) |
| `geometry.subslr(method, target, et, fixref, abcorr, observer)` | `subslr_c` | `(method: string, target: string, et: number, fixref: string, abcorr: AbCorr \| string, observer: string): SubPointResult` | `{ spoint: SpiceVector3; trgepc: number; srfvec: SpiceVector3 }` | float tolerance on vectors + `trgepc` | **stateful**: requires SPK + shape kernels (PCK/DSK) + frame kernels; includes Sun geometry (Sun must be available in loaded ephemerides) |
| `geometry.sincpt(method, target, et, fixref, abcorr, observer, dref, dvec)` | `sincpt_c` | `(method: string, target: string, et: number, fixref: string, abcorr: AbCorr \| string, observer: string, dref: string, dvec: SpiceVector3): Found<SubPointResult>` | `Found<SubPointResult>` | float tolerance on vectors + `trgepc` when found | **stateful**: requires SPK + shape kernels (PCK/DSK) + frame kernels; “not found” uses `found` output flag (ray misses target) |
| `geometry.ilumin(method, target, et, fixref, abcorr, observer, spoint)` | `ilumin_c` | `(method: string, target: string, et: number, fixref: string, abcorr: AbCorr \| string, observer: string, spoint: SpiceVector3): IluminResult` | `{ trgepc: number; srfvec: SpiceVector3; phase: number; incdnc: number; emissn: number }` | float tolerance on all fields | **stateful**: requires SPK + shape kernels (PCK/DSK) + frame kernels; angles are in radians |
| `geometry.occult(targ1, shape1, frame1, targ2, shape2, frame2, abcorr, observer, et)` | `occult_c` | `(targ1: string, shape1: string, frame1: string, targ2: string, shape2: string, frame2: string, abcorr: AbCorr \| string, observer: string, et: number): number` | `number` | exact integer match (occultation code) | **stateful**: requires SPK (all bodies) + shape kernels (PCK/DSK) + any referenced frames; output is an integer condition code defined by CSPICE `occult_c` |

---

## Domain: `coords-vectors` (`CoordsVectorsApi`)

Most routines in this domain are **pure math** and require no kernels.

| domain.method | CSPICE entrypoint(s) | Args (TS shape) | Returns (TS shape) | Comparison notes (tolerance/normalization) | Statefulness / required kernels |
| --- | --- | --- | --- | --- | --- |
| `coords-vectors.reclat(rect)` | `reclat_c` | `(rect: SpiceVector3)` | `{ radius: number; lon: number; lat: number }` | float tolerance; angles radians | none |
| `coords-vectors.latrec(radius, lon, lat)` | `latrec_c` | `(radius: number, lon: number, lat: number)` | `SpiceVector3` | float tolerance | none |
| `coords-vectors.recsph(rect)` | `recsph_c` | `(rect: SpiceVector3)` | `{ radius: number; colat: number; lon: number }` | float tolerance; angles radians | none |
| `coords-vectors.sphrec(radius, colat, lon)` | `sphrec_c` | `(radius: number, colat: number, lon: number)` | `SpiceVector3` | float tolerance | none |
| `coords-vectors.vnorm(v)` | `vnorm_c` | `(v: SpiceVector3)` | `number` | float tolerance | none |
| `coords-vectors.vhat(v)` | `vhat_c` | `(v: SpiceVector3)` | `SpiceVector3` | float tolerance | none; **zero-vector behavior:** returns `[0,0,0]` without throwing (matches `vhat_c`) |
| `coords-vectors.vdot(a, b)` | `vdot_c` | `(a: SpiceVector3, b: SpiceVector3)` | `number` | float tolerance | none |
| `coords-vectors.vcrss(a, b)` | `vcrss_c` | `(a: SpiceVector3, b: SpiceVector3)` | `SpiceVector3` | float tolerance | none |
| `coords-vectors.vadd(a, b)` | `vadd_c` | `(a: SpiceVector3, b: SpiceVector3)` | `SpiceVector3` | float tolerance | none |
| `coords-vectors.vsub(a, b)` | `vsub_c` | `(a: SpiceVector3, b: SpiceVector3)` | `SpiceVector3` | float tolerance | none |
| `coords-vectors.vminus(v)` | `vminus_c` | `(v: SpiceVector3)` | `SpiceVector3` | float tolerance | none |
| `coords-vectors.vscl(s, v)` | `vscl_c` | `(s: number, v: SpiceVector3)` | `SpiceVector3` | float tolerance | none |
| `coords-vectors.mxm(a, b)` | `mxm_c` | `(a: Mat3RowMajor, b: Mat3RowMajor)` | `Mat3RowMajor` | float tolerance | none |
| `coords-vectors.rotate(angle, axis)` | `rotate_c` | `(angle: number, axis: number)` | `Mat3RowMajor` | float tolerance; angle radians; axis ∈ {1,2,3} | none |
| `coords-vectors.rotmat(m, angle, axis)` | `rotmat_c` | `(m: Mat3RowMajor, angle: number, axis: number)` | `Mat3RowMajor` | float tolerance | none |
| `coords-vectors.axisar(axis, angle)` | `axisar_c` | `(axis: SpiceVector3, angle: number)` | `Mat3RowMajor` | float tolerance | none |
| `coords-vectors.georec(lon, lat, alt, re, f)` | `georec_c` | `(lon: number, lat: number, alt: number, re: number, f: number)` | `SpiceVector3` | float tolerance; angles radians | none |
| `coords-vectors.recgeo(rect, re, f)` | `recgeo_c` | `(rect: SpiceVector3, re: number, f: number)` | `{ lon: number; lat: number; alt: number }` | float tolerance; angles radians | none |
| `coords-vectors.mxv(m, v)` | `mxv_c` | `(m: Mat3RowMajor, v: SpiceVector3)` | `SpiceVector3` | float tolerance | none |
| `coords-vectors.mtxv(m, v)` | `mtxv_c` | `(m: Mat3RowMajor, v: SpiceVector3)` | `SpiceVector3` | float tolerance | none |
