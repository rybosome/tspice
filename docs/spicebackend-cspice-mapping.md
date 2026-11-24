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
- `strings`

> Note: This mapping is intended to be complete (method-level) for all domains listed here.
> Follow-up work is primarily around parity tests, fixtures for kernel-heavy routines (CK/FK/IK), and per-routine edge-case semantics.
>
> Recommended first parity-test targets (lowest fixture complexity): `time`, `ids-names`, `frames`. This is a prioritization hint only — not a statement about completeness of the other domains.

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
These tolerances are a reasonable _starting point_; tighten/loosen as needed for specific kernels and platforms.

- Pure math (coords/vectors): `atol = 1e-12`
- Frame transforms (pxform/sxform): `atol = 1e-12`
- Ephemeris/geometry vectors in km: `atol = 1e-9` km
- Epochs/light time in seconds: `atol = 1e-9` s

> Note: Element-wise `atol` is not always sufficient.
> For transforms (e.g. `pxform`/`sxform`), also check invariants like orthonormality (`R·Rᵀ ≈ I`) and `det(R) ≈ +1`.
> For ephemeris/geometry (`spkezr`/`spkpos`, etc.), tolerances may need to vary by `abcorr`, loaded kernels, and platform.

## Kernel fixtures present in this repo

These are useful when writing tests/fixtures for stateful routines (time conversions, ephemeris, body constants, etc.).

- LSK (leapseconds):
  - `packages/tspice/test/fixtures/kernels/naif0012.tls`
  - `packages/tspice/test/fixtures/kernels/basic-time/naif0012.tls`
- SCLK (spacecraft clock, text):
  - `packages/tspice/test/fixtures/kernels/cook_01.tsc`
- Meta-kernel placeholders:
  - `packages/backend-node/test/fixtures/minimal.tm`
  - `packages/backend-wasm/test/fixtures/minimal.tm`

For browser/demo-oriented PCK/SPK examples, see the standalone Orrery repo:
`https://github.com/rybosome/orrery/tree/main/public/kernels/naif`.

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

The additional clock methods use an explicit spacecraft ID and the existing
kernel lifecycle. `sce2t` converts ET to rounded, partition-aware encoded
ticks. The remaining methods format or parse raw clock fields or read the
partition table.

| Raw method                  | Scientific route                                               | Observable result                                                                                      |
| --------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `sce2t(sc, et)`             | Linked SPICELIB `sce2t_` with the public wrapper’s trace frame | Rounded encoded tick count as a number.                                                                |
| `scfmt(sc, ticks, clklen?)` | `scfmt_c`                                                      | Clock field string without a partition prefix. Optional capacity defaults to 2048 bytes including NUL. |
| `scpart(sc)`                | `scpart_c`                                                     | Owned `{pstart, pstop}` arrays, with every returned raw start and stop in original order.              |
| `sctiks(sc, clkstr)`        | `sctiks_c`                                                     | Raw tick count from a clock field string using the configured field moduli and offsets.                |

The `sce2t_` alias preserves the pinned implementation with defined storage
on early errors. Clock-field formatting also has a bounded numeric domain
derived from the implementation’s fixed field workspace.
[Clock semantics and reviewed source routes](step8-sclk-additions.md)

D01 adds five direct Node and WASM mappings in this domain. Signed capacities include the C terminator. CSPICE parser controls persist across calls. [Detailed civil-time semantics and evidence](step8-civil-time.md)

| Raw method | Canonical routine | Observable result                                                     |
| ---------- | ----------------- | --------------------------------------------------------------------- |
| `etcal`    | `etcal_c`         | Formal calendar string, including truncated and extreme-epoch outputs |
| `utc2et`   | `utc2et_c`        | ET from a legacy UTC string using loaded leap data                    |
| `tparch`   | `tparch_c`        | Persistent strict/permissive parsing setting                          |
| `tsetyr`   | `tsetyr_c`        | Persistent two-digit-year lower bound                                 |
| `et2lst`   | `et2lst_c`        | Local solar clock fields and both formatted time strings              |

| domain.method                       | CSPICE entrypoint(s)  | Args (TS shape)                                          | Returns (TS shape) | Comparison notes (tolerance/normalization)                                                                | Statefulness / required kernels                                                                                                       |
| ----------------------------------- | --------------------- | -------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `time.spiceVersion()`               | `tkvrsn_c("TOOLKIT")` | `(): string`                                             | `string`           | exact string match                                                                                        | none                                                                                                                                  |
| `time.tkvrsn(item)`                 | `tkvrsn_c`            | `(item: "TOOLKIT"): string`                              | `string`           | exact string match                                                                                        | none                                                                                                                                  |
| `time.spd()`                        | `spd_c`               | `()`                                                     | `number`           | 86400 seconds per nominal day; exact live constant comparison                                             | none; error-free                                                                                                                      |
| `time.j2000()`                      | `j2000_c`             | `()`                                                     | `number`           | 2451545.0 Julian days at J2000 (not ET seconds); exact live constant comparison                           | none; error-free                                                                                                                      |
| `time.j1900()`                      | `j1900_c`             | `()`                                                     | `number`           | 2415020.0 Julian days at J1900 (not ET seconds); exact live constant comparison                           | none; error-free                                                                                                                      |
| `time.b1950()`                      | `b1950_c`             | `()`                                                     | `number`           | 2433282.42345905 Julian days at B1950; retain fraction; exact live constant comparison                    | none; error-free                                                                                                                      |
| `time.str2et(time)`                 | `str2et_c`            | `(time: string): number`                                 | `number`           | floating compare (ET seconds)                                                                             | **stateful**: uses TIMDEF defaults (SYSTEM/CALENDAR/ZONE); requires LSK (`*.tls`); may depend on loaded time constants in kernel pool |
| `time.et2utc(et, format, prec)`     | `et2utc_c`            | `(et: number, format: string, prec: number): string`     | `string`           | exact string match (format-dependent)                                                                     | requires LSK (`*.tls`)                                                                                                                |
| `time.timout(et, picture)`          | `timout_c`            | `(et: number, picture: string): string`                  | `string`           | exact string match (picture-dependent)                                                                    | requires LSK (`*.tls`) for many pictures                                                                                              |
| `time.deltet(epoch, eptype)`        | `deltet_c`            | `(epoch: number, eptype: "ET"                            | "UTC"): number`    | `number`                                                                                                  | floating compare (seconds)                                                                                                            | requires LSK (`*.tls`) |
| `time.unitim(epoch, insys, outsys)` | `unitim_c`            | `(epoch: number, insys: string, outsys: string): number` | `number`           | floating compare (seconds)                                                                                | requires LSK (`*.tls`)                                                                                                                |
| `time.tparse(timstr)`               | `tparse_c`            | `(timstr: string): number`                               | `number`           | floating compare (UTC seconds past J2000; formal calendar / no leap seconds)                              | stateless; UTC-only (rejects time system/zone labels); no kernels                                                                     |
| `time.tpictr(sample, pictur)`       | `tpictr_c`            | `(sample: string, pictur: string): string`               | `string`           | exact string match                                                                                        | **stateful**: interprets sample using TIMDEF defaults; no kernels                                                                     |
| `time.timdef(action, item, value?)` | `timdef_c`            | overload: `("GET", item)` / `("SET", item, value)`       | `string` / `void`  | exact string match for `GET`                                                                              | stateful (mutates time conversion defaults); no kernels                                                                               |
| `time.scs2e(sc, sclkch)`            | `scs2e_c`             | `(sc: number, sclkch: string): number`                   | `number`           | floating compare (ET seconds)                                                                             | requires SCLK kernel (`*.tsc`) for `sc`; typically also needs LSK                                                                     |
| `time.sce2s(sc, et)`                | `sce2s_c`             | `(sc: number, et: number): string`                       | `string`           | exact string match                                                                                        | requires SCLK kernel (`*.tsc`) for `sc`; typically also needs LSK                                                                     |
| `time.scencd(sc, sclkch)`           | `scencd_c`            | `(sc: number, sclkch: string): number`                   | `number`           | floating compare (ticks)                                                                                  | requires SCLK kernel (`*.tsc`) for `sc`                                                                                               |
| `time.scdecd(sc, sclkdp)`           | `scdecd_c`            | `(sc: number, sclkdp: number): string`                   | `string`           | exact string match                                                                                        | requires SCLK kernel (`*.tsc`) for `sc`                                                                                               |
| `time.sct2e(sc, sclkdp)`            | `sct2e_c`             | `(sc: number, sclkdp: number): number`                   | `number`           | floating compare (ET seconds)                                                                             | requires SCLK kernel (`*.tsc`) for `sc`; often also needs LSK                                                                         |
| `time.sce2c(sc, et)`                | `sce2c_c`             | `(sc: number, et: number): number`                       | `number`           | floating compare (ticks)                                                                                  | requires SCLK kernel (`*.tsc`) for `sc`; often also needs LSK                                                                         |
| `time.b1900()`                      | `b1900_c`             | `()`                                                     | `number`           | 2415020.31352 Julian ephemeris days at Besselian epoch 1900.0; not ET seconds. Exact live comparison      | none; error-free                                                                                                                      |
| `time.j1950()`                      | `j1950_c`             | `()`                                                     | `number`           | 2433282.5 Julian days at Julian epoch 1950.0 (1950-01-01 midnight), not ET seconds. Exact live comparison | none; error-free                                                                                                                      |
| `time.j2100()`                      | `j2100_c`             | `()`                                                     | `number`           | 2488070.0 Julian days at Julian epoch 2100.0 (2100-01-01 noon), not ET seconds. Exact live comparison     | none; error-free                                                                                                                      |
| `time.jyear()`                      | `jyear_c`             | `()`                                                     | `number`           | 31557600 seconds per Julian year (365.25 days). Exact live comparison                                     | none; error-free                                                                                                                      |
| `time.tyear()`                      | `tyear_c`             | `()`                                                     | `number`           | 31556925.9747 seconds per tropical year, as fixed by CSPICE. Exact live comparison                        | none; error-free                                                                                                                      |

Notes:

- `spiceVersion()` is a convenience alias; the contract also exposes `tkvrsn("TOOLKIT")` explicitly.

- Many time routines (notably `str2et`, `timout`, and `tpictr`) depend on TIMDEF defaults (SYSTEM/CALENDAR/ZONE). These defaults are global mutable state in CSPICE; tests should snapshot/restore if they change them to avoid order dependence.

---

## Domain: `ids-names` (`IdsNamesApi`)

Surface translations use the current body-specific kernel pool mappings.
The optional output byte capacity includes the NUL terminator. It defaults
to 37. Both string-returning methods retain the name flag even when the
observable text is a truncated prefix or the decimal fallback.

| Raw call                        | Canonical routine | Observable output                                                               |
| ------------------------------- | ----------------- | ------------------------------------------------------------------------------- |
| `srfc2s(code, bodyId, srflen?)` | `srfc2s_c`        | `{surface, isName}` for a signed body ID.                                       |
| `srfcss(code, body, srflen?)`   | `srfcss_c`        | `{surface, isName}` for a body string.                                          |
| `srfs2c(surface, body)`         | `srfs2c_c`        | Discriminated found result with a code on success after body-string resolution. |
| `srfscc(surface, bodyId)`       | `srfscc_c`        | Discriminated found result with a code on success for a signed body ID.         |

The pinned surface hash imposes a bound on direct and pool-supplied surface
IDs. The parity workflows independently check the defined lookup results,
state changes, exact bytes and genuine malformed-map errors.
[Surface translations and signed hash limits](step8-surface-names.md)

| domain.method            | CSPICE entrypoint(s) | Args (TS shape)                           | Returns (TS shape)        | Comparison notes (tolerance/normalization) | Statefulness / required kernels                                                                                                     |
| ------------------------ | -------------------- | ----------------------------------------- | ------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `ids-names.bodn2c(name)` | `bodn2c_c`           | `(name: string): Found<{ code: number }>` | `Found<{ code: number }>` | exact integer match                        | requires kernels defining body names/IDs (commonly PCK/SPK and/or mission kernels); “not found” is reported via `found` output flag |
| `ids-names.bodc2n(code)` | `bodc2n_c`           | `(code: number): Found<{ name: string }>` | `Found<{ name: string }>` | exact string match                         | requires kernels defining body names/IDs; “not found” is reported via `found` output flag                                           |

---

## Domain: `frames` (`FramesApi`)

A15 extends the same frame domain as `pxform` and `sxform`. All nine methods accept readonly finite inputs and use kernel-independent algebra. State transforms are flat row-major 6×6 tuples. [Frame algebra and checked CSPICE error paths](step8-frame-algebra.md)

| Raw call                             | Successful CSPICE entry | Result                                      |
| ------------------------------------ | ----------------------- | ------------------------------------------- |
| `frame(x)`                           | `frame_c`               | {x,y,z} (three owned Vec3 tuples)           |
| `twovec(axdef,indexa,plndef,indexp)` | `twovec_c`              | Mat3RowMajor                                |
| `twovxf(axdef,indexa,plndef,indexp)` | `twovxf_c`              | SpiceMatrix6x6                              |
| `eul2xf(eulang,axisa,axisb,axisc)`   | `eul2xf_c`              | SpiceMatrix6x6                              |
| `xf2eul(xform,axisa,axisb,axisc)`    | `xf2eul_c`              | {eulang,unique} (six values plus a boolean) |
| `xf2rav(xform)`                      | `xf2rav_c`              | {rot,av} (Mat3RowMajor and Vec3)            |
| `rav2xf(rot,av)`                     | `rav2xf_c`              | SpiceMatrix6x6                              |
| `invstm(mat)`                        | `invstm_c`              | SpiceMatrix6x6                              |
| `xpose6(m1)`                         | `xpose6_c`              | SpiceMatrix6x6                              |

D03 maps six raw methods through their matching public C entry points. PXFRM2 preflights its two actual REFCHG legs before evaluating the two-epoch rotation. [Frame metadata and transformations](step8-frame-metadata.md)

| Raw method | CSPICE     | Result                                                                                                                                                              |
| ---------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bltfrm`   | `bltfrm_c` | Replace a live integer cell with all built-in IDs for class or −1. N0067 requires room for 145 including empty classes.                                             |
| `pxfrm2`   | `pxfrm2_c` | Evaluate orientation of two named frames at independently specified TDB epochs and return nine row-major components.                                                |
| `tipbod`   | `tipbod_c` | Rotate inertial positions into a body-fixed PCK class frame at ET, which is measured in TDB seconds past J2000.                                                     |
| `tisbod`   | `tisbod_c` | Return 36 row-major components transforming position/velocity, including the derivative per second.                                                                 |
| `tkfram`   | `tkfram_c` | Look up a TK class ID and publish rotation to the base frame and its numeric ID on a successful true flag.                                                          |
| `xfmsta`   | `xfmsta_c` | Transform position components and rates between six coordinate systems with km, radians and seconds, including kernel-dependent spheroid shape and longitude sense. |

[Binary PCK records, limits and independent observations](step8-pck-binary.md)

| Raw method | CSPICE     | Result or effect                                                                                                                                                             |
| ---------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pckcls`   | `pckcls_c` | Finalize a writer with at least one segment. Empty close reports NOSEGMENTSFOUND and the writer can be retried.                                                              |
| `pckcov`   | `pckcov_c` | Append the closed coverage intervals for a frame class ID to a live normalized window. An absent class leaves existing intervals intact.                                     |
| `pckfrm`   | `pckfrm_c` | Insert distinct frame class IDs into an existing sorted integer set.                                                                                                         |
| `pcklof`   | `pcklof_c` | Register a binary PCK with the low-level orientation search. A duplicate promotes priority and a single unload removes its search entry.                                     |
| `pckopn`   | `pckopn_c` | Create a binary PCK writer with a caller internal name and comment reservation; a virtual output becomes readable after close.                                               |
| `pckuof`   | `pckuof_c` | Unload the physical low-level PCK registration and restore eligible lower-priority data; a retired alias cannot affect a later generation.                                   |
| `pckw02`   | `pckw02_c` | Write consecutive equal-duration records with three Chebyshev Euler series per record, preserving descriptor trims, midpoint/radius, degree and trailer in the physical DAF. |

[Binary CK writer lifecycle and record formats](step8-ck-writers.md)

| Raw method | CSPICE    | Contract effect                                                                                                        |
| ---------- | --------- | ---------------------------------------------------------------------------------------------------------------------- |
| `ckopn`    | `ckopn_c` | Create an owned binary CK writer with a caller-specified internal name and comment reservation.                        |
| `ckcls`    | `ckcls_c` | Finalize the CK writer and allow readback. A NOSEGMENTSFOUND writer stays open and can be retried.                     |
| `ckw01`    | `ckw01_c` | Append discrete scalar-first quaternion samples and optional reference-frame angular velocities at encoded SCLK ticks. |
| `ckw02`    | `ckw02_c` | Append constant-angular-velocity intervals using individual start/stop times and seconds-per-tick rates.               |
| `ckw03`    | `ckw03_c` | Append interpolated quaternion samples and optional angular velocity with explicit interval breaks.                    |
| `ckw05`    | `ckw05_c` | Append one of four quaternion/derivative/AV packet subtypes with rate, polynomial window degree and interval starts.   |

[CK record and frame access](step8-ck-records.md)

| Raw method | CSPICE     | Contract effect                                                                                |
| ---------- | ---------- | ---------------------------------------------------------------------------------------------- |
| `ckfrot`   | `ckfrot_c` | Search in ET for zero-tolerance instrument-to-base rotation and reference frame ID.            |
| `ckfxfm`   | `ckfxfm_c` | Search AV-bearing segments for the instrument-to-base state transform and derivative at ET.    |
| `ckgr02`   | `ckgr02_c` | Read every field in a one-based type 2 interval including the stored seconds per tick.         |
| `ckgr03`   | `ckgr03_c` | Read a one-based tick and quaternion and return AV only when the descriptor declares it.       |
| `ckmeta`   | `ckmeta_c` | Resolve the selected SCLK or SPK ID with live pool overrides and signed conventional defaults. |
| `cknr02`   | `cknr02_c` | Read the number of constant-rate intervals in a genuine packed type 2 segment.                 |
| `cknr03`   | `cknr03_c` | Read the number of discrete pointing records across the interpolation intervals.               |

