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

| domain.method                       | CSPICE entrypoint(s)  | Args (TS shape)                                          | Returns (TS shape) | Comparison notes (tolerance/normalization)                                   | Statefulness / required kernels                                                                                                       |
| ----------------------------------- | --------------------- | -------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `time.spiceVersion()`               | `tkvrsn_c("TOOLKIT")` | `(): string`                                             | `string`           | exact string match                                                           | none                                                                                                                                  |
| `time.tkvrsn(item)`                 | `tkvrsn_c`            | `(item: "TOOLKIT"): string`                              | `string`           | exact string match                                                           | none                                                                                                                                  |
| `time.str2et(time)`                 | `str2et_c`            | `(time: string): number`                                 | `number`           | floating compare (ET seconds)                                                | **stateful**: uses TIMDEF defaults (SYSTEM/CALENDAR/ZONE); requires LSK (`*.tls`); may depend on loaded time constants in kernel pool |
| `time.et2utc(et, format, prec)`     | `et2utc_c`            | `(et: number, format: string, prec: number): string`     | `string`           | exact string match (format-dependent)                                        | requires LSK (`*.tls`)                                                                                                                |
| `time.timout(et, picture)`          | `timout_c`            | `(et: number, picture: string): string`                  | `string`           | exact string match (picture-dependent)                                       | requires LSK (`*.tls`) for many pictures                                                                                              |
| `time.deltet(epoch, eptype)`        | `deltet_c`            | `(epoch: number, eptype: "ET"                            | "UTC"): number`    | `number`                                                                     | floating compare (seconds)                                                                                                            | requires LSK (`*.tls`) |
| `time.unitim(epoch, insys, outsys)` | `unitim_c`            | `(epoch: number, insys: string, outsys: string): number` | `number`           | floating compare (seconds)                                                   | requires LSK (`*.tls`)                                                                                                                |
| `time.tparse(timstr)`               | `tparse_c`            | `(timstr: string): number`                               | `number`           | floating compare (UTC seconds past J2000; formal calendar / no leap seconds) | stateless; UTC-only (rejects time system/zone labels); no kernels                                                                     |
| `time.tpictr(sample, pictur)`       | `tpictr_c`            | `(sample: string, pictur: string): string`               | `string`           | exact string match                                                           | **stateful**: interprets sample using TIMDEF defaults; no kernels                                                                     |
| `time.timdef(action, item, value?)` | `timdef_c`            | overload: `("GET", item)` / `("SET", item, value)`       | `string` / `void`  | exact string match for `GET`                                                 | stateful (mutates time conversion defaults); no kernels                                                                               |
| `time.scs2e(sc, sclkch)`            | `scs2e_c`             | `(sc: number, sclkch: string): number`                   | `number`           | floating compare (ET seconds)                                                | requires SCLK kernel (`*.tsc`) for `sc`; typically also needs LSK                                                                     |
| `time.sce2s(sc, et)`                | `sce2s_c`             | `(sc: number, et: number): string`                       | `string`           | exact string match                                                           | requires SCLK kernel (`*.tsc`) for `sc`; typically also needs LSK                                                                     |
| `time.scencd(sc, sclkch)`           | `scencd_c`            | `(sc: number, sclkch: string): number`                   | `number`           | floating compare (ticks)                                                     | requires SCLK kernel (`*.tsc`) for `sc`                                                                                               |
| `time.scdecd(sc, sclkdp)`           | `scdecd_c`            | `(sc: number, sclkdp: number): string`                   | `string`           | exact string match                                                           | requires SCLK kernel (`*.tsc`) for `sc`                                                                                               |
| `time.sct2e(sc, sclkdp)`            | `sct2e_c`             | `(sc: number, sclkdp: number): number`                   | `number`           | floating compare (ET seconds)                                                | requires SCLK kernel (`*.tsc`) for `sc`; often also needs LSK                                                                         |
| `time.sce2c(sc, et)`                | `sce2c_c`             | `(sc: number, et: number): number`                       | `number`           | floating compare (ticks)                                                     | requires SCLK kernel (`*.tsc`) for `sc`; often also needs LSK                                                                         |

