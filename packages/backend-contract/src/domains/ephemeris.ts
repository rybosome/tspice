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
 * This is the opaque packed form returned by `spksfs`/`spkpds` and accepted by
 * `spkuds`. The first two words are TDB seconds; the remaining words contain
 * signed integer pairs, whose bits may represent subnormal numbers or NaNs.
 * Retain the returned readonly tuple: tspice preserves its exact packed storage
 * through its worker clients. JSON serialization or reconstructing numeric words
 * can discard that storage and corrupt integer fields; unpack before serialization.
 */
export type SpkPackedDescriptor = readonly [
  number,
  number,
  number,
  number,
  number,
];

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

/** Backend contract for SPK/ephemeris computations (positions, states, segment inspection). */
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
   * accumulation. An absent object produces no added intervals; an empty SPK
   * permits a zero-capacity window. Endpoints are TDB seconds past J2000.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/spkcov_c.html
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
   * avoid accumulation. Empty SPKs permit zero-capacity cells.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/spkobj_c.html
   */
  spkobj(spk: string, ids: SpiceIntCell): void;

  /**
   * Search loaded SPK files for the highest-priority segment applicable to `body` and `et`.
   *
   * Note: `handle` is the native SPICE DAF handle for the file containing the segment.
   */
  spksfs(
    body: number,
    et: number,
  ): Found<{ handle: number; descr: SpkPackedDescriptor; ident: string }>;

  /**
   * Pack an SPK descriptor (`spkpds_c`) with signed body/center IDs, a known frame,
   * type1..1000 and finite TDB endpoints `first < last`.
   *
   * The body must be nonzero and differ from center. The result contains the two
   * times and six packed integers (body,center,frame,type,zero addresses), not five
   * ordinary numerical measurements. See {@link SpkPackedDescriptor} for storage.
   * This permits descriptor type codes without adding their segment writers.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/spkpds_c.html
   */
  spkpds(
    body: number,
    center: number,
    frame: string,
    type: number,
    first: number,
    last: number,
  ): SpkPackedDescriptor;

  /**
   * Unpack all eight SPK descriptor fields (`spkuds_c`).
   *
   * CSPICE treats this as error-free: arbitrary bit patterns are not diagnosed
   * as scientifically invalid and may produce nonnormal time values. JS input
   * must still contain exactly five numeric words. Retain returned opaque tuples
   * rather than reconstructing potentially NaN-packed integer words.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/spkuds_c.html
   */
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
   *
   * `ifname` must be nonempty; CSPICE stores at most 60 ASCII characters.
   * `ncomch` is a signed 32-bit comment reservation; negative values mean zero.
   * The returned writer token belongs to this backend instance. Write at least
   * one segment before closing with `spkcls`.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/spkopn_c.html
   */
  spkopn(
    file: string | VirtualOutput,
    ifname: string,
    ncomch: number,
  ): SpiceHandle;

  /**
   * Open an existing SPK for append, with the same `file` semantics as `spkopn`.
   * A file already loaded for reading raises CSPICE FILEOPENCONFLICT; unload
   * it before opening for append. The returned writer token is backend-owned.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/spkopa_c.html
   */
  spkopa(file: string | VirtualOutput): SpiceHandle;

  /**
   * Close an SPK writer and invalidate its backend-owned token after success.
   * Closing an empty SPK raises NOSEGMENTSFOUND and retains the open writer;
   * write a valid segment and retry. A failed close does not invalidate the token.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/spkcls_c.html
   */
  spkcls(handle: SpiceHandle): void;

  /**
   * Write a type 8 SPK segment (see `spkw08_c`).
   *
   * `states` is a flat array with layout `[x,y,z, dx,dy,dz]` for each record.
   * The number of records `n` is derived as `states.length / 6`. Positions are
   * kilometers and velocities kilometers/second, relative to `center` in `frame`.
   * Samples are spaced by positive `step` seconds from `epoch1`; `first < last`
   * bounds the segment in TDB seconds past J2000 and must lie within the samples.
   * `degree` is 1..27 and requires at least `degree + 1` samples. `segid` contains
   * at most 40 printable ASCII characters, excluding trailing blanks. CSPICE
   * validates these scientific preconditions. The wrapper requires signed 32-bit
   * IDs/degree, finite numeric inputs and a state buffer of at most 256 MiB.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/spkw08_c.html
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