| domain.method                           | CSPICE entrypoint(s) | Args (TS shape)                                                                                                             | Returns (TS shape)                                                | Comparison notes (tolerance/normalization)                    | Statefulness / required kernels                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frames.namfrm(name)`                   | `namfrm_c`           | `(name: string): Found<{ code: number }>`                                                                                   | `Found<{ code: number }>`                                         | exact integer match                                           | requires FK and/or built-in frame definitions; per NAIF docs, `namfrm_c` returns the frame code, or `0` if `name` is not recognized (there is no `found` output). In this project `J2000` is code `1` (see tests), so treating `0` as “not found” is safe. If you want to avoid depending on the `0` sentinel, validate the returned code via `frinfo_c` (it provides a `found` flag). |
| `frames.frmnam(code)`                   | `frmnam_c`           | `(code: number): Found<{ name: string }>`                                                                                   | `Found<{ name: string }>`                                         | exact string match                                            | requires FK and/or built-in frame definitions; “not found” is reported via `found` output flag                                                                                                                                                                                                                                                                                         |
| `frames.cidfrm(center)`                 | `cidfrm_c`           | `(center: number): Found<{ frcode: number; frname: string }>`                                                               | `Found<{ frcode: number; frname: string }>`                       | exact integer/string match                                    | requires kernels defining center→frame associations (FK / PCK / mission kernels); “not found” via `found`                                                                                                                                                                                                                                                                              |
| `frames.cnmfrm(centerName)`             | `cnmfrm_c`           | `(centerName: string): Found<{ frcode: number; frname: string }>`                                                           | `Found<{ frcode: number; frname: string }>`                       | exact integer/string match                                    | requires kernels defining name→center and center→frame associations; “not found” via `found`                                                                                                                                                                                                                                                                                           |
| `frames.ckgp(inst, sclkdp, tol, ref)`   | `ckgp_c`             | `(inst: number, sclkdp: number, tol: number, ref: string): Found<{ cmat: Mat3RowMajor; clkout: number }>`                   | `Found<{ cmat: Mat3RowMajor; clkout: number }>`                   | matrix element-wise float tolerance; `clkout` float tolerance | **stateful**: requires loaded CK (pointing) + SCLK (`*.tsc`); `ref` frame must be defined (FK); “not found” via `found`                                                                                                                                                                                                                                                                |
| `frames.ckgpav(inst, sclkdp, tol, ref)` | `ckgpav_c`           | `(inst: number, sclkdp: number, tol: number, ref: string): Found<{ cmat: Mat3RowMajor; av: SpiceVector3; clkout: number }>` | `Found<{ cmat: Mat3RowMajor; av: SpiceVector3; clkout: number }>` | matrix/vector element-wise float tolerance                    | **stateful**: requires loaded CK + SCLK; `ref` frame must be defined; “not found” via `found`                                                                                                                                                                                                                                                                                          |
| `frames.pxform(from, to, et)`           | `pxform_c`           | `(from: string, to: string, et: number): Mat3RowMajor`                                                                      | `Mat3RowMajor`                                                    | matrix element-wise float tolerance                           | **stateful**: depends on loaded frame definitions (FK, PCK, CK for dynamic frames)                                                                                                                                                                                                                                                                                                     |
| `frames.sxform(from, to, et)`           | `sxform_c`           | `(from: string, to: string, et: number): SpiceMatrix6x6`                                                                    | `SpiceMatrix6x6`                                                  | matrix element-wise float tolerance                           | **stateful**: depends on loaded frame definitions; may require CK for rotating frames                                                                                                                                                                                                                                                                                                  |

Notes:

- Matrix outputs in this contract are encoded in **row-major** order (see `Mat3RowMajor` / `SpiceMatrix6x6`).

---

## Domain: `kernels` (`KernelsApi`)

| domain.method                   | CSPICE entrypoint(s) | Args (TS shape)                                              | Returns (TS shape)                    | Comparison notes (tolerance/normalization)                                                                                     | Statefulness / required kernels                                                                                                                            |
| ------------------------------- | -------------------- | ------------------------------------------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kernels.furnsh(kernel)`        | `furnsh_c`           | `(kernel: KernelSource): void`                               | `void`                                | n/a                                                                                                                            | **stateful**: mutates kernel pool + loaded-kernel set; `KernelSource` may be a path or `{ path, bytes }` where backend writes bytes then furnshes the path |
| `kernels.kplfrm(frmcls, idset)` | `kplfrm_c`           | `(frmcls: number, idset: SpiceIntCell): void`                | Replaces the caller-owned integer set | Compare complete frame-ID sets; `-1` selects all pool classes, class 1 is empty; invalid class and insufficient capacity throw | Kernel-pool frame specifications; actual shared C shim on Node and WASM, with per-module WASM handle ownership checks                                      |
| `kernels.unload(path)`          | `unload_c`           | `(path: string): void`                                       | `void`                                | n/a                                                                                                                            | **stateful**: unloads a previously loaded kernel                                                                                                           |
| `kernels.kclear()`              | `kclear_c`           | `(): void`                                                   | `void`                                | n/a                                                                                                                            | **stateful**: clears all loaded kernels and the kernel pool                                                                                                |
| `kernels.ktotal(kind?)`         | `ktotal_c`           | `(kind?: KernelKindInput): number`                           | `number`                              | exact integer match                                                                                                            | **stateful**: returns count of currently loaded kernels (optionally filtered)                                                                              |
| `kernels.kdata(which, kind?)`   | `kdata_c`            | `(which: number, kind?: KernelKindInput): Found<KernelData>` | `Found<KernelData>`                   | `filtyp` exact; path-like fields may require normalization (see Notes)                                                         | **stateful**: queries loaded-kernel table; returns `{ found: false }` when `which` is out of range for the selected kind                                   |

| `kernels.kinfo(path)` | `kinfo_c` (Node); `ktotal_c` + `kdata_c` cached table (WASM) | `(path: string)` | `Found<KernelInfo>` | type/source, handle zero/nonzero and within-backend handle correspondence | cache invalidated before load, unload and clear; empty/unknown paths miss |
| `kernels.kxtrct(keywd, terms, wordsq)` | `kxtrct_c` (Node); matching JavaScript implementation (WASM) | `(keywd: string, terms: readonly string[], wordsq: string)` | `Found<{ wordsq: string; substr: string }>` | compare both exact strings; only ASCII spaces delimit words | no kernels; ASCII-trim keyword/terminators, C-string NUL prefixes, <1 MiB UTF-8 input |

Notes:

- **Kind token normalization (`KernelKindInput`):** `kind` may be a single token, an array of tokens, or a whitespace-separated string (CSPICE-style). Tokens are trimmed + case-insensitive; duplicates are ignored (first-seen order preserved). If `ALL` is present alongside other tokens, it normalizes to `["ALL"]`. Invalid/empty tokens (including `[]`) throw `RangeError`.
- **TEXT subtype inference:** SPICE often reports text kernels with `filtyp: "TEXT"` even when they are logically `LSK`/`FK`/`IK`/`SCLK`. When subtypes are requested, backends infer the subtype best-effort from the `kernel.file` extension (e.g. `.tls`/`.lsk` → `LSK`). If `TEXT` is requested, subtype tokens are redundant (and may be ignored/canonicalized away).

- **Load/unload semantics:** every `furnsh` call adds a registration, including repeated byte-backed loads. One `unload` removes one reference; loading errors can leave partial pool assignments. Meta-kernel child paths must already exist in that backend's filesystem; byte loading does not rewrite child paths.
- **Audited metadata observations:** kernel parity preserves fixture-relative path hierarchy, source filenames and filtered ordering. Opaque binary handle integers are compared by zero/nonzero and `kinfo`/`kdata` correspondence within each runtime, since absolute handle values differ across processes. Supplemental live meta-kernel comparisons exercise child source attribution and cache invalidation across duplicate load/unload/clear. `kdata.which` rejects fractional/nonfinite/wrapped values before conversion; negative signed indices miss.
- **`kxtrct` oracle:** the locked SpiceyPy library's actual `kxtrct_c` buffers are read directly. SpiceyPy's convenience wrapper strips significant trailing whitespace and its oversized default NUL buffer changes Fortran word parsing, so it cannot observe these exact strings. No expected strings or parser substitute are used by the oracle; buffers use the actual UTF-8 C-string prefix length.

- **Global state + determinism:** `furnsh` mutates process-global CSPICE state (kernel pool + loaded-kernel table). Load order can affect results. For deterministic tests, prefer an explicit load order and call `kernels.kclear()` between tests/suites to avoid cross-test leakage.
- **`KernelSource` bytes safety:** when `KernelSource` is `{ path, bytes }`, backends should treat `path` as **untrusted** input. Write bytes only into a backend-controlled directory / virtual FS namespace, reject absolute paths and `..` segments, retain staged files through `unload()` because CSPICE may keep duplicate registrations or reread text kernels. Node reclaims its staging directory on `kclear()`; WASM retains virtual files for its backend lifetime.
- **`KernelSource.path` portability + `kdata()` observability:** `KernelSource` does **not** have a single portable path semantics across backends:
  - In Node, `furnsh(string)` is an OS filesystem path.
  - In WASM, `furnsh(string)` is typically a virtual WASM-FS path (commonly under `/kernels/...`).

  For cross-backend parity tests, prefer `furnsh({ path, bytes })` and treat `path` as a _virtual identifier_ (POSIX-style, normalized; no `..`, optional `/kernels/` prefix).
  Backends may rewrite this identifier to an internal storage path (temp files, virtual FS namespaces), but should do so deterministically and keep it observable:
  - `unload(path)` should accept the normalized virtual identifier (even if internally rewritten).
  - `kdata()` should return a stable identifier for byte-backed kernels (ideally the normalized virtual path), rather than leaking randomized temp-file paths that would break parity.

---

## Kernel-pool validation, loading and continued strings

| Raw method | Matching CSPICE routine | Result or effect                                                                                                                                                                          |
| ---------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `badkpv`   | `badkpv_c`              | Validate a pool variable’s type, comparison with expected dimension and dimension divisibility. A valid variable returns false. A failed check signals a toolkit error naming the caller. |
| `bodvcd`   | `bodvcd_c`              | Find the numeric pool constant BODY<id>_<item> by signed body ID, reporting its exact dimension and stored units.                                                                         |
| `bodvrd`   | `bodvrd_c`              | Resolve a body name or decimal ID string, then return owned ordered body-constant values and their actual dimension.                                                                      |
| `clpool`   | `clpool_c`              | Clear all kernel-pool variables and signal registered watchers while retaining KEEPER inventory.                                                                                          |
| `dvpool`   | `dvpool_c`              | Delete a named variable and notify its watchers when an existing variable is deleted.                                                                                                     |
| `ldpool`   | `ldpool_c`              | Load file-based text-kernel assignments directly into the pool, without KEEPER registration.                                                                                              |
| `lmpool`   | `lmpool_c`              | Load ordered text-kernel records through the canonical rectangular C buffer.                                                                                                              |
| `stpool`   | `stpool_c`              | Fetch a continued logical string by zero-based ordinal, carrying the exact C text and pre-truncation size in bytes, or found false.                                                       |
| `szpool`   | `szpool_c`              | Read a named implementation limit as a found integer, preserving legitimate absent names.                                                                                                 |

The public contract and batch review describe native and WASM buffer limits, file staging, error precedence, source-derived guards and independent oracle routes. [Kernel-pool review](step8-kernel-pool.md)

## Domain: `error` (`ErrorApi`)

GET/SET error policy and permanent trace disabling are direct toolkit operations with process/module lifetime. [Diagnostic devices, print masks and trace state](step8-error-devices.md)

| Raw method | CSPICE     | Effect                                                                                                                              |
| ---------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `errdev`   | `errdev_c` | Get/set caller-owned diagnostic device names. Preserve byte truncation and real file creation, scoped to host or module filesystem. |
| `errprt`   | `errprt_c` | Apply ordered message selections, observing accumulated state, reset tokens and complete returned ordered mask.                     |
| `trcoff`   | `trcoff_c` | Irreversibly disable traceback collection and clear its current stack in the toolkit instance.                                      |

The following direct operations extend the original error API. [Prepared and frozen diagnostic state](step8-error-observation.md)

| Raw method | CSPICE     | Effect                                                                                                                                                                               |
| ---------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `errch`    | `errch_c`  | Replace the leftmost nonblank marker in the prepared long diagnostic with a character field. Blank replacement inserts one space, and the toolkit applies its 1840-byte field width. |
| `errdp`    | `errdp_c`  | Substitute a finite double into the prepared message with the exact N0067 14-significant-digit diagnostic rendering.                                                                 |
| `errint`   | `errint_c` | Substitute a signed SpiceInt into the prepared message, including both endpoints and zero.                                                                                           |
| `qcktrc`   | `qcktrc_c` | Observe the printable current traceback, or the frozen traceback while an error is pending. Explicit byte capacity includes NUL.                                                     |
| `return`   | `return_c` | Read the immediate-return indicator. With the backend’s RETURN action it is true exactly while failure is pending.                                                                   |
| `trcdep`   | `trcdep_c` | Read the logical depth of the current or frozen traceback, including overflow entries beyond the 100 stored names.                                                                   |
| `trcnam`   | `trcnam_c` | Read one zero-based module name, bounded by caller byte capacity. Observe legitimate overflow placeholders and genuine index and capacity errors.                                    |

| domain.method           | CSPICE entrypoint(s) | Args (TS shape)                                   | Returns (TS shape) | Comparison notes (tolerance/normalization) | Statefulness / required kernels                                                                                                                                            |
| ----------------------- | -------------------- | ------------------------------------------------- | ------------------ | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `error.failed()`        | `failed_c`           | `(): boolean`                                     | `boolean`          | exact boolean                              | **stateful**: reflects the CSPICE error status flag                                                                                                                        |
| `error.reset()`         | `reset_c`            | `(): void`                                        | `void`             | n/a                                        | **stateful**: clears the CSPICE error status and stored messages                                                                                                           |
| `error.getmsg(which)`   | `getmsg_c`           | `(which: "SHORT" \| "LONG" \| "EXPLAIN"): string` | `string`           | exact string match                         | **stateful**: reads CSPICE error message buffers                                                                                                                           |
| `error.setmsg(message)` | `setmsg_c`           | `(message: string): void`                         | `void`             | n/a                                        | **stateful**: sets the long message text used by `sigerr`                                                                                                                  |
| `error.sigerr(short)`   | `sigerr_c`           | `(short: string): void`                           | `void`             | n/a                                        | **stateful**: signals an error; tspice backends configure CSPICE to `RETURN` and surface this as a thrown JS/TS error (capture + reset CSPICE error state before throwing) |
| `error.chkin(name)`     | `chkin_c`            | `(name: string): void`                            | `void`             | n/a                                        | **stateful**: pushes `name` onto the SPICE traceback stack                                                                                                                 |
| `error.chkout(name)`    | `chkout_c`           | `(name: string): void`                            | `void`             | n/a                                        | **stateful**: pops `name` from the SPICE traceback stack                                                                                                                   |

Notes:

- **Project convention:** tspice backends configure CSPICE error handling to be deterministic (`erract_c("SET", 0, "RETURN")`, `errprt_c("SET", 0, "NONE")`, or equivalent). Backend domain methods then translate CSPICE failures into thrown JS/TS errors.
- **`setmsg` + `sigerr`:** `setmsg(long)` sets the long message used by the next `sigerr(short)`. In Node/WASM backends, `sigerr()` is expected to throw and the backend will capture + reset CSPICE error state so subsequent calls are not poisoned.
- **Message/trace evidence:** leading blanks in LONG messages are significant and preserved. The audit compares actual captured short/long/trace fields and post-signal recovery; void push/pop results alone do not establish traceback effects. The internal parity capture option catches the actual raw signal, while the oracle explicitly resets after capturing to model the shared shim policy. Neither path substitutes for the raw operation.

---

## Domain: `ephemeris` (`EphemerisApi`)

E01 uses five direct orbit calculations on both backends. All are kernel-independent. [Detailed shapes, units and source-backed numerical conventions](step8-orbital-elements.md)

| Raw method | CSPICE     | Return                                                                       |
| ---------- | ---------- | ---------------------------------------------------------------------------- |
| `conics`   | `conics_c` | Six-component inertial state from conic elements and ET                      |
| `eqncpv`   | `eqncpv_c` | Six-component inertial state for equinoctial elements and the specified pole |
| `oscelt`   | `oscelt_c` | Eight classical osculating elements at the supplied epoch                    |
| `oscltx`   | `oscltx_c` | Eleven defined N0067 fields from a 20-word ABI buffer                        |
| `prop2b`   | `prop2b_c` | Six-component inertial state propagated over signed elapsed seconds          |

| Raw method                  | Canonical scientific call | Result and state                                                                                 |
| --------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------ |
| `getelm(firstYear, lines)`  | `getelm_c`                | TDB epoch and ten canonical elements from two owned ASCII rows; UTC conversion requires an LSK.  |
| `evsgp4(et, geophs, elems)` | `evsgp4_c`                | Six TEME components (km and km/s); the initializer converts the element epoch with a loaded LSK. |

The raw adapters retain complete numeric outputs and toolkit errors. The shared shim bounds signed calendar-day arithmetic and checks the pinned resonance classification only for exceptionally long evaluation intervals. [Two-line element contracts and evidence](step8-tle-propagation.md)

| domain.method                                         | CSPICE entrypoint(s) | Args (TS shape)                                                                                       | Returns (TS shape)                        | Comparison notes (tolerance/normalization) | Statefulness / required kernels                                                                                                               |
| ----------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `ephemeris.spkezr(target, et, ref, abcorr, observer)` | `spkezr_c`           | `(target: string, et: number, ref: string, abcorr: AbCorr \| string, observer: string): SpkezrResult` | `{ state: [x,y,z,vx,vy,vz], lt: number }` | float tolerance on each component + `lt`   | **stateful**: requires SPK (`*.bsp`); may also require FK/PCK/CK depending on `ref`; aberration correction must match CSPICE `abcorr` parsing |
| `ephemeris.spkpos(target, et, ref, abcorr, observer)` | `spkpos_c`           | `(target: string, et: number, ref: string, abcorr: AbCorr \| string, observer: string): SpkposResult` | `{ pos: [x,y,z], lt: number }`            | float tolerance on each component + `lt`   | **stateful**: requires SPK; may also require FK/PCK/CK depending on `ref`                                                                     |

