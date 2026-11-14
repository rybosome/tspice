/**
 * Contract conventions:
 * - Inputs are assumed validated at the backend boundary; the contract itself is primarily type-level.
 * - Methods throw on invalid arguments or SPICE errors.
 * - Lookups that may legitimately miss return `Found<T>` (`{ found: false }`) instead of throwing.
 */
import type {
  SpiceHandle,
  VirtualOutput,
  Found,
  Mat3RowMajor,
  SpiceMatrix6x6,
  SpiceVector3,
} from "../shared/types.js";

import type { SpiceIntCell, SpiceWindow } from "./cells-windows.js";

/** Coverage detail level returned by {@link FramesApi.ckcov}. */
export type CkCoverageLevel = "SEGMENT" | "INTERVAL";

/** Time system used for coverage windows returned by {@link FramesApi.ckcov}. */
export type CkCoverageTimeSystem = "SCLK" | "TDB";

/** Backend contract for frame/name lookups, CK access, and frame transformations. */
export interface FramesApi {
  /**
   * Close an owned PCK writer and release its virtual output for readback. An empty writer signals NOSEGMENTSFOUND and remains open for a corrected write.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/pckcls_c.html
   */
  pckcls(handle: SpiceHandle): void;

  /**
   * Union the coverage of a binary PCK frame class ID into a caller-owned, normalized window. Endpoints are TDB seconds past J2000. An absent ID adds nothing. On WINDOWEXCESS the toolkit can leave partial intervals accessible through the window routines. Reset or free the window before reusing it.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/pckcov_c.html
   */
  pckcov(
    file: string | VirtualOutput,
    classId: number,
    cover: SpiceWindow,
  ): void;

  /**
   * Insert all frame class IDs from a binary PCK into the supplied integer set, retaining existing members. These are class IDs (e.g. 3000 for ITRF93). Capacity errors may leave partial storage. Reset the cardinality or free the set before reuse.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/pckfrm_c.html
   */
  pckfrm(file: string | VirtualOutput, ids: SpiceIntCell): void;

  /**
   * Load a binary PCK into the low-level orientation search and return an owner-local handle. Loading a file again promotes its priority. One unload removes the file regardless of repeated loads. Direct PCK loads share toolkit state with KEEPER. Coordinate their lifetimes when using both interfaces.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/pcklof_c.html
   */
  pcklof(file: string | VirtualOutput): SpiceHandle;

  /**
   * Create a binary PCK writer with an internal file name and reserved comment characters. Nonpositive reservations allocate no comments. Use a VirtualOutput for portable readback after successful close. A string addresses the native file system on Node or the virtual kernel namespace on WASM.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/pckopn_c.html
   */
  pckopn(
    file: string | VirtualOutput,
    ifname: string,
    ncomch: number,
  ): SpiceHandle;

  /**
   * Unload a binary PCK registered through pcklof. Lower-priority frame data becomes eligible again. The supplied handle belongs to this backend.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/pckuof_c.html
   */
  pckuof(handle: SpiceHandle): void;

  /**
   * Write one type 2 orientation segment for a frame class ID relative to a named inertial frame. first, last and btime are TDB seconds past J2000. Each of n equal records spans intlen seconds, starting at btime. Supply exactly 3 × (degree + 1) finite Chebyshev coefficients per record in Euler angle order (phi, delta, W), in radians. The rotation is [W]3 [delta]1 [phi]3. Degrees 0–41 fit the N0067 orientation reader. Coefficient buffers are limited to 256 MiB. Nonpositive n uses an empty coefficient array to expose the toolkit diagnostic. Roundoff in extreme time ranges must leave representable radii, epochs and record indices.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/pckw02_c.html
   */
  pckw02(
    handle: SpiceHandle,
    classId: number,
    frame: string,
    first: number,
    last: number,
    segid: string,
    intlen: number,
    n: number,
    degree: number,
    coefficients: readonly number[],
    btime: number,
  ): void;

  /**
   * Resolve a frame name; case and outer blanks are insignificant.
   * @param name Frame name; empty strings signal EMPTYSTRING.
   * @returns Frame code, or found:false for CSPICE's unknown-name code 0 sentinel.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/namfrm_c.html
   */
  namfrm(name: string): Found<{ code: number }>;
  /**
   * Resolve a signed int32 frame code, including loaded kernel definitions.
   * @returns Complete frame name (up to 32 characters), or found:false for an unknown ID.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/frmnam_c.html
   */
  frmnam(code: number): Found<{ name: string }>;

  /**
   * Resolve a center body's preferred frame, including `OBJECT_<id>_FRAME` overrides.
   * @param center Signed int32 body ID; unknown centers are normal misses.
   * @returns Preferred frame code/name, or found:false. The frame code differs from center ID.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/cidfrm_c.html
   */
  cidfrm(center: number): Found<{ frcode: number; frname: string }>;
  /**
   * Resolve a body name/alias to its preferred frame using current loaded mappings.
   * @param centerName Body name; case/outer blanks are insignificant. Empty input throws.
   * @returns Complete preferred frame code/name, or found:false for an unknown body.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/cnmfrm_c.html
   */
  cnmfrm(centerName: string): Found<{ frcode: number; frname: string }>;

