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

  /**
   * Open a new physical CK for writing using a path or VirtualOutput. The internal name and reserved comment characters follow CSPICE. Read an owned virtual output after successful ckcls.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ckopn_c.html
   */
  ckopn(
    file: string | VirtualOutput,
    ifname: string,
    ncomch: number,
  ): SpiceHandle;

  /**
   * Close an owned CK writer. An empty writer signals NOSEGMENTSFOUND and remains usable for adding a segment and retrying.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ckcls_c.html
   */
  ckcls(handle: SpiceHandle): void;

  /**
   * Write discrete pointing samples at encoded SCLK ticks. Supply four contiguous scalar-first SPICE quaternion components per tick, giving reference-to-instrument rotations. With av=true supply three reference-frame radians/second values per sample. With av=false the AV array may be empty or contain the ignored triples.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ckw01_c.html
   */
  ckw01(
    handle: SpiceHandle,
    beg: number,
    end: number,
    inst: number,
    ref: string,
    av: boolean,
    segid: string,
    ticks: readonly number[],
    quats: readonly number[],
    avvs: readonly number[],
  ): void;

  /**
   * Write intervals of constant angular velocity with inclusive starts/stops in encoded ticks. Supply four contiguous SPICE quaternion components, three angular velocity components in the reference frame (radians/second), and one seconds-per-tick rate per interval. Each quaternion gives reference-to-instrument pointing at its start.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ckw02_c.html
   */
  ckw02(
    handle: SpiceHandle,
    beg: number,
    end: number,
    inst: number,
    ref: string,
    segid: string,
    starts: readonly number[],
    stops: readonly number[],
    quats: readonly number[],
    avvs: readonly number[],
    rates: readonly number[],
  ): void;

  /**
   * Write interpolated pointing with strictly ordered encoded sample ticks and separate interpolation interval starts. Supply flat scalar-first quaternion rows of four components and, with av=true, reference-frame angular velocity triples in radians/second. No interpolation spans a gap.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ckw03_c.html
   */
  ckw03(
    handle: SpiceHandle,
    beg: number,
    end: number,
    inst: number,
    ref: string,
    av: boolean,
    segid: string,
    ticks: readonly number[],
    quats: readonly number[],
    avvs: readonly number[],
    intervalStarts: readonly number[],
  ): void;

  /**
   * Write a type 5 segment with flat subtype-specific packets. Widths for subtypes 0, 1, 2, 3 are 8, 4, 14, 7. Packets contain q/dq, q, q/dq/AV/dAV, or q/AV respectively. Time derivatives are per second. The encoded tick rate is seconds per tick. Each interpolation interval starts at a sample tick, including the first packet. Degrees 1–23 are checked by CSPICE; use 3 modulo 4 for Hermite or odd degrees for Lagrange. The av flag controls eligibility for AV queries.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ckw05_c.html
   */
  ckw05(
    handle: SpiceHandle,
    subtype: number,
    degree: number,
    beg: number,
    end: number,
    inst: number,
    ref: string,
    av: boolean,
    segid: string,
    ticks: readonly number[],
    packets: readonly number[],
    rate: number,
    intervalStarts: readonly number[],
  ): void;

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