---

## Domain: `geometry` (`GeometryApi`)

| domain.method                                                                         | CSPICE entrypoint(s) | Args (TS shape)                                                                                                                                                     | Returns (TS shape)                                                                        | Comparison notes (tolerance/normalization)       | Statefulness / required kernels                                                                                                                                            |
| ------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `geometry.subpnt(method, target, et, fixref, abcorr, observer)`                       | `subpnt_c`           | `(method: string, target: string, et: number, fixref: string, abcorr: AbCorr \| string, observer: string): SubPointResult`                                          | `{ spoint: SpiceVector3; trgepc: number; srfvec: SpiceVector3 }`                          | float tolerance on vectors + `trgepc`            | **stateful**: requires SPK (observer/target positions) and body shape/frames (often PCK + FK); method choice may require additional kernels (e.g. DSK for high-res shapes) |
| `geometry.subslr(method, target, et, fixref, abcorr, observer)`                       | `subslr_c`           | `(method: string, target: string, et: number, fixref: string, abcorr: AbCorr \| string, observer: string): SubPointResult`                                          | `{ spoint: SpiceVector3; trgepc: number; srfvec: SpiceVector3 }`                          | float tolerance on vectors + `trgepc`            | **stateful**: requires SPK + shape kernels (PCK/DSK) + frame kernels; includes Sun geometry (Sun must be available in loaded ephemerides)                                  |
| `geometry.sincpt(method, target, et, fixref, abcorr, observer, dref, dvec)`           | `sincpt_c`           | `(method: string, target: string, et: number, fixref: string, abcorr: AbCorr \| string, observer: string, dref: string, dvec: SpiceVector3): Found<SubPointResult>` | `Found<SubPointResult>`                                                                   | float tolerance on vectors + `trgepc` when found | **stateful**: requires SPK + shape kernels (PCK/DSK) + frame kernels; “not found” uses `found` output flag (ray misses target)                                             |
| `geometry.ilumin(method, target, et, fixref, abcorr, observer, spoint)`               | `ilumin_c`           | `(method: string, target: string, et: number, fixref: string, abcorr: AbCorr \| string, observer: string, spoint: SpiceVector3): IluminResult`                      | `{ trgepc: number; srfvec: SpiceVector3; phase: number; incdnc: number; emissn: number }` | float tolerance on all fields                    | **stateful**: requires SPK + shape kernels (PCK/DSK) + frame kernels; angles are in radians                                                                                |
| `geometry.occult(targ1, shape1, frame1, targ2, shape2, frame2, abcorr, observer, et)` | `occult_c`           | `(targ1: string, shape1: string, frame1: string, targ2: string, shape2: string, frame2: string, abcorr: AbCorr \| string, observer: string, et: number): number`    | `number`                                                                                  | exact integer match (occultation code)           | **stateful**: requires SPK (all bodies) + shape kernels (PCK/DSK) + any referenced frames; output is an integer condition code defined by CSPICE `occult_c`                |

---

## Domain: `strings` (`StringsApi`)

Each operation is available as a flat raw method on Node and WASM. Complete
well-formed UTF-8 inputs may include whitespace and an initial BOM. Text
arguments reject embedded NUL. Single-byte delimiter and wildcard arguments
accept ASCII including the NUL scalar. All rows use authored text fixtures.
[Byte semantics and independent oracle](step8-string-transforms.md)

| Raw method                                                         | Canonical routine | Complete result                                                            |
| ------------------------------------------------------------------ | ----------------- | -------------------------------------------------------------------------- |
| `cmprss(delim: string, n: number, input: string, lenout?: number)` | `cmprss_c`        | Compressed string. Capacity includes the terminator, minimum 1.            |
| `eqstr(a: string, b: string)`                                      | `eqstr_c`         | Exact boolean for whitespace-insensitive, ASCII case-insensitive equality. |
| `iswhsp(input: string)`                                            | `iswhsp_c`        | Exact boolean for C whitespace or an empty input.                          |
| `lastnb(input: string)`                                            | `lastnb_c`        | Zero-based last non-space byte index or −1.                                |
| `lcase(input: string, lenout?: number)`                            | `lcase_c`         | ASCII-lowercased string. Capacity includes the terminator, minimum 2.      |
| `ucase(input: string, lenout?: number)`                            | `ucase_c`         | ASCII-uppercased string. Capacity includes the terminator, minimum 2.      |
| `matchi(input: string, templ: string, wstr: string, wchr: string)` | `matchi_c`        | Exact boolean for an ASCII case-insensitive, byte-oriented wildcard match. |
| `matchw(input: string, templ: string, wstr: string, wchr: string)` | `matchw_c`        | Exact boolean for a case-sensitive, byte-oriented wildcard match.          |
| `cpos(text, chars, start)`                                         | `cpos_c`          | First matching byte from the inclusive start, or −1.                       |
| `cposr(text, chars, start)`                                        | `cposr_c`         | Last matching byte through the inclusive start, or −1.                     |
| `ncpos(text, chars, start)`                                        | `ncpos_c`         | First byte outside the set from the inclusive start, or −1.                |
| `ncposr(text, chars, start)`                                       | `ncposr_c`        | Last byte outside the set through the inclusive start, or −1.              |
| `pos(text, substr, start)`                                         | `pos_c`           | First exact substring start, or −1.                                        |
| `posr(text, substr, start)`                                        | `posr_c`          | Last exact substring start, or −1.                                         |
| `esrchc(value, values)`                                            | `esrchc_c`        | First equivalent row, or −1.                                               |

All six position results use UTF-8 byte indices. ESRCHC returns an array index
and applies the whitespace and ASCII-case rules of EQSTR to each terminated
row. The independent oracle exercises empty, all-empty, ASCII and multibyte rows.
[Byte positions, signed bounds and row ABI](step8-string-search.md)

### Tokenization and lexical spans

All nine methods dispatch through their same-named CSPICE routine. A20 reuses
the A18 string validation and strict byte decoding on both real backends.

| Raw method | CSPICE     | Complete public result                                                     |
| ---------- | ---------- | -------------------------------------------------------------------------- |
| `nextwd`   | `nextwd_c` | Next word and left-justified remainder, with independent capacities        |
| `nthwd`    | `nthwd_c`  | Word and zero-based UTF-8 start location                                   |
| `lparse`   | `lparse_c` | Item count and ordered rows using one delimiter byte                       |
| `lparsm`   | `lparsm_c` | Item count and ordered rows using a delimiter byte set                     |
| `lx4dec`   | `lx4dec_c` | Inclusive last byte and character count of a decimal mantissa              |
| `lx4num`   | `lx4num_c` | Inclusive last byte and character count of a number with optional exponent |
| `lx4sgn`   | `lx4sgn_c` | Inclusive last byte and character count of an optionally signed integer    |
| `lx4uns`   | `lx4uns_c` | Inclusive last byte and character count of unsigned digits                 |
| `lxqstr`   | `lxqstr_c` | Inclusive last byte and character count of a quoted token                  |

The independent oracle retains byte capacities, complete UTF-8 text, signed
miss positions and the toolkit's separate decimal location/count fields.
[Bounds, oracle adaptations and scientific observations](step8-string-tokenization.md)

## Domain: `coords-vectors` (`CoordsVectorsApi`)

Array-storage methods operate on initialized owned copies and return the full
destination, including the untouched suffix. All array inputs are readonly
`number[]` and every result is an independently owned `number[]`.
[Canonical array-storage semantics](step8-array-storage.md)

| Raw method                       | Canonical routine | Complete result                                                                 |
| -------------------------------- | ----------------- | ------------------------------------------------------------------------------- |
| `clearc(ndim,arrlen,bytes)`      | `clearc_c`        | Flat bytes, with cleared rows padded with ASCII spaces and terminated with NUL. |
| `cleard(ndim,values)`            | `cleard_c`        | Doubles with the requested prefix set to positive zero.                         |
| `cleari(ndim,values)`            | `cleari_c`        | Signed 32-bit integers with the requested prefix set to zero.                   |
| `filld(value,ndim,values)`       | `filld_c`         | Doubles with the requested prefix set to the supplied double.                   |
| `filli(value,ndim,values)`       | `filli_c`         | Signed 32-bit integers with the requested prefix set to the supplied integer.   |
| `moved(source,ndim,destination)` | `moved_c`         | Complete destination with the nonnegative copied prefix from source.            |

`rotate` and `rotmat` preserve CSPICE's modulo-three axis mapping (including zero/negative integers); their typed adapters reject fractional, non-finite, or overflowing JS axes before conversion. Matrices are row-major. `rotate`/`rotmat` use passive coordinate rotation, while `axisar` returns an active vector rotation. The audit includes noncommuting matrix products, both vector multiplication directions, coordinate poles/zero inputs, and oblate/prolate geodetic conversions.

Most routines in this domain are **pure math** and require no kernels.

The seven rotation conversions use finite row-major `Mat3RowMajor`
inputs, radian angles, numbered axes and scalar-first SPICE quaternions.

| Raw call                                             | Scientific route                                  | Result                                                      |
| ---------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------- |
| `eul2m(angle3, angle2, angle1, axis3, axis2, axis1)` | Traced SPICELIB `eul2m_` with initialized storage | Owned row-major matrix.                                     |
| `m2eul(m, axis3, axis2, axis1)`                      | `m2eul_c`                                         | `{angle3, angle2, angle1}`.                                 |
| `m2q(m)`                                             | `m2q_c`                                           | Owned scalar-first quaternion.                              |
| `q2m(q)`                                             | `q2m_c`                                           | Owned row-major matrix, including exceptional IEEE entries. |
| `qxq(q1, q2)`                                        | `qxq_c`                                           | Owned Hamilton product in input order.                      |
| `qdq2av(q, dq)`                                      | `qdq2av_c`                                        | Angular velocity vector.                                    |
| `raxisa(m)`                                          | `raxisa_c`                                        | `{axis, angle}` with radians.                               |

The lower-level Euler entrypoint preserves the original scientific
implementation and public trace on success and error. See the source
review for orientation, singular angle selection and exceptional values.
[Rotation representation review](step8-rotation-representations.md)

The fixed-matrix additions use the existing flat, readonly `Mat3RowMajor`
input shape. `diags2` directly consumes flat 2x2 tuples in
`[m00,m01,m10,m11]` order and returns both matrices in that order. Every returned
matrix owns its storage. Backend results retain numeric `NaN` and infinities;
the finite-only matrix input validators still reject those values if reused as
input. `invert`, `invort`, and `isrot` preserve their distinct CSPICE threshold,
column-scaling, and tolerance semantics.

The following eight methods accept a key and a readonly array. Each returns a physical zero-based index or −1. CSPICE performs the search after both adapters validate and snapshot the arguments. [Search domain, indices and verified examples](step8-array-search.md)

| Raw method                   | Canonical routine | Search order                                             |
| ---------------------------- | ----------------- | -------------------------------------------------------- |
| `bschoc(key, values, order)` | `bschoc_c`        | Nondecreasing order given by the zero-based permutation. |
| `bschoi(key, values, order)` | `bschoi_c`        | Nondecreasing order given by the zero-based permutation. |
| `bsrchc(key, values)`        | `bsrchc_c`        | Nondecreasing physical order.                            |
| `bsrchd(key, values)`        | `bsrchd_c`        | Nondecreasing physical order.                            |
| `bsrchi(key, values)`        | `bsrchi_c`        | Nondecreasing physical order.                            |
| `isrchc(key, values)`        | `isrchc_c`        | Physical order, first matching entry.                    |
| `isrchd(key, values)`        | `isrchd_c`        | Physical order, first matching entry.                    |
| `isrchi(key, values)`        | `isrchi_c`        | Physical order, first matching entry.                    |

Each sorted-boundary method accepts a key and a readonly array of the same
element type. It returns the zero-based index of the last qualifying entry
or −1. The caller supplies the values in nondecreasing order.
[Character layout and exact index semantics](step8-sorted-bounds.md)

| Raw method                                       | Canonical routine | Qualifying relation                                 |
| ------------------------------------------------ | ----------------- | --------------------------------------------------- |
| `lstlec(key: string, values: readonly string[])` | `lstlec_c`        | Blank-extended byte comparison, less than or equal. |
| `lstled(key: number, values: readonly number[])` | `lstled_c`        | Ordered double, less than or equal.                 |
| `lstlei(key: number, values: readonly number[])` | `lstlei_c`        | Signed 32-bit integer, less than or equal.          |
| `lstltc(key: string, values: readonly string[])` | `lstltc_c`        | Blank-extended byte comparison, strictly less than. |
| `lstltd(key: number, values: readonly number[])` | `lstltd_c`        | Ordered double, strictly less than.                 |
| `lstlti(key: number, values: readonly number[])` | `lstlti_c`        | Signed 32-bit integer, strictly less than.          |

All eleven array-ordering methods use the canonical routine in both backends. The public arrays are readonly inputs and each returned array is owned. [Ordering and permutation details](step8-array-order.md)

| Raw method              | Canonical routine | Returned result                             |
| ----------------------- | ----------------- | ------------------------------------------- |
| `isordv(order)`         | `isordv_c`        | Boolean permutation predicate.              |
| `orderc(values)`        | `orderc_c`        | Array of zero-based source indices.         |
| `orderd(values)`        | `orderd_c`        | Array of zero-based source indices.         |
| `orderi(values)`        | `orderi_c`        | Array of zero-based source indices.         |
| `reordc(order, values)` | `reordc_c`        | Values in the specified source-index order. |
| `reordd(order, values)` | `reordd_c`        | Values in the specified source-index order. |
| `reordi(order, values)` | `reordi_c`        | Values in the specified source-index order. |
| `reordl(order, values)` | `reordl_c`        | Values in the specified source-index order. |
| `shellc(values)`        | `shellc_c`        | Sorted values.                              |
| `shelld(values)`        | `shelld_c`        | Sorted values.                              |
| `shelli(values)`        | `shelli_c`        | Sorted values.                              |

