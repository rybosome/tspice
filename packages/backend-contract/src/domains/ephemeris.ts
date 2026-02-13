/**
* Contract conventions:
* - Inputs are assumed validated at the backend boundary; the contract itself is primarily type-level.
* - Methods throw on invalid arguments or SPICE errors.
* - Lookups that may legitimately miss return `Found<T>` (`{ found: false }`) instead of throwing.
*/
import type {
  AbCorr,
  Found,
  SpiceHandle,
  SpiceStateVector,
  SpkezrResult,
  SpkposResult,
  VirtualOutput,
} from "../shared/types.js";
import type { SpiceIntCell, SpiceWindow } from "./cells-windows.js";

/**
 * Packed SPK segment descriptor (DAF summary) as a 5-double array.
 *
 * This is the packed form returned by `spksfs` and accepted by `spkuds`.
 */
export type SpkPackedDescriptor = readonly [number, number, number, number, number];

/** Unpacked SPK segment descriptor (see `spkuds_c`). */
export type SpkUnpackedDescriptor = {
  body: number;
  center: number;
  frame: number;
  type: number;

  first: number;
  last: number;

  baddr: number;
  eaddr: number;
};

export interface EphemerisApi {
  /**
   * Compute state relative to observer using loaded kernels (see `spkezr_c`).
   *
   * Note: `abcorr` is a known set of SPICE aberration correction strings, but we allow arbitrary
   * strings for forward-compatibility.
   */
  spkezr(
    target: string,
    et: number,
    ref: string,
    abcorr: AbCorr | string,
    observer: string,
  ): SpkezrResult;

  /**
   * Compute position relative to observer using loaded kernels (see `spkpos_c`).
   */
  spkpos(
    target: string,
    et: number,
    ref: string,
    abcorr: AbCorr | string,
    observer: string,
  ): SpkposResult;

  /** Compute state (6-vector) and light time via `spkez` (numeric IDs). */
  spkez(
    target: number,
    et: number,
    ref: string,
    abcorr: AbCorr | string,
    observer: number,
  ): SpkezrResult;

  /** Compute position (3-vector) and light time via `spkezp` (numeric IDs). */
  spkezp(
    target: number,
    et: number,
    ref: string,
    abcorr: AbCorr | string,
    observer: number,
  ): SpkposResult;

  /** Compute geometric state (6-vector) and light time via `spkgeo` (numeric IDs). */
  spkgeo(
    target: number,
    et: number,
    ref: string,
    observer: number,
  ): SpkezrResult;

  /** Compute geometric position (3-vector) and light time via `spkgps` (numeric IDs). */
  spkgps(
    target: number,
    et: number,
    ref: string,
    observer: number,
  ): SpkposResult;

  /** Compute state (6-vector) of `target` relative to the solar system barycenter via `spkssb`. */
  spkssb(target: number, et: number, ref: string): SpiceStateVector;

  /**
   * Compute the coverage window for an object in an SPK via `spkcov`.
   *
   * **Path semantics (backend-dependent):**
   * - Node backend: `spk` is a host filesystem path.
   * - WASM backend: `spk` is an Emscripten FS (virtual) path/id (typically the
   *   `path` you used in `furnsh({ path, bytes })`).
   *
   * **Output window requirements:** `cover` must be a valid, initialized window
   * handle created by the backend (e.g. `newWindow(maxIntervals)`) and must have
   * sufficient capacity for the merged output.
   *
   * **Error safety note:** Like CSPICE `spkcov_c`, if this routine throws while
   * updating `cover` (including due to insufficient capacity), the contents of
   * `cover` may be left in a corrupted/undefined state. If an error is thrown,
   * do **not** keep using `cover`; free it and create a fresh window.
   *
   * **Window semantics:** `cover` is updated in place. Like CSPICE `spkcov_c`,
   * coverage is **merged** with any intervals already present in `cover`.
   * Clear the window first (e.g. `scard(0, cover)`) if you want to avoid
   * accumulation.
   */
  spkcov(spk: string, idcode: number, cover: SpiceWindow): void;