Notes:

- `spiceVersion()` is a convenience alias; the contract also exposes `tkvrsn("TOOLKIT")` explicitly.

- Many time routines (notably `str2et`, `timout`, and `tpictr`) depend on TIMDEF defaults (SYSTEM/CALENDAR/ZONE). These defaults are global mutable state in CSPICE; tests should snapshot/restore if they change them to avoid order dependence.

---

## Domain: `ids-names` (`IdsNamesApi`)

| domain.method            | CSPICE entrypoint(s) | Args (TS shape)                           | Returns (TS shape)        | Comparison notes (tolerance/normalization) | Statefulness / required kernels                                                                                                     |
| ------------------------ | -------------------- | ----------------------------------------- | ------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `ids-names.bodn2c(name)` | `bodn2c_c`           | `(name: string): Found<{ code: number }>` | `Found<{ code: number }>` | exact integer match                        | requires kernels defining body names/IDs (commonly PCK/SPK and/or mission kernels); “not found” is reported via `found` output flag |
| `ids-names.bodc2n(code)` | `bodc2n_c`           | `(code: number): Found<{ name: string }>` | `Found<{ name: string }>` | exact string match                         | requires kernels defining body names/IDs; “not found” is reported via `found` output flag                                           |

---

## Domain: `frames` (`FramesApi`)

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

## Domain: `coords-vectors` (`CoordsVectorsApi`)

`rotate` and `rotmat` preserve CSPICE's modulo-three axis mapping (including zero/negative integers); their typed adapters reject fractional, non-finite, or overflowing JS axes before conversion. Matrices are row-major. `rotate`/`rotmat` use passive coordinate rotation, while `axisar` returns an active vector rotation. The audit includes noncommuting matrix products, both vector multiplication directions, coordinate poles/zero inputs, and oblate/prolate geodetic conversions.

Most routines in this domain are **pure math** and require no kernels.