| domain.method                                         | CSPICE entrypoint(s) | Args (TS shape)                                                                                                         | Returns (TS shape)                                                                     | Comparison notes (tolerance/normalization)                                                                                                                                       | Statefulness / required kernels                                                                        |
| ----------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `coords-vectors.pi()`                                 | `pi_c`               | `()`                                                                                                                    | `number`                                                                               | pi radians; exact live constant comparison                                                                                                                                       | none; error-free                                                                                       |
| `coords-vectors.twopi()`                              | `twopi_c`            | `()`                                                                                                                    | `number`                                                                               | 2 pi radians; exact live constant comparison                                                                                                                                     | none; error-free                                                                                       |
| `coords-vectors.halfpi()`                             | `halfpi_c`           | `()`                                                                                                                    | `number`                                                                               | pi/2 radians; exact live constant comparison                                                                                                                                     | none; error-free                                                                                       |
| `coords-vectors.dpr()`                                | `dpr_c`              | `()`                                                                                                                    | `number`                                                                               | degrees per radian; exact live constant comparison                                                                                                                               | none; error-free                                                                                       |
| `coords-vectors.rpd()`                                | `rpd_c`              | `()`                                                                                                                    | `number`                                                                               | radians per degree; exact live constant comparison                                                                                                                               | none; error-free                                                                                       |
| `coords-vectors.reclat(rect)`                         | `reclat_c`           | `(rect: SpiceVector3)`                                                                                                  | `{ radius: number; lon: number; lat: number }`                                         | float tolerance; angles radians                                                                                                                                                  | none                                                                                                   |
| `coords-vectors.latrec(radius, lon, lat)`             | `latrec_c`           | `(radius: number, lon: number, lat: number)`                                                                            | `SpiceVector3`                                                                         | float tolerance                                                                                                                                                                  | none                                                                                                   |
| `coords-vectors.recsph(rect)`                         | `recsph_c`           | `(rect: SpiceVector3)`                                                                                                  | `{ radius: number; colat: number; lon: number }`                                       | float tolerance; angles radians                                                                                                                                                  | none                                                                                                   |
| `coords-vectors.sphrec(radius, colat, lon)`           | `sphrec_c`           | `(radius: number, colat: number, lon: number)`                                                                          | `SpiceVector3`                                                                         | float tolerance                                                                                                                                                                  | none                                                                                                   |
| `coords-vectors.vnorm(v)`                             | `vnorm_c`            | `(v: SpiceVector3)`                                                                                                     | `number`                                                                               | float tolerance                                                                                                                                                                  | none                                                                                                   |
| `coords-vectors.vhat(v)`                              | `vhat_c`             | `(v: SpiceVector3)`                                                                                                     | `SpiceVector3`                                                                         | float tolerance                                                                                                                                                                  | none; **zero-vector behavior:** returns `[0,0,0]` without throwing (matches `vhat_c`)                  |
| `coords-vectors.vdot(a, b)`                           | `vdot_c`             | `(a: SpiceVector3, b: SpiceVector3)`                                                                                    | `number`                                                                               | float tolerance                                                                                                                                                                  | none                                                                                                   |
| `coords-vectors.vcrss(a, b)`                          | `vcrss_c`            | `(a: SpiceVector3, b: SpiceVector3)`                                                                                    | `SpiceVector3`                                                                         | float tolerance                                                                                                                                                                  | none                                                                                                   |
| `coords-vectors.vadd(a, b)`                           | `vadd_c`             | `(a: SpiceVector3, b: SpiceVector3)`                                                                                    | `SpiceVector3`                                                                         | float tolerance                                                                                                                                                                  | none                                                                                                   |
| `coords-vectors.vsub(a, b)`                           | `vsub_c`             | `(a: SpiceVector3, b: SpiceVector3)`                                                                                    | `SpiceVector3`                                                                         | float tolerance                                                                                                                                                                  | none                                                                                                   |
| `coords-vectors.vminus(v)`                            | `vminus_c`           | `(v: SpiceVector3)`                                                                                                     | `SpiceVector3`                                                                         | float tolerance                                                                                                                                                                  | none                                                                                                   |
| `coords-vectors.vscl(s, v)`                           | `vscl_c`             | `(s: number, v: SpiceVector3)`                                                                                          | `SpiceVector3`                                                                         | float tolerance                                                                                                                                                                  | none                                                                                                   |
| `coords-vectors.mxm(a, b)`                            | `mxm_c`              | `(a: Mat3RowMajor, b: Mat3RowMajor)`                                                                                    | `Mat3RowMajor`                                                                         | float tolerance                                                                                                                                                                  | none                                                                                                   |
| `coords-vectors.rotate(angle, axis)`                  | `rotate_c`           | `(angle: number, axis: number)`                                                                                         | `Mat3RowMajor`                                                                         | float tolerance; angle radians; axis ∈ {1,2,3}                                                                                                                                   | none                                                                                                   |
| `coords-vectors.rotmat(m, angle, axis)`               | `rotmat_c`           | `(m: Mat3RowMajor, angle: number, axis: number)`                                                                        | `Mat3RowMajor`                                                                         | float tolerance                                                                                                                                                                  | none                                                                                                   |
| `coords-vectors.axisar(axis, angle)`                  | `axisar_c`           | `(axis: SpiceVector3, angle: number)`                                                                                   | `Mat3RowMajor`                                                                         | float tolerance                                                                                                                                                                  | none                                                                                                   |
| `coords-vectors.georec(lon, lat, alt, re, f)`         | `georec_c`           | `(lon: number, lat: number, alt: number, re: number, f: number)`                                                        | `SpiceVector3`                                                                         | float tolerance; angles radians                                                                                                                                                  | none                                                                                                   |
| `coords-vectors.recgeo(rect, re, f)`                  | `recgeo_c`           | `(rect: SpiceVector3, re: number, f: number)`                                                                           | `{ lon: number; lat: number; alt: number }`                                            | float tolerance; angles radians                                                                                                                                                  | none                                                                                                   |
| `coords-vectors.mxv(m, v)`                            | `mxv_c`              | `(m: Mat3RowMajor, v: SpiceVector3)`                                                                                    | `SpiceVector3`                                                                         | float tolerance                                                                                                                                                                  | none                                                                                                   |
| `coords-vectors.mtxv(m, v)`                           | `mtxv_c`             | `(m: Mat3RowMajor, v: SpiceVector3)`                                                                                    | `SpiceVector3`                                                                         | float tolerance                                                                                                                                                                  | none                                                                                                   |
| `coords-vectors.clight()`                             | `clight_c`           | `()`                                                                                                                    | `number`                                                                               | 299792.458 kilometers per second for vacuum light speed. Exact live comparison                                                                                                   | none; error-free                                                                                       |
| `coords-vectors.dpmax()`                              | `dpmax_c`            | `()`                                                                                                                    | `number`                                                                               | DBL_MAX: greatest finite double, 1.7976931348623157e308 for supported IEEE-754 targets. Exact live comparison                                                                    | none; error-free                                                                                       |
| `coords-vectors.dpmin()`                              | `dpmin_c`            | `()`                                                                                                                    | `number`                                                                               | -DBL_MAX: most negative finite double, not the smallest positive or normal/subnormal value. Exact live comparison                                                                | none; error-free                                                                                       |
| `coords-vectors.intmax()`                             | `intmax_c`           | `()`                                                                                                                    | `number`                                                                               | maximum SpiceInt value, 2147483647 for the supported signed32 toolkit ABI. Exact live comparison                                                                                 | none; error-free                                                                                       |
| `coords-vectors.intmin()`                             | `intmin_c`           | `()`                                                                                                                    | `number`                                                                               | minimum SpiceInt value, -2147483648 for the supported signed32 toolkit ABI. Exact live comparison                                                                                | none; error-free                                                                                       |
| `coords-vectors.cyllat`                               | `cyllat_c`           | See typed contract                                                                                                      | three named scalar fields                                                              | Cylindrical (radius,lon,z) to latitudinal {radius,lon,lat}; preserves input longitude and uses atan2(z,radius), allowing nonstandard latitude for negative radius.               | none; error-free                                                                                       |
| `coords-vectors.cylrec`                               | `cylrec_c`           | See typed contract                                                                                                      | `SpiceVector3`                                                                         | Cylindrical (radius,lon,z) to Cartesian [x,y,z]; preserves signs and does not normalize input angle/radius.                                                                      | none; error-free                                                                                       |
| `coords-vectors.cylsph`                               | `cylsph_c`           | See typed contract                                                                                                      | three named scalar fields                                                              | Cylindrical (radius,lon,z) to spherical {radius,colat,lon}; preserves longitude and uses atan2(radius,z), including negative colatitude.                                         | none; error-free                                                                                       |
| `coords-vectors.latcyl`                               | `latcyl_c`           | See typed contract                                                                                                      | three named scalar fields                                                              | Latitudinal (radius,lon,lat) to cylindrical {radius,lon,z}; longitude passes through, cylindrical radius may be negative for unrestricted latitude/radius.                       | none; error-free                                                                                       |
| `coords-vectors.latsph`                               | `latsph_c`           | See typed contract                                                                                                      | three named scalar fields                                                              | Latitudinal (radius,lon,lat) to spherical {radius,colat,lon}; colat=pi/2-lat with radius and longitude unchanged.                                                                | none; error-free                                                                                       |
| `coords-vectors.reccyl`                               | `reccyl_c`           | See typed contract                                                                                                      | three named scalar fields                                                              | Readonly Cartesian three-vector to cylindrical {radius,lon,z}; nonnegative radius, longitude in [0,2pi] with zero on the axis, z unchanged.                                      | none; error-free                                                                                       |
| `coords-vectors.sphcyl`                               | `sphcyl_c`           | See typed contract                                                                                                      | three named scalar fields                                                              | Spherical (radius,colat,lon) to cylindrical {radius,lon,z}; preserves longitude and unrestricted signs/angles.                                                                   | none; error-free                                                                                       |
| `coords-vectors.sphlat`                               | `sphlat_c`           | See typed contract                                                                                                      | three named scalar fields                                                              | Spherical (radius,colat,lon) to latitudinal {radius,lon,lat}; lat=pi/2-colat with radius and longitude unchanged.                                                                | none; error-free                                                                                       |
| `coords-vectors.vdist(a, b)`                          | `vdist_c`            | `(a: Readonly<SpiceVector3>, b: Readonly<SpiceVector3>)`                                                                | `number`                                                                               | Euclidean distance in input units; preserve nonfinite overflow results                                                                                                           | none                                                                                                   |
| `coords-vectors.vequ(v)`                              | `vequ_c`             | `(v: Readonly<SpiceVector3>)`                                                                                           | `SpiceVector3`                                                                         | exact component copy; signed zero checked separately                                                                                                                             | none                                                                                                   |
| `coords-vectors.vpack(x, y, z)`                       | `vpack_c`            | `(x: number, y: number, z: number)`                                                                                     | `SpiceVector3`                                                                         | exact component order and values; owned tuple                                                                                                                                    | none                                                                                                   |
| `coords-vectors.vupack(v)`                            | `vupack_c`           | `(v: Readonly<SpiceVector3>)`                                                                                           | `{ x: number; y: number; z: number }`                                                  | exact component values in named fields                                                                                                                                           | none                                                                                                   |
| `coords-vectors.vzero(v)`                             | `vzero_c`            | `(v: Readonly<SpiceVector3>)`                                                                                           | `boolean`                                                                              | exact zero predicate; signed zeros true, nonzero subnormals false                                                                                                                | none                                                                                                   |
| `coords-vectors.unorm(v)`                             | `unorm_c`            | `(v: Readonly<SpiceVector3>)`                                                                                           | `{ unit: SpiceVector3; norm: number }`                                                 | all four fields; dimensionless unit and norm in input units; zero input returns zeros                                                                                            | none                                                                                                   |
| `coords-vectors.ucrss(a, b)`                          | `ucrss_c`            | `(a: Readonly<SpiceVector3>, b: Readonly<SpiceVector3>)`                                                                | `SpiceVector3`                                                                         | dimensionless normalized cross product; operand order controls handedness; conditioning caveat above                                                                             | none                                                                                                   |
| `coords-vectors.vsep(a, b)`                           | `vsep_c`             | `(a: Readonly<SpiceVector3>, b: Readonly<SpiceVector3>)`                                                                | `number`                                                                               | radians in `[0, pi]` for ordinary inputs; zero input gives zero; inputs share a frame                                                                                            | none                                                                                                   |
| `coords-vectors.vlcom(a, v1, b, v2)`                  | `vlcom_c`            | `(a: number, v1: Readonly<SpiceVector3>, b: number, v2: Readonly<SpiceVector3>)`                                        | `SpiceVector3`                                                                         | all components of `a*v1 + b*v2`; preserve numeric limits                                                                                                                         | none                                                                                                   |
| `coords-vectors.vlcom3(a, v1, b, v2, c, v3)`          | `vlcom3_c`           | `(a: number, v1: Readonly<SpiceVector3>, b: number, v2: Readonly<SpiceVector3>, c: number, v3: Readonly<SpiceVector3>)` | `SpiceVector3`                                                                         | all components; alternate coefficients and vectors in argument order                                                                                                             | none                                                                                                   |
| `coords-vectors.vperp(a, b)`                          | `vperp_c`            | `(a: Readonly<SpiceVector3>, b: Readonly<SpiceVector3>)`                                                                | `SpiceVector3`                                                                         | component of `a` perpendicular to `b`; pinned N0067 returns zero if either input is zero                                                                                         | none; inputs share a frame                                                                             |
| `coords-vectors.vproj(a, b)`                          | `vproj_c`            | `(a: Readonly<SpiceVector3>, b: Readonly<SpiceVector3>)`                                                                | `SpiceVector3`                                                                         | projection of `a` onto `b`; zero input gives zero output                                                                                                                         | none; inputs share a frame                                                                             |
| `coords-vectors.vrel(a, b)`                           | `vrel_c`             | `(a: Readonly<SpiceVector3>, b: Readonly<SpiceVector3>)`                                                                | `number`                                                                               | dimensionless `norm(a-b)/max(norm(a),norm(b))`; equal vectors give zero; preserve nonfinite limits                                                                               | none; inputs share a frame                                                                             |
| `coords-vectors.vrotv(v, axis, theta)`                | `vrotv_c`            | `(v: Readonly<SpiceVector3>, axis: Readonly<SpiceVector3>, theta: number)`                                              | `SpiceVector3`                                                                         | active right-handed rotation in radians; zero axis copies `v`                                                                                                                    | none                                                                                                   |
| `coords-vectors.rotvec(v, angle, axis)`               | `rotvec_c`           | `(v: Readonly<SpiceVector3>, angle: number, axis: number)`                                                              | `SpiceVector3`                                                                         | passive coordinate rotation in radians; signed 32-bit integer axes reduced modulo three                                                                                          | none                                                                                                   |
| `coords-vectors.vtmv(v1, matrix, v2)`                 | `vtmv_c`             | `(v1: Readonly<SpiceVector3>, matrix: Mat3RowMajor, v2: Readonly<SpiceVector3>)`                                        | `number`                                                                               | `transpose(v1)*matrix*v2`; nonsymmetric row-major matrix distinguishes transpose/order errors                                                                                    | none                                                                                                   |
| `coords-vectors.azlrec(range, az, el, azccw, elplsz)` | `azlrec_c`           | `(range: number, az: number, el: number, azccw: boolean, elplsz: boolean)`                                              | `SpiceVector3`                                                                         | Independent direction flags; radians; negative range/unwrapped angles retained                                                                                                   | none                                                                                                   |
| `coords-vectors.recazl(rect, azccw, elplsz)`          | `recazl_c`           | `(rect: Readonly<SpiceVector3>, azccw: boolean, elplsz: boolean)`                                                       | `{ range: number; az: number; el: number }`                                            | All fields; azimuth [0,2*pi], elevation [-pi/2,pi/2]; overflow retained                                                                                                          | none                                                                                                   |
| `coords-vectors.pgrrec(body, lon, lat, alt, re, f)`   | `pgrrec_c`           | `(body: string, lon: number, lat: number, alt: number, re: number, f: number)`                                          | `SpiceVector3`                                                                         | Body name/ID unchanged, NUL rejected; re>0/f<1; negative f allowed                                                                                                               | Current longitude override or PM data; Earth defaults east without PM; Moon/Sun require PM or override |
| `coords-vectors.recpgr(body, rect, re, f)`            | `recpgr_c`           | `(body: string, rect: Readonly<SpiceVector3>, re: number, f: number)`                                                   | `{ lon: number; lat: number; alt: number }`                                            | All fields; longitude [0,2*pi]; latitude [-pi/2,pi/2]; actual scientific errors                                                                                                  | Same planetographic pool conventions as pgrrec                                                         |
| `coords-vectors.radrec(range, ra, dec)`               | `radrec_c`           | `(range: number, ra: number, dec: number)`                                                                              | `SpiceVector3`                                                                         | RA eastward/declination northward, radians; no input angle normalization                                                                                                         | none                                                                                                   |
| `coords-vectors.recrad(rect)`                         | `recrad_c`           | `(rect: Readonly<SpiceVector3>)`                                                                                        | `{ range: number; ra: number; dec: number }`                                           | All fields; RA [0,2*pi], declination [-pi/2,pi/2]; explicit zero/pole conventions                                                                                                | none                                                                                                   |
| `coords-vectors.srfrec(body, lon, lat)`               | `srfrec_c`           | `(body: number, lon: number, lat: number)`                                                                              | `SpiceVector3`                                                                         | Signed32 body; east-positive, planetocentric angles; no PM convention                                                                                                            | Current numeric BODY<ID>_RADII: exactly three positive axes                                            |
| `coords-vectors.brcktd(value, end1, end2)`            | `brcktd_c`           | `(value: number, end1: number, end2: number)`                                                                           | `number`                                                                               | Closed interval; either endpoint order; exact selection/signed zero retained                                                                                                     | none                                                                                                   |
| `coords-vectors.brckti(value, end1, end2)`            | `brckti_c`           | `(value: number, end1: number, end2: number)`                                                                           | `number`                                                                               | Every input/output signed32; exact interval selection                                                                                                                            | none                                                                                                   |
| `coords-vectors.convrt(value, inUnit, outUnit)`       | `convrt_c`           | `(value: number, inUnit: string, outUnit: string)`                                                                      | `number`                                                                               | Pinned angle/distance/time table; unchanged strings, NUL rejected; documented overflow restriction                                                                               | none                                                                                                   |
| `coords-vectors.sumad(values)`                        | `sumad_c`            | `(values: readonly number[])`                                                                                           | `number`                                                                               | Ordered finite-input double sum; zero for empty; IEEE result retained                                                                                                            | none; signed32 length and WASM 256 MiB input-buffer cap                                                |
| `coords-vectors.sumai(values)`                        | `sumai_c`            | `(values: readonly number[])`                                                                                           | `number`                                                                               | Signed32 elements and every prefix; unsafe prefixes rejected before C, safe result is actual C output                                                                            | none; signed32 length and WASM 256 MiB input-buffer cap                                                |
| `coords-vectors.maxd(values)`                         | `maxd_c`             | `(values: readonly number[])`                                                                                           | `number`                                                                               | Actual variadic maximum of 0..30 finite doubles; empty zero                                                                                                                      | none                                                                                                   |
| `coords-vectors.maxi(values)`                         | `maxi_c`             | `(values: readonly number[])`                                                                                           | `number`                                                                               | Actual variadic maximum of 0..30 signed32 integers; empty zero                                                                                                                   | none                                                                                                   |
| `coords-vectors.mind(values)`                         | `mind_c`             | `(values: readonly number[])`                                                                                           | `number`                                                                               | Actual variadic minimum of 0..30 finite doubles; empty zero                                                                                                                      | none                                                                                                   |
| `coords-vectors.mini(values)`                         | `mini_c`             | `(values: readonly number[])`                                                                                           | `number`                                                                               | Actual variadic minimum of 0..30 signed32 integers; empty zero                                                                                                                   | none                                                                                                   |
| `coords-vectors.ducrss(a, b)`                         | `ducrss_c`           | `(a: Readonly<SpiceStateVector>, b: Readonly<SpiceStateVector>)`                                                        | `SpiceStateVector`                                                                     | Unit cross plus derivative; pinned whole-state scaling determines zero-cross derivative. Caller avoids intermediate overflow.                                                    | Kernel-free; common frame/derivative parameter; dvsep requires common observer/epoch.                  |
| `coords-vectors.dvcrss(a, b)`                         | `dvcrss_c`           | `(a: Readonly<SpiceStateVector>, b: Readonly<SpiceStateVector>)`                                                        | `SpiceStateVector`                                                                     | Position cross and both derivative terms; retain all six components and operand order.                                                                                           | Kernel-free; common frame/derivative parameter; dvsep requires common observer/epoch.                  |
| `coords-vectors.dvdot(a, b)`                          | `dvdot_c`            | `(a: Readonly<SpiceStateVector>, b: Readonly<SpiceStateVector>)`                                                        | `number`                                                                               | Derivative of position dot; caller avoids intermediate overflow; not a six-dimensional dot.                                                                                      | Kernel-free; common frame/derivative parameter; dvsep requires common observer/epoch.                  |
| `coords-vectors.dvhat(state)`                         | `dvhat_c`            | `(state: Readonly<SpiceStateVector>)`                                                                                   | `SpiceStateVector`                                                                     | Unit position and derivative; computed zero position norm copies input derivative unchanged.                                                                                     | Kernel-free; common frame/derivative parameter; dvsep requires common observer/epoch.                  |
| `coords-vectors.dvnorm(state)`                        | `dvnorm_c`           | `(state: Readonly<SpiceStateVector>)`                                                                                   | `number`                                                                               | Norm derivative; computed zero position norm returns zero.                                                                                                                       | Kernel-free; common frame/derivative parameter; dvsep requires common observer/epoch.                  |
| `coords-vectors.dvsep(a, b)`                          | `dvsep_c`            | `(a: Readonly<SpiceStateVector>, b: Readonly<SpiceStateVector>)`                                                        | `number`                                                                               | Angular-separation derivative; exact computed cross zero returns zero. Guarded underflow returns zero; genuine numeric errors propagate. Non-axis singular conditioning applies. | Kernel-free; common frame/derivative parameter; dvsep requires common observer/epoch.                  |
| `coords-vectors.chbder`                               | `chbder_c`           | `(cp: readonly number[], x2s: readonly [number,number], x: number, nderiv: number)`                                     | `number[]`                                                                             | Degree cp.length−1; full Chebyshev coefficients; value then x-derivatives; order0..715827881; internal workspace.                                                                | Kernel-free authored coefficients; no retained resources.                                              |
| `coords-vectors.chbigr`                               | `chbigr_c`           | `(cp: readonly number[], x2s: readonly [number,number], x: number)`                                                     | `{p:number,itgrlp:number}`                                                             | Integral in x, zero at midpoint; empty cp actual INVALIDDEGREE, nonpositive radius actual INVALIDRADIUS.                                                                         | Kernel-free authored coefficients; no retained resources.                                              |
| `coords-vectors.chbint`                               | `chbint_c`           | `(cp: readonly number[], x2s: readonly [number,number], x: number)`                                                     | `{p:number,dpdx:number}`                                                               | Value and x-derivative, both observed; degree inferred from nonempty full coefficient array.                                                                                     | Kernel-free authored coefficients; no retained resources.                                              |
| `coords-vectors.chbval`                               | `chbval_c`           | `(cp: readonly number[], x2s: readonly [number,number], x: number)`                                                     | `number`                                                                               | Value of first-kind Chebyshev expansion; coefficient0 is not halved; nonempty full coefficient array.                                                                            | Kernel-free authored coefficients; no retained resources.                                              |
| `coords-vectors.polyds`                               | `polyds_c`           | `(coeffs: readonly number[], nderiv: number, t: number)`                                                                | `number[]`                                                                             | Ascending ordinary powers; order then derivative array; empty coefficients yield zeros for nonnegative order; negative order actual no-write returns[].                          | Kernel-free authored coefficients; no retained resources.                                              |
| `coords-vectors.rquad`                                | `rquad_c`            | `(a:number, b:number, c:number)`                                                                                        | `{root1:[number,number],root2:[number,number]}`                                        | Both real/imaginary pairs in actual formula order; linear repeats root; a=b=0 actual DEGENERATECASE; no sorting.                                                                 | Kernel-free authored coefficients; no retained resources.                                              |
| `coords-vectors.hrmesp`                               | `hrmesp_c`           | `(first:number, step:number, yvals:readonly number[], x:number)`                                                        | `{f:number,df:number}`                                                                 | Interleaved value/abscissa-derivative pairs at first+i*step; inferred n; negative step valid, zero actual INVALIDSTEPSIZE.                                                       | Kernel-free authored samples; no retained scientific resources.                                        |
| `coords-vectors.hrmint`                               | `hrmint_c`           | `(xvals:readonly number[], yvals:readonly number[], x:number)`                                                          | `{f:number,df:number}`                                                                 | n nodes/2n interleaved value-derivative entries; preserve point order; repeated nodes actual DIVIDEBYZERO.                                                                       | Kernel-free authored samples; no retained scientific resources.                                        |
| `coords-vectors.lgresp`                               | `lgresp_c`           | `(first:number, step:number, yvals:readonly number[], x:number)`                                                        | `number`                                                                               | One value per equally spaced node; negative step valid, zero actual INVALIDSTEPSIZE.                                                                                             | Kernel-free authored samples; no retained scientific resources.                                        |
| `coords-vectors.lgrind`                               | `lgrind_c`           | `(xvals:readonly number[], yvals:readonly number[], x:number)`                                                          | `{p:number,dp:number}`                                                                 | Equal-length increasing distinct nodes/values; both value and abscissa derivative; repeated nodes actual DIVIDEBYZERO.                                                           | Kernel-free authored samples; no retained scientific resources.                                        |
| `coords-vectors.lgrint`                               | `lgrint_c`           | `(xvals:readonly number[], yvals:readonly number[], x:number)`                                                          | `number`                                                                               | Equal-length increasing distinct nodes/values; preserve actual scalar recurrence; repeated nodes actual DIVIDEBYZERO.                                                            | Kernel-free authored samples; no retained scientific resources.                                        |
| `coords-vectors.qderiv`                               | `qderiv_c`           | `(f0:readonly number[], f2:readonly number[], delta:number)`                                                            | `number[]`                                                                             | Equal positive dimensions; delta is half endpoint separation; zero actual DIVIDEBYZERO, empty rejected by documented domain; owned full vector.                                  | Kernel-free authored samples; no retained scientific resources.                                        |
| `coords-vectors.det(m)`                               | `det_c`              | `(m: Mat3RowMajor)`                                                                                                     | `number`                                                                               | determinant with CSPICE overflow/underflow behavior                                                                                                                              | none                                                                                                   |
| `coords-vectors.diags2(symmat)`                       | `diags2_c`           | `(symmat: readonly [number, number, number, number])`                                                                   | `{ diag: [number, number, number, number]; rotate: [number, number, number, number] }` | all eight output entries; lower-left input ignored; preserve chosen eigenvalue order and rotation signs                                                                          | none                                                                                                   |
| `coords-vectors.ident()`                              | `ident_c`            | `()`                                                                                                                    | `Mat3RowMajor`                                                                         | exact 3x3 identity; independent storage                                                                                                                                          | none                                                                                                   |
| `coords-vectors.invert(m)`                            | `invert_c`           | `(m: Mat3RowMajor)`                                                                                                     | `Mat3RowMajor`                                                                         | pinned `abs(det(m)) < 1e-16` returns zeros; other numeric results preserved                                                                                                      | none; small determinant is a success, not a SPICE error                                                |
| `coords-vectors.invort(m)`                            | `invort_c`           | `(m: Mat3RowMajor)`                                                                                                     | `Mat3RowMajor`                                                                         | transpose, then divide each row by the original column's squared norm; orthogonality is not checked                                                                              | none; `ZEROLENGTHCOLUMN` / `COLUMNTOOSMALL` are SPICE errors                                           |
| `coords-vectors.isrot(m, ntol, dtol)`                 | `isrot_c`            | `(m: Mat3RowMajor, ntol: number, dtol: number)`                                                                         | `boolean`                                                                              | exact boolean; inclusive column-norm and unitized-determinant tolerances                                                                                                         | none; negative tolerance signals `VALUEOUTOFRANGE`                                                     |
| `coords-vectors.mequ(m)`                              | `mequ_c`             | `(m: Mat3RowMajor)`                                                                                                     | `Mat3RowMajor`                                                                         | exact component copy; signed zero checked separately                                                                                                                             | none                                                                                                   |
| `coords-vectors.mtxm(a, b)`                           | `mtxm_c`             | `(a: Mat3RowMajor, b: Mat3RowMajor)`                                                                                    | `Mat3RowMajor`                                                                         | all nine entries of `transpose(a) * b`; nonsymmetric operands distinguish order                                                                                                  | none                                                                                                   |
| `coords-vectors.mxmt(a, b)`                           | `mxmt_c`             | `(a: Mat3RowMajor, b: Mat3RowMajor)`                                                                                    | `Mat3RowMajor`                                                                         | all nine entries of `a * transpose(b)`; nonsymmetric operands distinguish order                                                                                                  | none                                                                                                   |
| `coords-vectors.trace(m)`                             | `trace_c`            | `(m: Mat3RowMajor)`                                                                                                     | `number`                                                                               | sum of diagonal entries; preserve numeric overflow and cancellation                                                                                                              | none                                                                                                   |
| `coords-vectors.xpose(m)`                             | `xpose_c`            | `(m: Mat3RowMajor)`                                                                                                     | `Mat3RowMajor`                                                                         | all nine entries in transposed positions; owned output                                                                                                                           | none                                                                                                   |
| `coords-vectors.vaddg(a, b)`                          | `vaddg_c`            | `(a: readonly number[], b: readonly number[])`                                                                          | `number[]`                                                                             | Component sum; all positions; empty []                                                                                                                                           | none; signed32 dimension, WASM 256 MiB per vector buffer                                               |
| `coords-vectors.vdistg(a, b)`                         | `vdistg_c`           | `(a: readonly number[], b: readonly number[])`                                                                          | `number`                                                                               | Scaled Euclidean distance; subtraction/final overflow retained; empty zero                                                                                                       | none; signed32 dimension, WASM 256 MiB per vector buffer                                               |
| `coords-vectors.vdotg(a, b)`                          | `vdotg_c`            | `(a: readonly number[], b: readonly number[])`                                                                          | `number`                                                                               | Ordered dot product; empty zero                                                                                                                                                  | none; signed32 dimension, WASM 256 MiB per vector buffer                                               |
| `coords-vectors.vequg(v)`                             | `vequg_c`            | `(v: readonly number[])`                                                                                                | `number[]`                                                                             | Owned exact copy, signed zero retained; empty []                                                                                                                                 | none; signed32 dimension, WASM 256 MiB per vector buffer                                               |
| `coords-vectors.vhatg(v)`                             | `vhatg_c`            | `(v: readonly number[])`                                                                                                | `number[]`                                                                             | Normalize by computed norm; zero input returns zero vector; empty []                                                                                                             | none; signed32 dimension, WASM 256 MiB per vector buffer                                               |
| `coords-vectors.vlcomg(a, v1, b, v2)`                 | `vlcomg_c`           | `(a: number, v1: readonly number[], b: number, v2: readonly number[])`                                                  | `number[]`                                                                             | a*v1+b*v2, inferred C dimension first; empty []                                                                                                                                  | none; signed32 dimension, WASM 256 MiB per vector buffer                                               |
| `coords-vectors.vminug(v)`                            | `vminug_c`           | `(v: readonly number[])`                                                                                                | `number[]`                                                                             | Component negation and zero signs; empty []                                                                                                                                      | none; signed32 dimension, WASM 256 MiB per vector buffer                                               |
| `coords-vectors.vnormg(v)`                            | `vnormg_c`           | `(v: readonly number[])`                                                                                                | `number`                                                                               | Scaled norm, final overflow retained; zero/empty zero                                                                                                                            | none; signed32 dimension, WASM 256 MiB per vector buffer                                               |
| `coords-vectors.vprojg(a, b)`                         | `vprojg_c`           | `(a: readonly number[], b: readonly number[])`                                                                          | `number[]`                                                                             | dot(a,b)/dot(b,b) times b; zero denominator gives zero scale; max dimension 2147483646                                                                                           | none; signed32 dimension, WASM 256 MiB per vector buffer                                               |
| `coords-vectors.vrelg(a, b)`                          | `vrelg_c`            | `(a: readonly number[], b: readonly number[])`                                                                          | `number`                                                                               | Distance/max norm, equal/empty zero; no result clamp                                                                                                                             | none; signed32 dimension, WASM 256 MiB per vector buffer                                               |
| `coords-vectors.vsclg(s, v)`                          | `vsclg_c`            | `(s: number, v: readonly number[])`                                                                                     | `number[]`                                                                             | Finite scalar multiplication, numerical/zero-sign limits retained; empty []                                                                                                      | none; signed32 dimension, WASM 256 MiB per vector buffer                                               |
| `coords-vectors.vsepg(a, b)`                          | `vsepg_c`            | `(a: readonly number[], b: readonly number[])`                                                                          | `number`                                                                               | Radians; zero norm gives zero; raw dot/reciprocal limits retained                                                                                                                | none; signed32 dimension, WASM 256 MiB per vector buffer                                               |
| `coords-vectors.vsubg(a, b)`                          | `vsubg_c`            | `(a: readonly number[], b: readonly number[])`                                                                          | `number[]`                                                                             | Ordered a-b; all positions; empty []                                                                                                                                             | none; signed32 dimension, WASM 256 MiB per vector buffer                                               |
| `coords-vectors.vzerog(v)`                            | `vzerog_c`           | `(v: readonly number[])`                                                                                                | `boolean`                                                                              | Exact all-zero for nonempty vector; empty false                                                                                                                                  | none; signed32 dimension, WASM 256 MiB per vector buffer                                               |
| `coords-vectors.unormg(v)`                            | `unormg_c`           | `(v: readonly number[])`                                                                                                | `{ unit: number[]; norm: number }`                                                     | Both actual outputs; empty {unit:[],norm:0}; max dimension 2147483646                                                                                                            | none; signed32 dimension, WASM 256 MiB per vector buffer                                               |