  /**
   * Find the set of objects present in an SPK via `spkobj`.
   *
   * **Path semantics (backend-dependent):**
   * - Node backend: `spk` is a host filesystem path.
   * - WASM backend: `spk` is an Emscripten FS (virtual) path/id (typically the
   *   `path` you used in `furnsh({ path, bytes })`).
   *
   * **Output cell requirements:** `ids` must be a valid, initialized set cell
   * handle created by the backend (e.g. `newIntCell(size)`) and must have
   * sufficient capacity for the unioned output.
   *
   * **Error safety note:** Like CSPICE `spkobj_c`, if this routine throws while
   * updating `ids` (including due to insufficient capacity), the contents of
   * `ids` may be left in a corrupted/undefined state. If an error is thrown, do
   * **not** keep using `ids`; free it and create a fresh cell.
   *
   * **Cell semantics:** `ids` is updated in place. Like CSPICE `spkobj_c`, the
   * output is the **union** of the IDs already present in `ids` and the IDs
   * found in `spk`.
   * Clear the cell first (e.g. `scard(0, ids)`) if you want to
   * avoid accumulation.
   */
  spkobj(spk: string, ids: SpiceIntCell): void;

  /**
   * Search loaded SPK files for the highest-priority segment applicable to `body` and `et`.
   *
   * Note: `handle` is the native SPICE DAF handle for the file containing the segment.
   */
  spksfs(body: number, et: number): Found<{ handle: number; descr: SpkPackedDescriptor; ident: string }>;

  /** Pack an SPK segment descriptor via `spkpds`. */
  spkpds(
    body: number,
    center: number,
    frame: string,
    type: number,
    first: number,
    last: number,
  ): SpkPackedDescriptor;

  /** Unpack a packed SPK segment descriptor via `spkuds`. */
  spkuds(descr: SpkPackedDescriptor): SpkUnpackedDescriptor;

  // --- SPK writers ---------------------------------------------------------

  /**
   * Open a new SPK file for write (see `spkopn_c`).
   *
   * `file` interpretation is backend-dependent:
   * - Node: OS filesystem path
   * - WASM: virtual id under the backend's virtual filesystem (currently
   *   normalized into `/kernels/...`).
   *
   *   In other words, for the WASM backend, `file: string` is **not** a raw
   *   Emscripten absolute path. It is treated like other "kernel-ish" paths and
   *   is normalized into `/kernels`.
   *
   *   Examples (WASM backend):
   *   - `spkopn("out.bsp", ...)` writes to `/kernels/out.bsp`
   *   - `spkopn("/kernels/out.bsp", ...)` refers to the same file
   *   - `spkopn("/tmp/out.bsp", ...)` throws (OS paths/URLs are rejected)
   *
   * When `file` is a `VirtualOutput`, backends should allow reading bytes back
   * via `readVirtualOutput()` after closing the file handle.
   *
   * Callers should retain the `VirtualOutput` they passed to `spkopn`/`spkopa`.
   * It is the identifier used to read bytes back later.
   */
  spkopn(file: string | VirtualOutput, ifname: string, ncomch: number): SpiceHandle;

  /** Open an existing SPK for append (see `spkopa_c`). Same `file` semantics as `spkopn`. */
  spkopa(file: string | VirtualOutput): SpiceHandle;

  /** Close an SPK file previously opened by `spkopn`/`spkopa` (see `spkcls_c`). */
  spkcls(handle: SpiceHandle): void;

  /**
   * Write a type 8 SPK segment (see `spkw08_c`).
   *
   * `states` is a flat array with layout `[x,y,z, dx,dy,dz]` for each record.
   * The number of records `n` is derived as `states.length / 6`.
   */
  spkw08(
    handle: SpiceHandle,
    body: number,
    center: number,
    frame: string,
    first: number,
    last: number,
    segid: string,
    degree: number,
    states: readonly number[] | Float64Array,
    epoch1: number,
    step: number,
  ): void;
}