| domain.method                                 | CSPICE entrypoint(s) | Args (TS shape)                                                  | Returns (TS shape)                               | Comparison notes (tolerance/normalization)     | Statefulness / required kernels                                                       |
| --------------------------------------------- | -------------------- | ---------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| `coords-vectors.reclat(rect)`                 | `reclat_c`           | `(rect: SpiceVector3)`                                           | `{ radius: number; lon: number; lat: number }`   | float tolerance; angles radians                | none                                                                                  |
| `coords-vectors.latrec(radius, lon, lat)`     | `latrec_c`           | `(radius: number, lon: number, lat: number)`                     | `SpiceVector3`                                   | float tolerance                                | none                                                                                  |
| `coords-vectors.recsph(rect)`                 | `recsph_c`           | `(rect: SpiceVector3)`                                           | `{ radius: number; colat: number; lon: number }` | float tolerance; angles radians                | none                                                                                  |
| `coords-vectors.sphrec(radius, colat, lon)`   | `sphrec_c`           | `(radius: number, colat: number, lon: number)`                   | `SpiceVector3`                                   | float tolerance                                | none                                                                                  |
| `coords-vectors.vnorm(v)`                     | `vnorm_c`            | `(v: SpiceVector3)`                                              | `number`                                         | float tolerance                                | none                                                                                  |
| `coords-vectors.vhat(v)`                      | `vhat_c`             | `(v: SpiceVector3)`                                              | `SpiceVector3`                                   | float tolerance                                | none; **zero-vector behavior:** returns `[0,0,0]` without throwing (matches `vhat_c`) |
| `coords-vectors.vdot(a, b)`                   | `vdot_c`             | `(a: SpiceVector3, b: SpiceVector3)`                             | `number`                                         | float tolerance                                | none                                                                                  |
| `coords-vectors.vcrss(a, b)`                  | `vcrss_c`            | `(a: SpiceVector3, b: SpiceVector3)`                             | `SpiceVector3`                                   | float tolerance                                | none                                                                                  |
| `coords-vectors.vadd(a, b)`                   | `vadd_c`             | `(a: SpiceVector3, b: SpiceVector3)`                             | `SpiceVector3`                                   | float tolerance                                | none                                                                                  |
| `coords-vectors.vsub(a, b)`                   | `vsub_c`             | `(a: SpiceVector3, b: SpiceVector3)`                             | `SpiceVector3`                                   | float tolerance                                | none                                                                                  |
| `coords-vectors.vminus(v)`                    | `vminus_c`           | `(v: SpiceVector3)`                                              | `SpiceVector3`                                   | float tolerance                                | none                                                                                  |
| `coords-vectors.vscl(s, v)`                   | `vscl_c`             | `(s: number, v: SpiceVector3)`                                   | `SpiceVector3`                                   | float tolerance                                | none                                                                                  |
| `coords-vectors.mxm(a, b)`                    | `mxm_c`              | `(a: Mat3RowMajor, b: Mat3RowMajor)`                             | `Mat3RowMajor`                                   | float tolerance                                | none                                                                                  |
| `coords-vectors.rotate(angle, axis)`          | `rotate_c`           | `(angle: number, axis: number)`                                  | `Mat3RowMajor`                                   | float tolerance; angle radians; axis ∈ {1,2,3} | none                                                                                  |
| `coords-vectors.rotmat(m, angle, axis)`       | `rotmat_c`           | `(m: Mat3RowMajor, angle: number, axis: number)`                 | `Mat3RowMajor`                                   | float tolerance                                | none                                                                                  |
| `coords-vectors.axisar(axis, angle)`          | `axisar_c`           | `(axis: SpiceVector3, angle: number)`                            | `Mat3RowMajor`                                   | float tolerance                                | none                                                                                  |
| `coords-vectors.georec(lon, lat, alt, re, f)` | `georec_c`           | `(lon: number, lat: number, alt: number, re: number, f: number)` | `SpiceVector3`                                   | float tolerance; angles radians                | none                                                                                  |
| `coords-vectors.recgeo(rect, re, f)`          | `recgeo_c`           | `(rect: SpiceVector3, re: number, f: number)`                    | `{ lon: number; lat: number; alt: number }`      | float tolerance; angles radians                | none                                                                                  |
| `coords-vectors.mxv(m, v)`                    | `mxv_c`              | `(m: Mat3RowMajor, v: SpiceVector3)`                             | `SpiceVector3`                                   | float tolerance                                | none                                                                                  |
| `coords-vectors.mtxv(m, v)`                   | `mtxv_c`             | `(m: Mat3RowMajor, v: SpiceVector3)`                             | `SpiceVector3`                                   | float tolerance                                | none                                                                                  |

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

## Domain: `file-io` readers (`FileIoApi`)

| Raw method       | Actual CSPICE route        | Semantic observations                                                                                                |
| ---------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `dafopr(path)`   | `dafopr_c`                 | Backend-owned opaque token; duplicate native read claims share a file/search state.                                  |
| `dafcls(handle)` | `dafcls_c`                 | Release one read claim; public tokens close once and are rejected after close.                                       |
| `dafbfs(handle)` | `dafbfs_c`                 | Start/restart search; authored two-segment and empty files distinguish its effect.                                   |
| `daffna(handle)` | `dafcs_c` then `daffna_c`  | Select the file before each global next operation; compare interleaved true/false sequences, exhaustion and restart. |
| `dasopr(path)`   | `dasopr_c`                 | Open DAS/DLA/DSK for read; close-one/retain-another claims and real wrong-format/missing-file errors.                |
| `dascls(handle)` | `dascls_c`                 | Finalize DAS/DLA output and release read claims; reopening proves a valid flushed empty DLA.                         |
| `dlabfs(handle)` | `dlabfs_c`                 | Return a miss or all eight signed-integer descriptor fields, valid only on a hit.                                    |
| `dlacls(handle)` | tspice alias of `dascls_c` | Same DAS/DLA ownership/close behavior. N0067 has no separate `dlacls_c` C entrypoint.                                |

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