### Character list parsing

`raw.lparss(list, delims, set)` calls `lparss_c` on the live caller-owned character set. [Byte widths, empty-list insertion and partial mutation](step8-string-set.md)

### Cell backing bounds

`ssize`, `valid`, and `wnvald` may change logical sizes only within the originally allocated cell capacity. The shared registry retains that original bound independently of mutable descriptors; requests beyond it throw before CSPICE runs. NAIF documents that CSPICE cannot detect an oversized backing declaration. `ssize` clears cardinality; `valid` sorts/deduplicates stored elements; `wnvald` sorts/merges endpoint pairs. The audit compares these observable effects and uses safe direct regressions for allocation-precondition violations rather than asking SpiceyPy to access invalid storage.

### Opaque cell identity

WASM cells/windows use host-issued opaque integer tokens above the uint32 range, with private token-to-pointer maps scoped to each module. Tokens are never reused within that host realm. Pointer reuse therefore cannot revive a freed handle or alias another live WASM instance. All raw cell/window consumers resolve tokens at the compiled boundary, including kplfrm, SPK/CK coverage/object queries, DSK object/surface queries, GF searches and progress-reporter initialization. Preserve the complete numeric handle and keep it with its owning process/module; handles are not portable across isolated workers or processes.

### File handle ownership

File APIs expose backend-owned opaque `SpiceHandle` tokens, not portable CSPICE
handle numbers. Within one host realm, the shared issuer prevents tokens from
separate registry/backend instances or WASM cells/windows from colliding. Each
registry checks its own live token and expected file kind before invoking the
compiled operation; a successful close invalidates the token, and a failed
native close retains it for cleanup retry. The alias `dlacls` retains the same
DAS/DLA ownership checks as `dascls`. File/EK/ephemeris semantic audit status is
tracked separately from this shared ownership prerequisite.

### Opaque SPK descriptor preservation

`spkpds` and `spkuds` use the actual compiled raw path on both backends. Their
five-word public readonly tuple is unchanged. The last three double words encode
six signed integers; a valid negative body/center pair can have a NaN bit pattern.
The Node private binding uses typed buffers, shared runtime helpers retain exact
byte copies behind returned tuples, and WASM copies descriptor bytes rather than
performing floating-point conversions. The existing RPC value codec carries this
opaque storage with a descriptor-specific typed encoding through structured clone.
Ordinary numerical arrays retain their existing representation. Callers should
retain returned descriptors or unpack fields before JSON/numeric reconstruction.

Registered packing comparisons expose both time bounds and all six integer fields;
subnormal/NaN words are never judged through a numeric tolerance. `descrId` lets an
unpack workflow consume the actual pack result, including a NaN payload that JSON
input cannot directly express. Literal signed IDs/frame/type/DAF addresses and a
controlled one-bit body defect verify assertion sensitivity. NAIF's error-free
SPKUDS behavior for arbitrary bits is retained; malformed JS shape/type remains a
separate wrapper error. The live1e-12 comparator is unchanged.

The focused two-routine `ephemeris-descriptors` batch is a prerequisite split for
this cross-boundary repair. Six SPK file/writer/coverage routines remain in
`ephemeris-1`; eight state/position/search routines remain in `ephemeris-2`. The
SPKSFS packed producer uses the same preservation repair and is audited with
the eight state/position/search routines below. No planned routine or new external fixture is introduced.

### SPK file, writer and coverage audit

`ephemeris-1` covers `spkopn`, `spkopa`, `spkcls`, `spkw08`, `spkobj` and
`spkcov` through the compiled operation on both backends and actual SpiceyPy.
Negative comment reservations follow CSPICE's zero default; empty internal names,
frames and segment IDs reach CSPICE's structured EMPTYSTRING errors. Type8 states
retain complete six-component sample layout, kilometer/second units and explicit
ET spacing. Both adapters reject fractional/out-of-range IDs, nonfinite values
and state buffers above the existing 256 MiB allocation budget before reading
caller elements. No extra body/center restrictions from SPKPDS are imposed on
SPKW08. The shared C change is present in regenerated pinned WASM artifacts.

An empty writer's SPKCLS error retains the claim for a subsequent write and close.
Native internal disposal can release the empty underlying DAF after the specific
NOSEGMENTSFOUND error without weakening the raw error behavior. Harness cleanup
resets pending errors and attempts writer close before deleting scratch files;
failed claims remain available for retry. Allocation fault tests exercise every
SPK writer/metadata temporary allocation and verify zero net leaks.

Scratch SPKs are furnished using the actual host path on Node, preserving file
identity and CSPICE's read/write conflict. Copying bytes into an unrelated staging
file had incorrectly hidden that conflict. WASM uses its actual virtual file.
New comparisons observe complete sorted object sets, every interval endpoint,
union accumulation, absent objects, zero-capacity empty outputs and real capacity
errors. Generated writer outputs are read back and evaluated; independent tests
inspect all 24 persisted state words, header/internal name, degree/count and full
40-character segment identifier. Synthetic fixtures and their generator are
documented in the parity fixture README. The unchanged numeric comparator uses
1e-12 absolute-or-relative tolerance; independent polynomial interpolation checks
use 1e-9 km position and 1e-12 km/s velocity bounds.

### Chebyshev SPK segment writers

| Raw method                                                                                                          | N0067 route | Record semantics                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `spkw02(handle, body, center, frame, first, last, segid, intlen, n, degree, cdata, btime)`                          | `spkw02_c`  | Type 2 writes three position polynomials per fixed-duration record in seconds. SPKE02 differentiates each with respect to physical TDB seconds; each record contributes a stored midpoint, radius and coefficients. Degree 0..27.                       |
| `spkw03(handle, body, center, frame, first, last, segid, intlen, n, degree, cdata, btime)`                          | `spkw03_c`  | Type 3 writes independently supplied position and velocity polynomials (km and km/s). Each of the six components contributes degree+1 ascending terms; midpoint/radius and a four-word directory are stored. Degree 0..27.                              |
| `spkw20(handle, body, center, frame, first, last, segid, intlen, n, degree, cdata, dscale, tscale, initjd, initfr)` | `spkw20_c`  | Type 20 writes velocity coefficients and midpoint position per axis, successive records in Julian days and a seven-word directory. Distance and time scales convert physical units, and integration from each midpoint recovers position. Degree 0..50. |