  /**
   * Retrieve frame center, class and class ID for a signed int32 frame code.
   * @returns All three distinct fields, or found:false for an unknown frame.
   * Incomplete/malformed loaded definitions throw actual toolkit errors.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/frinfo_c.html
   */
  frinfo(
    frameId: number,
  ): Found<{ center: number; frameClass: number; classId: number }>;

  /**
   * Resolve signed int32 class/class-ID into frame code/name/center.
   * @returns Complete triple, or found:false for an unmatched pair. Class ID can differ
   * from frame code. Caller must avoid conflicting duplicate class/class-ID definitions.
   * Malformed matching frame metadata throws actual toolkit errors.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ccifrm_c.html
   */
  ccifrm(
    frameClass: number,
    classId: number,
  ): Found<{ frcode: number; frname: string; center: number }>;

  /**
   * Get CK pointing (`ckgp_c`) from reference coordinates to instrument coordinates.
   *
   * @param inst Signed instrument ID.
   * @param sclkdp Encoded spacecraft clock ticks, not ET seconds.
   * @param tol Search tolerance in encoded ticks; negative tolerance returns a miss.
   * @param ref Reference frame name.
   * @returns Found row-major 3x3 matrix and actual selected encoded `clkout`, or a miss.
   * Interpolation gaps and segment/file priority follow CSPICE. Real toolkit errors
   * (including no loaded CK files) remain errors, distinct from `found:false`.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ckgp_c.html
   */
  ckgp(
    inst: number,
    sclkdp: number,
    tol: number,
    ref: string,
  ): Found<{ cmat: Mat3RowMajor; clkout: number }>;

  /**
   * Get CK pointing and angular velocity (`ckgpav_c`).
   *
   * Inputs and the row-major matrix/encoded clock follow {@link FramesApi.ckgp}.
   * AV is instrument-relative-to-reference angular velocity, expressed in `ref`,
   * in radians/second. Only AV-bearing segments are eligible; no such segment is
   * a miss. All three AV components are returned only when `found:true`.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ckgpav_c.html
   */
  ckgpav(
    inst: number,
    sclkdp: number,
    tol: number,
    ref: string,
  ): Found<{ cmat: Mat3RowMajor; av: SpiceVector3; clkout: number }>;

  // --- CK file query / management (read-only) ------------------------------

  /**
   * Load a CK file for access by pointing routines (`cklpf_c`).
   *
   * @returns Actual numeric CK handle suitable for {@link FramesApi.ckupf}.
   * Reloading the same file returns its existing handle and raises its search
   * priority; this is not reference counting. CKLPF does not add a FURNSH table
   * entry. Native backends share process SPICE state; use process/worker isolation
   * for independent state. Handles are not portable between isolated states.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/cklpf_c.html
   */
  cklpf(ck: string): number;

  /**
   * Unload/close the physical CK loaded by {@link FramesApi.cklpf} (`ckupf_c`).
   * One unload removes a duplicate-load alias too; an unknown valid numeric
   * handle is a no-op. This public API accepts nonnegative signed-int32 handles.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ckupf_c.html
   */
  ckupf(handle: number): void;

  /**
   * Append every instrument ID present in `ck` to the supplied integer set (`ckobj_c`).
   * Existing IDs are preserved, sorted and deduplicated. No pointing load is needed.
   * Insufficient capacity signals SETEXCESS; zero capacity is valid for an empty CK.
   * The cell must be live and owned by the backend that allocated it.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ckobj_c.html
   */
  ckobj(ck: string, ids: SpiceIntCell): void;

  /**
   * Append CK coverage for `idcode` to a supplied live double window (`ckcov_c`).
   * SEGMENT returns segment bounds; INTERVAL respects interpolation gaps.
   * `needav` filters out segments without angular velocity. `tol` is nonnegative
   * encoded ticks for both time systems, expands coverage, and may merge intervals.
   * TDB output converts to ET seconds and requires spacecraft-clock coefficients.
   * Existing window intervals are unioned; missing objects yield no new intervals.
   * Capacity errors signal WINDOWEXCESS; output after a toolkit error is unspecified.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ckcov_c.html
   */
  ckcov(
    ck: string,
    idcode: number,
    needav: boolean,
    level: CkCoverageLevel,
    tol: number,
    timsys: CkCoverageTimeSystem,
    cover: SpiceWindow,
  ): void;

  /**
   * Map column position vectors from one frame to another at a finite ET.
   * @param et TDB ephemeris seconds past J2000; negative epochs are valid.
   * @returns All 9 row-major rotation entries. Unknown frames/missing orientation data throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/pxform_c.html
   */
  pxform(from: string, to: string, et: number): Mat3RowMajor;

  /**
   * Map position/velocity states from one frame to another at a finite TDB ET.
   * @param et Ephemeris seconds past J2000; derivative rates are per second.
   * @returns Mutable 36-element row-major tuple, with blocks [R,0;dR/dt,R].
   * Unknown frames/missing orientation data throw; every returned component is finite.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/sxform_c.html
   */
  sxform(from: string, to: string, et: number): SpiceMatrix6x6;
}