Each method returns void and uses an owned open SPK token. [Units, full record layouts and two-way independent file checks](step8-spk-chebyshev.md)

### Interpolated SPK segment writers

| Public raw signature                                                                        | Canonical writer | Scientific record                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `spkw09(handle, body, center, frame, first, last, segid, degree, states, epochs)`           | `spkw09_c`       | Type 9 appends six separate Lagrange state components at irregular epochs with degree 1..27 and at least degree+1 rows.                                                                                                                                      |
| `spkw12(handle, body, center, frame, first, last, segid, degree, states, epoch0, step)`     | `spkw12_c`       | Type 12 writes fixed-grid Hermite position/time-derivative states using epoch0 and positive step in TDB seconds with odd degree 1..27.                                                                                                                       |
| `spkw13(handle, body, center, frame, first, last, segid, degree, states, epochs)`           | `spkw13_c`       | Type 13 writes position plus its derivative in km and km/s on increasing irregular epochs with odd Hermite degree 1..27.                                                                                                                                     |
| `spkw18(handle, subtype, body, center, frame, first, last, segid, degree, packets, epochs)` | `spkw18_c`       | Type 18 supports subtype-0 independent position/derivative and velocity/acceleration Hermite interpolation and subtype-1 independent six-component Lagrange interpolation. The per-axis position derivative and separately interpolated velocity may differ. |

All four return void and require a live writer owned by the client. [Layouts, epoch storage and independent reciprocal readback](step8-spk-interpolation.md)

### SPK state, position and segment-search audit

`ephemeris-2` reviews `spkez`, `spkezp`, `spkezr`, `spkpos`, `spkgeo`, `spkgps`,
`spkssb` and `spksfs` through their actual compiled raw operations on both
backends. Every state/position component and applicable light time reaches live
comparison. All nine aberration modes use authored target and observer motion
with distinct values in three axes. Linked signed centers, closed endpoints,
coverage gaps, rotating frames, load-order priority and unload/reload are
observed. Literal polynomial and distance/c checks independently verify units;
a central difference of corrected position verifies the reported velocity.

Both adapters reject nonfinite ET and non-string frame/correction/name inputs
before CSPICE, while preserving scientific errors. Checked explicit tuples
replace unchecked state/position casts. Later WASM string allocations are inside
protected scopes; all 40 query/search allocation-failure positions permit real
post-failure calls with zero net leaked temporaries. No shared C change or
additional WASM regeneration is needed for this adapter/oracle repair.

SpiceyPy's default found decorator could mask actual NOLOADEDFILES as a successful
miss. A scoped `no_found_check` preserves the actual error, then interprets found.
Search comparisons distinguish that error from a loaded-empty/unknown/gap miss,
and compare complete identifiers, both TDB bounds and all six packed integers.
Physical file handles are process-dependent: independent tests verify their
identity against actual KDATA within each backend, including priority changes.
The unchanged live comparator remains 1e-12 absolute-or-relative.

### Cell/window observations

`card` and `size` count elements (window endpoints); `wncard` counts intervals and `wnfetd` uses zero-based interval indices. `scard` changes cardinality without clearing or initializing stored bytes. Set insertion compares complete ordered contents with live SpiceyPy, including duplicate insertion into a full set, explicit zero capacity, and character truncation/trailing-blank equivalence. `insrtc` requires a string at runtime on both backends. Window cases observe every selected endpoint after touching, contained, bridging and singleton insertions; named overflow/bounds errors and separate same-instance recovery tests preserve error distinctions and lifecycle behavior. Missing-target workflow errors remain harness preflight and do not establish raw CSPICE error parity.

#### Window algebra

These flat raw methods take existing `SpiceWindow` handles from the same
backend. Each destination is caller-owned and distinct from every input.
The double scalar arguments are finite. `kit.newWindow(maxIntervals)`
allocates capacity in intervals, each of which occupies two endpoint slots.

| Raw call                              | CSPICE     | Return and observable state                                                           |
| ------------------------------------- | ---------- | ------------------------------------------------------------------------------------- |
| `wncomd(left, right, window, result)` | `wncomd_c` | Write the closed complement within the supplied interval.                             |
| `wncond(left, right, window)`         | `wncond_c` | Contract the window in place using signed left and right adjustments.                 |
| `wndifd(a, b, result)`                | `wndifd_c` | Write the closure of A minus B.                                                       |
| `wnelmd(point, window)`               | `wnelmd_c` | Boolean point membership, including closed endpoints.                                 |
| `wnexpd(left, right, window)`         | `wnexpd_c` | Expand in place, with signed adjustments and coalescing.                              |
| `wnextd(side, window)`                | `wnextd_c` | Replace intervals in place with selected endpoint singletons.                         |
| `wnfild(small, window)`               | `wnfild_c` | Fill gaps of measure at most the threshold.                                           |
| `wnfltd(small, window)`               | `wnfltd_c` | Remove intervals of measure at most the threshold.                                    |
| `wnincd(left, right, window)`         | `wnincd_c` | Boolean inclusion of the supplied interval in one stored interval.                    |
| `wnintd(a, b, result)`                | `wnintd_c` | Write the intersection, including touching singletons.                                |
| `wnreld(a, op, b)`                    | `wnreld_c` | Boolean set comparison with the supplied relation.                                    |
| `wnsumd(window)`                      | `wnsumd_c` | Owned object with `meas`, `avg`, `stddev`, `shortest` and `longest`.                  |
| `wnunid(a, b, result)`                | `wnunid_c` | Write the union using the supplied capacity, including pinned full-capacity behavior. |

Mutators and destination writers return void. Read their results with
`wncard` and `wnfetd`. A capacity error can leave a visible partial
interval. The complete status and readback checks include the actual
N0067 full-capacity union, first-tie summary indices and empty sentinels.
[Window algebra and failure state](step8-window-algebra.md)

### Ordinary cell arrays

| Raw method                  | Canonical routine | Behavior                                                           |
| --------------------------- | ----------------- | ------------------------------------------------------------------ |
| `appndc(item, cell)`        | `appndc_c`        | Append to a fixed-width character row, retaining significant tabs. |
| `appndd(item, cell)`        | `appndd_c`        | Append a binary64 value, including infinity and signed zero.       |
| `appndi(item, cell)`        | `appndi_c`        | Append a signed32 integer in caller order.                         |
| `elemc(item, cell)`         | `elemc_c`         | Determine full-key membership, ignoring trailing ASCII spaces.     |
| `elemd(item, cell)`         | `elemd_c`         | Test exact membership of an ordered binary64 value.                |
| `elemi(item, cell)`         | `elemi_c`         | Test exact signed32 membership.                                    |
| `copy(source, destination)` | `copy_c`          | Copy ordered rows into the caller's same-type ordinary cell.       |

Append can clear the cell's set flag. Copy retains the destination flag and
can leave a partial numeric prefix on capacity error. [State, errors and exact membership observations](step8-cell-arrays.md)

### Kernel-pool observations and boundaries

Kernel-pool reads preserve zero-based paging, complete values, found flags and CSPICE name order (which is not generally sorted). Missing/wrong-type values differ from an empty page of an existing variable. `gipool` rounds halfway values away from zero and signals `INTOUTOFRANGE` for unrepresentable values. Paging arguments must fit signed SpiceInt on both backends before allocation or native conversion.

`pdpool`, `pipool` and `pcpool` with zero values are no-ops preserving previous type/contents. Native `pcpool` supplies a required non-null dummy buffer even when count is zero. The locked SpiceyPy wrapper cannot construct that empty input; that one oracle path calls its same `libspice.pcpool_c` entrypoint with zero count and checks CSPICE error state. Nonempty calls use ordinary SpiceyPy wrappers. Character pool values may be blank or empty; leading blanks are significant and trailing padding is trimmed. Watch registration adds names and arms notifications; `cvpool` consumes each agent's flag independently. Live state sequences compare these effects, with temporary allocation rollback and post-error recovery verified separately.

### Body IDs, names and constants

Body codes must fit signed SpiceInt before native/WASM conversion. Name translation preserves CSPICE normalization and alias precedence; reverse translation preserves significant leading blanks/case, and `bodc2s` returns the decimal code for an unknown ID. `boddef` definitions persist across `kclear`; tests use distinct custom mappings and repeatable reassignment sequences rather than overriding built-in bodies.

`bodfnd` now invokes its actual CSPICE entrypoint on both backends and the live oracle, including character-valued constants. `bodvar` retains its existing composed contract: normalized nonempty item, numeric metadata preflight, bounded `bodvcd` retrieval, and `[]` for missing/non-numeric constants. Both follow NAIF's 32-byte constructed pool key. WASM queries the shared shim for the required dimension before allocating, and native sizes from the same metadata; all values beyond the old undocumented 1024 cap now reach comparison. Only the documented item-input length guard remains. The oracle uses actual `bodvar` for numeric values and explicitly models the contract's miss policy. It checks CSPICE error state before converting a SpiceyPy NotFoundError to found:false, preventing real mapping/empty-string errors from being hidden.

### Time parsing, defaults and precision

`str2et` returns TDB seconds past J2000 and observes LSK/TIMDEF state; `tparse` returns formal-calendar seconds without leap correction or an LSK requirement. TPARSE/TPICTr diagnostics are translated to errors even when CSPICE's global failed flag is false. `tpictr` derives its result from the sample; the retained nonempty initial template does not drive derivation or set output capacity. `tkvrsn("TOOLKIT")` reads the actual immutable toolkit version; WASM caches that module-initialized value.

TIMDEF defaults persist across `kclear`/`reset`. Parity workflows capture and restore caller defaults on both success and failure, including mutually exclusive SYSTEM/ZONE settings, while public raw SET calls retain their normal persistent behavior. Invalid string item names reach actual CSPICE validation in both dispatchers. Uniform-time comparisons retain actual epoch output and, for Julian-day output, a seconds-scale offset derived from that output so the unchanged numeric tolerance cannot hide subsecond differences behind the large Julian baseline. No numeric tolerances are loosened; existing LSK fixture provenance is retained.

### UTC and spacecraft clocks

`et2utc` uses signed integer precision, clamped by CSPICE to [0,14], and preserves format/era/leap rounding. Spacecraft IDs must fit signed SpiceInt before native/WASM conversion. `scencd`/`scdecd` operate in mission ticks with partition information; `scdecd` and `sce2s` round to whole ticks, while `sce2c` and `sct2e` retain fractional ticks. Shared partition boundaries decode to the later partition. A TDB clock correlation needs no LSK; other clock time systems need conversion constants. `deltet` returns ET minus UTC in seconds at the selected ET/formal-UTC epoch.

The audit retains the real cookbook fixture and adds a repository-authored two-partition clock with small exact values, making fractional/partition errors observable under unchanged numeric tolerances. Every result/error comes from the actual raw operation and live SpiceyPy. Fixture provenance, conditional conversion requirements, same-instance recovery and temporary allocation rollback are recorded per routine.

### General matrices

| Raw method         | Canonical operation | Result                      |
| ------------------ | ------------------- | --------------------------- |
| `mequg(A,r,c)`     | `mequg_c`           | Owned row-major copy, r × c |
| `mtxmg(A,B,r,k,c)` | `mtxmg_c`           | AᵀB, r × c                  |
| `mtxvg(A,x,r,k)`   | `mtxvg_c`           | Aᵀx, r elements             |
| `mxmg(A,B,r,k,c)`  | `mxmg_c`            | AB, r × c                   |
| `mxmtg(A,B,r,k,c)` | `mxmtg_c`           | ABᵀ, r × c                  |
| `mxvg(A,x,r,k)`    | `mxvg_c`            | Ax, r elements              |
| `vtmvg(y,A,x,r,c)` | `vtmvg_c`           | Scalar yᵀAx                 |
| `xposeg(A,r,c)`    | `xposeg_c`          | Flat c × r transpose        |

The input arrays retain row-major order. Output extent and the expected input
lengths depend on each routine's dimension order. [Shapes, signed dimensions and independent observations](step8-general-matrices.md)

### Analytic SPK writers

| Raw method                                                                                                  | CSPICE route | Record                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `spkw05(handle, body, center, frame, first, last, segid, gm, states, epochs)`                               | `spkw05_c`   | Type 5 stores Cartesian states, increasing TDB sample epochs and central GM. Evaluation propagates neighbouring Keplerian states, blends with a derivative contribution to velocity, and extrapolates from the terminal state.                          |
| `spkw10(handle, body, center, frame, first, last, segid, consts, elems, epochs)`                            | `spkw10_c`   | Type 10 stores eight geophysical constants and generic fourteen-word packets containing ten TLE values and four generated nutation quantities, indexed by increasing reference epoch. Near-Earth and deep-space samples evaluate in J2000 with the LSK. |
| `spkw15(handle, body, center, frame, first, last, segid, epoch, tp, pa, p, ecc, j2flg, pv, gm, j2, radius)` | `spkw15_c`   | Type 15 normalizes three directions and writes a 16-word precessing-conic record using semilatus rectum, eccentricity, J2 flag and physical constants. Its evaluator applies distinct modes for secular node regression and apsidal precession.         |
| `spkw17(handle, body, center, frame, first, last, segid, epoch, eqel, rapol, decpol)`                       | `spkw17_c`   | Type 17 writes the epoch, nine equinoctial elements and two pole angles. Its Cartesian evaluator applies all terms in the tilted reference plane and includes angular rates in the returned velocity.                                                   |

All take a live owned SPK writer and return void. [File layouts, runtime boundaries and numerical comparisons](step8-spk-analytic.md)

### Streaming SPK writers

| Public operation                                                  | Linked N0067 entry | Segment action                                                                                                                                                                                                                                |
| ----------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `spk14b(handle, segid, body, center, frame, first, last, degree)` | `spk14b_c`         | Begin a streamed type 14 generic DAF segment on an owned open SPK writer. Its descriptor and single logical constant define coverage, reference frame and fixed packet width 2+6*(degree+1).                                                  |
| `spk14a(handle, count, records, epochs)`                          | `spk14a_c`         | Append complete time-tagged Chebyshev records to the actual open stream. References have variable spacings and must be strictly increasing within and across calls; the six polynomials independently encode Cartesian position and velocity. |
| `spk14e(handle)`                                                  | `spk14e_c`         | Finish a type 14 generic segment. The metadata and reference directory become readable after file close. The same file handle can immediately start another segment; ending an empty stream yields legitimate metadata-only coverage.         |

All operations return void. [Packet shape, degree and lifecycle bounds, independent file reads](step8-spk-streaming.md)

### Observer-relative SPK geometry

| Public operation                                                             | Linked N0067 entry | Observation                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `spkcpo(target, et, outref, refloc, abcorr, obspos, obsctr, obsref)`         | `spkcpo_c`         | Return the six-component target state as observed from the supplied position fixed in the observer frame. Correct the target event and evaluate the output frame at the requested locus.                                |
| `spkcpt(trgpos, trgctr, trgref, et, outref, refloc, abcorr, obsrvr)`         | `spkcpt_c`         | Return the apparent state of the supplied target point fixed in its local frame relative to an ephemeris observer. Evaluate the point at the corrected target epoch.                                                    |
| `spkcvo(target, et, outref, refloc, abcorr, obssta, obsepc, obsctr, obsref)` | `spkcvo_c`         | Propagate the observer state from its own supplied epoch with constant velocity in the observer frame. Apply its six-dimensional frame transform, observer-center motion, aberration correction and output frame locus. |
| `spkcvt(trgsta, trgepc, trgctr, trgref, et, outref, refloc, abcorr, obsrvr)` | `spkcvt_c`         | Propagate the local target state at its own epoch to the apparent target event. Transform both position and velocity, accounting for the source and output frames and target center.                                    |
| `azlcpo(method, target, et, abcorr, azccw, elplsz, obspos, obsctr, obsref)`  | `azlcpo_c`         | Return topocentric range, azimuth, elevation and their three time derivatives relative to the ellipsoid-based local frame, plus one-way light time. azccw sets the azimuth direction and elplsz the elevation sign.     |

The five methods each return an owned six-component `state` and scalar one-way `lt` in seconds. [Epochs, axes, units, error behavior and validation](step8-spk-relative.md)

### SPK corrections and signal time

| Method                                                                 | Direct canonical call | Output                                      |
| ---------------------------------------------------------------------- | --------------------- | ------------------------------------------- |
| `spkacs(target, et, ref, abcorr, observer)`                            | `spkacs_c`            | State, light time and light-time derivative |
| `spkapo(target, et, ref, observerState, abcorr)`                       | `spkapo_c`            | Position and light time                     |
| `spkapp(target, et, ref, observerState, abcorr)`                       | `spkapp_c`            | Legacy state and light time                 |
| `spkaps(target, et, ref, abcorr, observerState, observerAcceleration)` | `spkaps_c`            | State, light time and light-time derivative |
| `spkltc(target, et, ref, abcorr, observerState)`                       | `spkltc_c`            | State, light time and light-time derivative |
| `stelab(position, observerVelocity)`                                   | `stelab_c`            | Corrected position                          |
| `stlabx(position, observerVelocity)`                                   | `stlabx_c`            | Corrected position                          |
| `ltime(etobs, observer, dir, target)`                                  | `ltime_c`             | Target epoch and elapsed signal time        |

[Units, source guards, independent ABI and observed scientific behavior](step8-spk-corrections.md)

## Domain: `file-io` readers (`FileIoApi`)

| Raw method | Linked N0067 entry | Result or effect                                                                                                                                                                                                                                                |
| ---------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rdtext`   | `rdtext_c`         | Read one formatted physical record, advancing the cursor even after truncation. Return exact UTF-8 string bytes and EOF. EOF releases the unit and permits restart. Independently owned clients share an actual native file cursor until its last lease closes. |
| `putcml`   | `putcml_c`         | Initialize process-local or WASM-instance-local arguments exactly once, returning void. Observe the actual count and privately copied argument bytes immediately and retain canonical repeated-call errors across reset and kernel clear.                       |

[Text record semantics, ownership and command state](step8-text-command-state.md)

| Raw call                         | CSPICE entry                                                                            | Observable effect                                               |
| -------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `dasac(handle, lines)`           | `dasac_c`                                                                               | Append complete printable comment rows to an owned DAS writer.  |
| `dasdc(handle)`                  | `dasdc_c`                                                                               | Remove all comment records and preserve logical data addresses. |
| `dasec(handle, bufsiz, buffln?)` | Traced N0067 `dasec_`, actual physical record reader and original defined-row converter | Return `{ n, lines, done }` for the shared per-file cursor.     |

The first DAS writer can have the same native ID as N0067's private no-record sentinel. The adapter reads that writer's actual comment records. [Cursor handling and file-format evidence](step8-das-comments.md)

| Raw method              | CSPICE entry | Observable effect                                                      |
| ----------------------- | ------------ | ---------------------------------------------------------------------- |
| `dlabbs(handle)`        | `dlabbs_c`   | Last descriptor or a miss on an empty list.                            |
| `dlabns(handle)`        | `dlabns_c`   | Link a new segment immediately and establish its component bases.      |
| `dlaens(handle)`        | `dlaens_c`   | Calculate and write the three actual component sizes.                  |
| `dlafps(handle, descr)` | `dlafps_c`   | Follow a supplied backward link or return a miss at the first segment. |

[Generic DLA file creation, provisional sizes and independent persisted traversal](step8-dla-segments.md)

C05 adds typed binary DAS transfers through all nine canonical C entry points. [Address ranges, file persistence and record padding](step8-das-data.md)

| Raw method | CSPICE     | Result or effect                                                                                                                                                    |
| ---------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dasadc`   | `dasadc_c` | Append n binary bytes from inclusive zero-based columns in full-stride rows. NUL, high bytes and incomplete final slices are preserved.                             |
| `dasadd`   | `dasadd_c` | Append the first n IEEE doubles in caller order to the independent double address stream.                                                                           |
| `dasadi`   | `dasadi_c` | Append the first n signed 32-bit integers to the independent integer address stream.                                                                                |
| `dasrdc`   | `dasrdc_c` | Read inclusive one-based character addresses into selected columns of initialized rows. Return a full independent destination with every unselected byte preserved. |
| `dasrdd`   | `dasrdd_c` | Read inclusive one-based double addresses into an independent number array, retaining signed zero, infinities and NaN.                                              |
| `dasrdi`   | `dasrdi_c` | Read inclusive one-based integer addresses into an independent number array, including both signed 32-bit endpoints.                                                |
| `dasudc`   | `dasudc_c` | Replace an inclusive character range from selected byte columns; guard the actual N0067 source cursor when continuing in another physical record.                   |
| `dasudd`   | `dasudd_c` | Replace an inclusive allocated double address range from a validated owned numeric array.                                                                           |
| `dasudi`   | `dasudi_c` | Replace an inclusive allocated integer address range from a validated owned signed 32-bit array.                                                                    |

C04 exposes actual DAS writer, scratch and metadata routes. [Named/scratch DAS lifecycle, field widths and low-close behavior](step8-das-lifecycle.md)

| Raw method | CSPICE     | Result or effect                                                                                                                                           |
| ---------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dasonw`   | `dasonw_c` | Create a named DAS writer with case-sensitive four-byte type and 60-byte internal name. Reserve ncomr fixed 1024-byte records for comments.                |
| `dasops`   | `dasops_c` | Open an actual temporary DAS and return an owned writer claim. Its external name may be empty and its internal name is DAS SCRATCH FILE.                   |
| `dasopw`   | `dasopw_c` | Open an existing DAS for exclusive write. Toolkit open conflicts and file absence are observed independently.                                              |
| `dashfn`   | `dashfn_c` | Return the actual file name with caller namlen including NUL; the 255-byte toolkit field and unnamed scratch behavior are preserved.                       |
| `dashfs`   | `dashfs_c` | Read four reserved/comment counters, the first free record and three ordered triples of logical addresses, directory record numbers and word locations.    |
| `daslla`   | `daslla_c` | Return the last logical character, double and integer addresses. All three values are observed independently.                                              |
| `dasllc`   | `dasllc_c` | Release just one claim without flushing or segregating. Dirty data and process buffers require explicit caller handling.                                   |
| `dasrfr`   | `dasrfr_c` | Read the on-disk fixed header, including its eight-byte identification word, 60-byte internal name and all four counts. Output capacities are independent. |
| `daswbr`   | `daswbr_c` | Flush updated buffered data records of a live writer. A reader signals the toolkit access diagnostic; the writer stays open.                               |

| Raw call                       | CSPICE entry                                                                      | Observable effect                                                   |
| ------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `dafac(handle,lines)`          | `dafac_c`                                                                         | Append printable comment lines to a writable DAF.                   |
| `dafdc(handle)`                | `dafdc_c`                                                                         | Remove its complete comment area.                                   |
| `dafec(handle,bufsiz,buffln?)` | Traced N0067 `dafec_` with initialized outputs and original `F2C_ConvertTrStrArr` | Return `{n,lines,done}` for the shared file cursor.                 |
| `dafrs(handle,summary)`        | `dafcs_c`, `dafhsf_c`, `dafrs_c`                                                  | Replace the selected packed summary and retain the array addresses. |

Read aliases share page position. Finishing or closing the final DAF read link releases the original extractor cursor. [DAF comment and descriptor semantics](step8-daf-mutation.md)

| Raw call                         | CSPICE entry | Result                                                           |
| -------------------------------- | ------------ | ---------------------------------------------------------------- |
| `dafps(nd,ni,dc,ic)`             | `dafps_c`    | Native-order packed `Uint8Array`                                 |
| `dafus(summary,nd,ni)`           | `dafus_c`    | Owned `{dc,ic}` arrays                                           |
| `dafgsr(handle,recno,begin,end)` | `dafgsr_c`   | `{found:false}` or `{found:true,data:Uint8Array}`                |
| `dafrfr(handle,ifnlen?)`         | `dafrfr_c`   | `{nd,ni,ifname,fward,bward,free}`                                |
| `dafrda(handle,begin,end)`       | `dafrda_c`   | Native-format physical words as `Uint8Array`                     |
| `dafgda(handle,begin,end)`       | `dafgda_c`   | Numeric data as `number[]`, including translated non-native DAFs |

All four file operations use live DAF handles issued to the calling backend. Word positions, record numbers and addresses are one-based. [Boundary and byte semantics](step8-daf-records.md)

| Raw method               | Actual CSPICE route                  | Semantic observations                                                                                                |
| ------------------------ | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `dafopr(path)`           | `dafopr_c`                           | Backend-owned opaque token; duplicate native read claims share a file/search state.                                  |
| `dafcls(handle)`         | `dafcls_c`                           | Release one read or write claim; public tokens close once and are rejected after close.                              |
| `dafbfs(handle)`         | `dafbfs_c`                           | Start/restart search; authored two-segment and empty files distinguish its effect.                                   |
| `daffna(handle)`         | `dafcs_c` then `daffna_c`            | Select the file before each global next operation; compare interleaved true/false sequences, exhaustion and restart. |
| `dafbbs(handle)`         | `dafbbs_c`                           | Begin or restart a backward search at the end of the selected DAF.                                                   |
| `dafcs(handle)`          | `dafcs_c`                            | Select an already-started search without advancing its cursor.                                                       |
| `daffpa(handle)`         | `dafcs_c`, traced SPICELIB `daffpa_` | Advance exactly once on the selected DAF using an initialized logical output.                                        |
| `dafgh()`                | `dafgh_c`                            | Return the oldest surviving local DAF claim matching the toolkit’s current file.                                     |
| `dafgn(handle, namlen?)` | `dafcs_c`, `dafgn_c`                 | Return the current name using a NUL-inclusive byte capacity and strict UTF-8.                                        |
| `dafgs(handle)`          | `dafcs_c`, `dafhsf_c`, `dafgs_c`     | Return the packed summary as owned bytes, preserving integer pairs and NaN payloads.                                 |
| `dafhsf(handle)`         | `dafhsf_c`                           | Return file-wide integer counts `{nd, ni}` independent of current array position.                                    |
| `dafopw(path)`           | `dafopw_c`                           | Acquire a write claim on an existing native-format DAF and close it with `dafcls`.                                   |
| `dasopr(path)`           | `dasopr_c`                           | Open DAS/DLA/DSK for read; close-one/retain-another claims and real wrong-format/missing-file errors.                |
| `dascls(handle)`         | `dascls_c`                           | Finalize DAS/DLA output and release read claims; reopening proves a valid flushed empty DLA.                         |
| `dlabfs(handle)`         | `dlabfs_c`                           | Return a miss or all eight signed-integer descriptor fields, valid only on a hit.                                    |
| `dlacls(handle)`         | tspice alias of `dascls_c`           | Same DAS/DLA ownership/close behavior. N0067 has no separate `dlacls_c` C entrypoint.                                |

The C01 review records the initialized DAFFPA alias, cross-client ownership, and exact byte evidence. [DAF navigation](step8-daf-navigation.md)

The opaque-handle contract rejects foreign (within the same host realm), wrong-kind
and already-closed tokens before FFI. CSPICE's numeric close primitives themselves
permit unknown handles as no-ops; workflow preflight errors are explicitly
recorded as contract/lifecycle checks, not claimed as C error-path execution.
Ordinary file/open/search errors require actual named CSPICE failures. DLA oracle
handling checks the toolkit error status before accepting SpiceyPy's `NotFound`
exception as a normal miss, because its decorator otherwise masks genuine errors.

All descriptor fields reach live assertions, including linked-list pointers,
integer/double/character bases and sizes. File counts, handle IDs and integer
fields need no relaxed tolerance. Two authored tiny SPK/DAF fixtures distinguish
nonempty/end/restart/interleaved searches; case-scoped DLA scratch files exercise
close aliases and empty search. Writer and spatial-index evidence is maintained
separately in the following batch.

## Domain: `file-io` writers and spatial index (`FileIoApi`)

| Raw method | Actual CSPICE route | Semantic observations                                                                                        |
| ---------- | ------------------- | ------------------------------------------------------------------------------------------------------------ |
| `exists`   | `exists_c`          | Missing/present and before-create/while-open/after-close booleans.                                           |
| `getfat`   | `getfat_c`          | Actual DAS/DSK, DAS/MIXD, DAF/SPK and KPL/LSK pairs; missing-file error.                                     |
| `dlaopn`   | `dlaopn_c`          | Empty DLA, four-character type truncation, internal name and comment reservation; actual header readback.    |
| `dlafns`   | `dlafns_c`          | Nonempty second segment, all eight descriptor fields, end and restart.                                       |
| `dskopn`   | `dskopn_c`          | Real empty and populated DSK headers, close/reopen and existing-file rejection.                              |
| `dskmi2`   | `dskmi2_c`          | All ten doubles and every returned integer, distinct 3D meshes/scales and optional vertex lists.             |
| `dskw02`   | `dskw02_c`          | Two segments with distinct geometry, body/surface IDs, bounds and epochs; independent full content readback. |

The index comparator retains the existing 1e-12 numeric policy. Integer arrays
compare exactly at their int32 scale; no tolerance is widened. Mutation checks
prove the voxel-size double (index 9) and active integer data beyond the fixed
100007-element header reach assertions. The shared C shim rejects negative index
component counts and insufficient active storage before `dskw02_c`, using a wide
sum including the nv vertex-pointer span even when optional lists are absent.
The actual C guard has a compiled downstream-observer regression; public Node and
WASM tests reject malformed indexes and then write exactly one valid segment on
the same handle. Node validates flattened lengths before allocating large native
buffers. WASM validates input types before coercion and releases earlier strings
when later opener allocations fail.

Supplemental live SpiceyPy readback compares every stored vertex/plate and all
DSK descriptor fields, DAS internal names and comment record reservation against
an independent reference writer and authored literal inputs. The WASM component
binding is used only to expose actual filesystem bytes for this reader; registered
workflows use actual public raw exports on both backends. Meshes and DLA headers
are project-authored synthetic scratch data under MIT; existing fixture provenance
is unchanged. Malformed/closed handle, shape and negative-reservation cases are
explicit contract preconditions, not claims of executing CSPICE error paths.

## Domain: `dsk` queries (`DskApi`)

| Raw method | Actual CSPICE route | Observations                                                                                                                |
| ---------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `dskobj`   | `dskobj_c`          | Full body-ID union, retained initial IDs, repeated segment IDs, repeated calls and all intermediate snapshots.              |
| `dsksrf`   | `dsksrf_c`          | Body-filtered surface union, absent body, zero capacity, strict int32 body IDs and actual capacity errors.                  |
| `dskgd`    | `dskgd_c`           | Six integer fields, ten coordinate parameters, all bounds and epochs; rectangular and planetodetic descriptors.             |
| `dskb02`   | `dskb02_c`          | Every bookkeeping field, nonzero asymmetric 3x2 vertex bounds, tetrahedron/pyramid counts, voxel scales and optional lists. |

Both set queries append IDs for each qualifying segment before deduplicating.
Their temporary storage requirement can therefore exceed the final unique set
size; tests preserve actual N0067 behavior instead of redefining raw semantics.
After CELLTOOSMALL, contents may be partially changed. Public tests explicitly
reinitialize cardinality/size before a successful query on the same cell.
Missing and wrong-architecture/type cases require actual FILENOTFOUND,
INVALIDARCHTYPE and INVALIDFILETYPE. The locked SpiceyPy6.0.3 convenience wrappers
hard-code new size10000 cells, so these oracle handlers call the same loaded
N0067 `libspice` bindings with actual caller-initialized cells and check toolkit
status. This exposes union/capacity semantics independently of tspice.

The shared descriptor layout already matches CSPICE. New distinct 3D bounds
verify both the shim's row-major 3x2 layout and the existing SpiceyPy 2x3 memory
normalization; literal authored bounds are also asserted through public raw APIs.
Node parses unknown output fields into explicit typed objects without double
casts. Both adapters reject negative descriptor bases/sizes before FFI; plausible
arbitrary descriptors remain a caller precondition because NAIF documents
undefined effects. A caller must establish type2 before `dskb02`.

Actual WASM-heap fault injection reproduced two path-allocation leaks and now
covers all twelve query allocation positions. WASM body-ID preflight prevents
fractional/overflow coercion (the old adapter accepted 399.5 as body399). DSK
oracle traversal now distinguishes a genuine empty miss from a toolkit failure,
and pending actual DSK claims close before scratch deletion. No C shim or checked-in
WASM artifacts change in this batch; its writer/bounds prerequisite is #694.

## Domain: `ek` file and segment lifecycle (`EkApi`)

[Physical EK entry values, nulls, byte widths and independent persisted reads](step8-ek-entries.md)

| Raw method | Linked toolkit entry                     | Result or effect                                                                                                                   |
| ---------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `ekacec`   | `ekacec_c`                               | Add the character entry of an owned writable EK using the observed array count and null flag.                                      |
| `ekaced`   | `ekaced_c`                               | Add the double precision and TIME entry of an owned writable EK using the observed array count and null flag.                      |
| `ekacei`   | `ekacei_c`                               | Add the integer entry of an owned writable EK using the observed array count and null flag.                                        |
| `ekrcec`   | `ekrcec_` with checked C string handling | Read the entire character entry by physical segment/record, preserving null flag, element count and owned payload.                 |
| `ekrced`   | `ekrced_` with checked C string handling | Read the entire double precision and TIME entry by physical segment/record, preserving null flag, element count and owned payload. |
| `ekrcei`   | `ekrcei_` with checked C string handling | Read the entire integer entry by physical segment/record, preserving null flag, element count and owned payload.                   |
| `ekucec`   | `ekucec_c`                               | Replace the character entry of an owned writable EK using the observed array count and null flag.                                  |
| `ekuced`   | `ekuced_c`                               | Replace the double precision and TIME entry of an owned writable EK using the observed array count and null flag.                  |
| `ekucei`   | `ekucei_c`                               | Replace the integer entry of an owned writable EK using the observed array count and null flag.                                    |

[EK record edits, table schemas and writer constraints](step8-ek-records.md)

| Raw method | CSPICE     | Result or effect                                                                                                                                                       |
| ---------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ekops`    | `ekops_c`  | Create a temporary EK writer and return an owned opaque handle. EKCLS closes the file and releases scratch storage.                                                    |
| `ekbseg`   | `ekbseg_c` | Begin an EK segment from table name and complete column names/declarations; return the zero-based segment number. Fixed-count and editable schemas are distinguished.  |
| `ekappr`   | `ekappr_c` | Append an unpopulated record in a variable-count segment and return its zero-based ordinal. Initialize its entries before querying or delete the empty record.         |
| `ekinsr`   | `ekinsr_c` | Insert a new unpopulated record before the indicated zero-based ordinal. Insertion at the current row count extends the segment. Later record numbers shift upward.    |
| `ekdelr`   | `ekdelr_c` | Delete the given zero-based record and column/index links from an editable segment. Surviving row ordinals shift down. A newly unpopulated record may also be deleted. |

[Physical and logical EK metadata, SELECT storage and query-load ownership](step8-ek-metadata.md)

| Raw method | Linked N0067 entry               | Result or effect                                                                                                                   |
| ---------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `ekccnt`   | `ekccnt_c`                       | Count the columns of an actual loaded logical table; opening its physical file alone does not register a table.                    |
| `ekcii`    | `ekcii_` with canonical tracing  | Read the indexed column name and all six descriptor attributes, including type, storage class, fixed/variable size and both flags. |
| `eklef`    | `eklef_c`                        | Create an idempotent direct query-file registration independent of explicit EK reader claims, with a client-owned token.           |
| `eknelt`   | `eknelt_` with canonical tracing | Read the number of elements in a selected result row, including stored extents of SQL null and fixed/variable array entries.       |
| `ekpsel`   | `ekpsel_c`                       | Parse SELECT names, aliases, inclusive zero-based byte offsets, type and class arrays, or return the actual language diagnostic.   |
| `ekssum`   | `ekssum_c`                       | Read physical segment table/row/column counts and every column name and six-field storage descriptor.                              |
| `ekuef`    | `ekuef_c`                        | Unload one direct physical query registration, preserve independent reader claims, and retire the owner-local token.               |

| Raw method | Actual CSPICE route | Observations                                                                                                        |
| ---------- | ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `ekopn`    | `ekopn_c`           | Create, existing-file failure, actual 60-byte internal-name field and comment reservation.                          |
| `ekopr`    | `ekopr_c`           | Reopen finalized output and retain duplicate read claims with separate opaque tokens.                               |
| `ekopw`    | `ekopw_c`           | Append/finalize a second segment, close/reopen and independently read all stored rows.                              |
| `ekcls`    | `ekcls_c`           | Finalize valid output; explicit claims survive kernel clearing and close independently.                             |
| `eknseg`   | `eknseg_c`          | Physical counts0/1/2/3, distinct from logical tables.                                                               |
| `ekntab`   | `ekntab_c`          | Logical table deduplication across files/segments, empty state and load/unload transitions.                         |
| `ektnam`   | `ektnam_c`          | Every loaded name in toolkit enumeration order and zero-based first/last indices.                                   |
| `ekifld`   | `ekifld_c`          | Actual zero-based segment number and every returned record pointer, used unchanged through finalized data readback. |

Only one fast-write segment may be active. Every column must be added and the
segment finalized before another EK operation; query selections must be renewed
afterward. The harness now observes actual workspace values instead of only a
workflow-local segment label. Structured fixture/scratch paths preserve explicit
file staging; legacy string EK paths remain scratch-relative.

Both backends enforce the existing 1,000,000-row guardrail and N0067's 100-column
maximum. Node validates counts before string conversion/padding and bounds packed
string buffers using the same 256 MiB per-buffer cap as WASM. Tests write/read a
real 100-column table and reject 101 columns before touching element data. The
maximum 256 MiB allocation boundary is reviewed arithmetically rather than stress
allocated in tests. WASM now rejects numeric internal names and non-array column
inputs before coercion and frees earlier allocations after opener failure; all 23
lifecycle allocation positions are faulted on an actual WASM heap.

Independent live SpiceyPy readback compares the full DAS header, every segment's
schema attributes and all rows against another actual writer and literal authored
values. ctypes enum wrappers are normalized to their scalar values; no fields or
numeric differences are discarded. Pending actual EK claims close before scratch
removal in both harnesses, and failed closes retain metadata for retry. Public
opaque tokens reject foreign/expired/wrong-kind claims even though native
`ekcls_c` permits unrecognized numeric handles as no-ops.

Named errors include FILEOPENFAIL, FILENOTFOUND, FILEOPENCONFLICT, NOLOADEDFILES,
INVALIDINDEX, IDSTRINGTOOLONG, INVALIDNAME, BADCOLUMNDECL and DASINVALIDACCESS.
The pinned N0067 `ektnam_c` header spells one exception INVALDINDEX; actual toolkit
execution reports INVALIDINDEX and the tests require that observed code. Typed
preflight errors are explicitly separate from toolkit error-path comparisons.
Column-value and query-result semantics retain their separate `ek-1` assignment.

### Step 7 EK column writing and query results

The separate `ek-1` batch reviews exactly `ekacli_c`, `ekacld_c`, `ekaclc_c`,
`ekffld_c`, `ekfind_c`, `ekgc_c`, `ekgd_c` and `ekgi_c`. All execute their actual
shared-C/CSPICE routes. `ekssum_c` is used internally for safe metadata validation,
just as CSPICE's own column writers use it; no new public raw routine is added.

Writers now check caller storage against actual segment rows and fixed entry
sizes before any downstream access. The private `tspice_ekffld` ABI carries the
pointer-array length; the public API is unchanged. A controlled fixture compiling
the actual shim proved the old writers forwarded a one-row array descriptor to
an actual three-row segment without invoking an unsafe consumer. Tests reject
truncated rows/fixed backing/finalization and then finish a valid file on the
same instance. Actual WRONGSEGMENT, WRONGDATATYPE and INVALIDINDEX paths remain
separate from typed preflight. Pinned numeric missing-column calls report BUG;
character missing-column calls report NOCOLUMN, both required explicitly.

N0067's `ekaclc_c` allocates a logical-flag array by total character count, then
copies one flag per row. Zero-size variable NULL rows now get internal ignored
blank placeholders so the storage covers every row; logical NULL values and
public packing remain unchanged. Both temporary allocation failures are injected
in the actual C shim and recover with no leaked storage. Character C slots have
a minimum three-byte stride: an independent pinned CSPICE probe showed a
two-byte stride reads all six single-letter fixed-field values as blanks through
ZZEKAC06. Literal tests require all six authored letters to survive. Blank
concrete strings, UTF-8 values and all-NULL columns also have actual readback.

The query oracle uses scoped `no_found_check` so SpiceyPy's outer real error
checker executes before interpreting data/null/found tuples. Row-based exception
coercion is removed. Legitimate misses, NULLs and INVALIDINDEX/INVALIDTYPE remain
distinct. Explicit 2,048-byte buffers retain full 1,024-character values and a
273-character parse diagnostic that SpiceyPy's default buffer cut to 255.
Actual N0067 returns NULL before upper element-bound checking; element 9 of a
NULL entry still returns NULL, despite the primary header's size-one statement.
The audit records this observed behavior and preserves raw CSPICE semantics.

SpiceyPy 6.0.3 independently computes character-array backing width using Python
string lengths. The oracle calls the same actual `ekaclc_c` through SpiceyPy's
ctypes library with explicit UTF-8 byte packing and its actual error checker for
correct byte widths/empty storage. No expected result substitutes this operation.
Every finalized typed value and complete tri-state/string/diagnostic reaches the
parity assertion; independent literal tests on Node, WASM and SpiceyPy check the
authored values as well. The old missing workflow-segment-label case is explicitly
harness-only; the new WRONGSEGMENT case reaches the actual raw finalizer.

The owning pinned WASM build regenerates both outputs after the shared-C/ABI
changes. Current source-bound verification and exact case IDs live in maintained
`ek-1.json`; registered case counts alone do not certify completion. No global
numeric tolerance changes or remaining planned routines are introduced.

### Step 7 frame lookup and transformation utilities

`frames-2` reviews exactly namfrm_c, frmnam_c, cidfrm_c, cnmfrm_c, frinfo_c,
ccifrm_c, pxform_c and sxform_c. Moving cidfrm/ccifrm out of the CK batch leaves
six CK routines and preserves every one of the162 baseline assignments.
All use actual same-named shared-C/CSPICE operations; code0/empty-name sentinels
are deliberately normalized to the public Found result.

The authored FK distinguishes frame code, center and class ID, including a
negative static frame and a three-axis dynamic Euler frame. Cases compare all
lookup fields, complete32-character names, real misses, load/unload/cache
transitions and every9/36 row-major transform component. The dynamic state
matrix has nonzero dR/dt terms. Independent actual-backend tests check literal
metadata, [R,0;dR/dt,R] blocks and full inverse products. A central position
finite difference with h=.01s uses a separate5e-11 truncation/roundoff bound;
the live SpiceyPy comparator remains1e-12 throughout.

Both adapters now reject fractional/overflow/nonfinite frame integer IDs and
nonfinite ET instead of silently coercing them. Negative valid identifiers and
epochs remain allowed. WASM string types are checked before encoding. State
results are validated and copied into an explicit36-element mutable tuple,
replacing unchecked casts. Five actual WASM allocation-failure positions leaked
buffers in cnmfrm/pxform/sxform before their try blocks; protected scopes now
pass all34 fault positions plus a real valid builtin lookup after each failure.
No shared C or compiled WASM changes are needed for these adapter repairs.

The locked oracle's default found exception could precede its real toolkit
error check. Scoped no_found_check keeps legitimate misses and actual
EMPTYSTRING/INVALIDDIMENSION/KERNELVARNOTFOUND/INVALIDFRAMEDEF errors distinct;
ten failing-before comparisons now pass. UNKNOWNFRAME and FRAMEDATANOTFOUND
are tested independently of metadata failures. Raw operations and every field
reach assertions; no harness substitute establishes coverage.

CK pointing/coverage/file state remain separately assigned to frames-1, including
noticed pre-try allocation and found/error ordering gaps. The independent utility
branch also retains the known inherited KPL WASM cell-identity finding as open
until the separate #684 repair is integrated; utility passes do not certify it.
Maintained frames-2.json records exact cases, human judgments and source-bound
verification separately from generated scenario counts.

### CK pointing, coverage and physical handle audit

`ckgp` and `ckgpav` invoke their actual Node ephemeris N-API handlers or compiled
WASM exports and shared C shim. All nine row-major components, actual encoded
clock and (for `ckgpav`) all three reference-frame AV components reach live parity.
Scoped oracle found handling preserves real toolkit errors. Clock tolerance is
encoded ticks; negative pointing tolerance is a miss, while negative coverage
tolerance is a CSPICE error. AV output is radians/second.

`cklpf`/`ckupf` intentionally retain numeric CSPICE global-state handles: duplicate
file loads share a handle and change priority; one unload removes all aliases and
unknown physical unload is a no-op. They do not register FURNSH entries. Native
backend instances in a process share toolkit state. Handle portability requires
shared state; use worker/process isolation for independence. Pending workflow CKs
close before Scratch files are deleted, including captured-error recovery/retry.

`ckobj` and `ckcov` append to caller-owned output rather than clearing it. The
registered workflow keeps its old reset-by-default behavior with an explicit
`reset:false` accumulation option; both dispatchers preserve genuine zero capacity.
Integer sets and complete interval arrays are compared, with independent literal
union assertions. SEGMENT/INTERVAL gaps, needav, tolerance merging and SCLK/TDB
conversion are distinguished by authored Type3 fixtures. `frames-1.json` records
all six routine judgments and the exact evidence; the eight frame lookup/transform
routines remain the separate `frames-2` audit in #698. No new raw methods are added.

### Surface geometry and planes audit

The nine `geometry` routines call actual compiled CSPICE through both adapters.
New comparisons observe every point/vector component, target surface epoch,
angle, flag, plane word and occultation code. Authored fixed frames, linear
ephemerides and an octahedral DSK distinguish nearest versus radial ellipsoid
points and nadir versus radial DSK intersections. Independent Lagrange-root
ellipsoid, convex-halfspace plate and vector-angle formulas validate the full
results; all four lighting/visibility combinations and all seven occultation
codes have literal assertions. Contact-straddling point cases distinguish
reception/transmission correction effects without ambiguous exact tangency.

Both adapters reject nonfinite epochs/vector elements, incorrect vector lengths
and non-string inputs before CSPICE. Checked explicit tuples replace unsafe
output assertions. WASM uses existing withAllocs ownership and protected string
allocation scopes: 41 failing-before leak positions are repaired and all 87
geometry allocation-failure positions permit actual post-error calls. No shared
C or generated WASM binary change is needed. Scoped SpiceyPy no_found_check
preserves real SINCPT errors such as BADMETHODSYNTAX, then distinguishes misses.

CSPICE scientific preconditions are retained. PL2NVC is error-free for a valid
creator-produced plane; no malformed scientific plane error is invented. SUBSLR
permits observer at the target center, and general-source illumination permits
source at that center. DSK angle positives use facet interiors, since ridge and
vertex normals are undefined. Pinned N0067 ILLUMF parses a DSK surface list but
uses a zero/all-surfaces count for normal/ray initialization; its actual complete
output is covered and retained. ILUMIN/ILLUMG missing-surface errors are tested
separately. This is toolkit behavior, not a raw support exception.

Live comparisons retain the existing 1e-12 absolute-or-relative tolerance.
Independent point/plane checks use 1e-11 and angle checks 1e-12 radians. The
small authored fixtures and generators are documented in the fixture README.

## Geometry Finder semantic audit

The eight GF raw routines call actual CSPICE on both backends. Search epochs,
step and convergence tolerance are TDB seconds; GFDIST reference/adjustment are
km and GFSEP reference/adjustment are radians. Searches replace result contents
and preserve confinement. Output capacity (at least one interval) is independent
of internal `nintvls`. The shared shim bounds the complete five-cell N0067
workspace to256MiB (at most3,355,440 intervals) before unchecked signed arithmetic;
nonpositive counts retain actual CSPICE VALUEOUTOFRANGE.

GFSSTP/GFSTEP and GFSTOL are process/module global and survive KCLEAR. GFSTEP
requires prior initialization and ignores its finite time input. GFSTOL defaults
to1e-6seconds; raw calls persist, while parity-case cleanup restores that default.
GFREFN is an error-free midpoint estimator independent of tolerance and boolean
state flags; wrapper arguments still require actual booleans and finite numbers.

GFREPI/GFREPF console effects are compared in real fresh-process Node/WASM and
locked SpiceyPy probes. Emscripten initialization explicitly drains libc and TTY
buffers. Registered void-return workflows alone do not certify reporter output.
Callback-free GFDIST/GFSEP do not automatically drive a separate reporter.
GFSEP preserves NAIF's documented POINT alignment limitation for equality to zero;
LOCMIN/ABSMIN tests establish the corresponding nonempty extrema. POINT frame
orientation is ignored, with nonempty C strings still required.

## Coordinate Jacobians in `CoordsVectorsApi`

Each public method uses the canonical spelling without `_c` and returns the owned row-major result described in [the scientific and error-path review](step8-coordinate-jacobians.md).

| Routine                                                                              | Output coordinates differentiated with respect to input coordinates     |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| [`dazldr_c`](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dazldr_c.html) | (range, azimuth, elevation) from Cartesian (x, y, z)                    |
| [`dcyldr_c`](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dcyldr_c.html) | (cylindrical radius, longitude, z) from Cartesian (x, y, z)             |
| [`dgeodr_c`](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dgeodr_c.html) | (geodetic longitude, latitude, altitude) from Cartesian (x, y, z)       |
| [`dlatdr_c`](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dlatdr_c.html) | (radius, longitude, latitude) from Cartesian (x, y, z)                  |
| [`dpgrdr_c`](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dpgrdr_c.html) | (planetographic longitude, latitude, altitude) from Cartesian (x, y, z) |
| [`drdazl_c`](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/drdazl_c.html) | Cartesian (x, y, z) from azimuth/elevation (range, azimuth, elevation)  |
| [`drdcyl_c`](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/drdcyl_c.html) | Cartesian (x, y, z) from cylindrical (radius, longitude, z)             |
| [`drdgeo_c`](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/drdgeo_c.html) | Cartesian (x, y, z) from (geodetic longitude, latitude, altitude)       |
| [`drdlat_c`](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/drdlat_c.html) | Cartesian (x, y, z) from latitudinal (radius, longitude, latitude)      |
| [`drdpgr_c`](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/drdpgr_c.html) | Cartesian (x, y, z) from (planetographic longitude, latitude, altitude) |
| [`drdsph_c`](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/drdsph_c.html) | Cartesian (x, y, z) from spherical (radius, colatitude, longitude)      |
| [`dsphdr_c`](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dsphdr_c.html) | (radius, colatitude, longitude) from Cartesian (x, y, z)                |

## Numeric string conversion and marker replacement

| Raw method | CSPICE     | Scientific effect                                                                                                                                                 |
| ---------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dp2hx`    | `dp2hx_c`  | Encode a finite binary64 number in CSPICE normalized hex with its complete pre-truncation size.                                                                   |
| `hx2dp`    | `hx2dp_c`  | Parse a normalized hexadecimal mantissa and base-16 exponent, preserving the scientific conversion flag, full returned error prefix and successful numeric value. |
| `prsdp`    | `prsdp_c`  | Parse the CSPICE decimal grammar and PI mnemonic as a double.                                                                                                     |
| `prsint`   | `prsint_c` | Parse the CSPICE decimal grammar and truncate the result toward zero into a signed integer.                                                                       |
| `repmc`    | `repmc_c`  | Replace the first marker with a character value, trimming only significant ASCII-space padding in the scientific string operation.                                |
| `repmct`   | `repmct_c` | Replace the first marker with English cardinal words for a signed integer, preserving requested case.                                                             |
| `repmd`    | `repmd_c`  | Replace the first marker with a scientific-formatted double, honoring the pinned significant-digit range.                                                         |
| `repmf`    | `repmf_c`  | Replace the first marker with a scientific or fixed representation, retaining pinned formatting and scoped 56-byte internal width.                                |
| `repmi`    | `repmi_c`  | Replace the first marker with signed decimal integer text, including exact endpoints.                                                                             |
| `repml`    | `repml_c`  | Replace the first marker with a logical value in upper, lower or initial-capital case.                                                                            |
| `repmot`   | `repmot_c` | Replace the first marker with English ordinal words for a signed integer, preserving hyphenation and case.                                                        |

Caller buffer bounds, direct typed oracle signatures and binary64 saturation are described in the batch audit. [Numeric strings and marker replacement](step8-string-numbers.md)

## Ordinary set algebra

| Public raw method     | Direct toolkit entry point | Observation                                 |
| --------------------- | -------------------------- | ------------------------------------------- |
| `diff(a, b, result)`  | `diff_c`                   | Ordered difference in caller-owned storage. |
| `inter(a, b, result)` | `inter_c`                  | Complete ordered intersection.              |
| `sdiff(a, b, result)` | `sdiff_c`                  | Symmetric difference.                       |
| `union(a, b, result)` | `union_c`                  | Ordered union.                              |
| `set(a, op, b)`       | `set_c`                    | Boolean result for one of eight relations.  |
| `removc(item, cell)`  | `removc_c`                 | Remove a character member in place.         |
| `removd(item, cell)`  | `removd_c`                 | Remove an ordered double in place.          |
| `removi(item, cell)`  | `removi_c`                 | Remove a signed integer in place.           |
| `ordc(item, cell)`    | `ordc_c`                   | Character ordinal or −1.                    |
| `ordd(item, cell)`    | `ordd_c`                   | Double ordinal or −1.                       |
| `ordi(item, cell)`    | `ordi_c`                   | Integer ordinal or −1.                      |

Typed ordinary cell handles remain caller-owned. Capacity failures can write
a prefix while leaving the descriptor cardinality unchanged. [Cardinality, width and byte-level evidence](step8-set-algebra.md)
