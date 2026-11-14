/**
 * Contract conventions:
 * - Inputs are assumed validated at the backend boundary; the contract itself is primarily type-level.
 * - Methods throw on invalid arguments or SPICE errors.
 * - Lookups that may legitimately miss return `Found<T>` (`{ found: false }`) instead of throwing.
 */
import type {
  Found,
  Mat3RowMajor,
  SpiceMatrix6x6,
  SpiceStateVector,
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
   * Replace the contents of a live caller-owned integer cell with sorted built-in frame IDs.
   * Classes 1 through 6 select a class and −1 selects all. N0067 requires capacity
   * 145 for any class, including a class with no built-in frames. Loaded FK definitions
   * are excluded. After an error reset cardinality before reusing the cell.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/bltfrm_c.html
   */
  bltfrm(frameClass: number, ids: SpiceIntCell): void;

  /**
   * Map positions from the source frame at etfrom to the destination frame at etto
   * in TDB seconds past J2000. Even one rotating frame can yield a nonidentity
   * transform between epochs. Both legs need orientation coverage at their own epoch.
   * Returns all nine row-major elements. Missing orientation or unknown names throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/pxfrm2_c.html
   */
  pxfrm2(from: string, to: string, etfrom: number, etto: number): Mat3RowMajor;

  /**
   * Transform an inertial position to the equator and prime meridian of a PCK body
   * at ET (TDB seconds past J2000). The reference must be a supported inertial frame.
   * The signed body argument identifies the PCK class ID; the signed minimum is outside
   * the toolkit hash range. The caller supplies valid PCK data for this epoch.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/tipbod_c.html
   */
  tipbod(ref: string, body: number, et: number): Mat3RowMajor;

  /**
   * Transform inertial position and velocity into PCK body-fixed coordinates at ET.
   * Return all 36 row-major elements of [R,0;dR/dt,R] with derivative per second.
   * The body is a PCK class ID. The reference, orientation coverage and minimum-ID
   * restriction follow tipbod. PCK coefficients must be valid for the requested epoch.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/tisbod_c.html
   */
  tisbod(ref: string, body: number, et: number): SpiceMatrix6x6;

  /**
   * Look up a fixed TK rotation by its signed class ID, which can differ from its
   * frame ID. The rotation maps TK coordinates to the returned base frame ID.
   * N0067 signals errors for incomplete, unknown or zero IDs. A successful found
   * flag controls payload availability. The signed minimum exceeds the hash range.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/tkfram_c.html
   */
  tkfram(typeId: number): Found<{ rot: Mat3RowMajor; frame: number }>;

  /**
   * Convert a six-component coordinate state, including its three rates. The
   * systems are RECTANGULAR (x,y,z), CYLINDRICAL (r,lon,z), LATITUDINAL
   * (r,lon,lat), SPHERICAL (r,colat,lon), GEODETIC and PLANETOGRAPHIC (lon,lat,alt).
   * Units are km, radians and rates per second. Unequal systems involving a spheroid
   * require body radii with equal equatorial axes; planetographic longitude also
   * depends on the body rotation convention. Equal systems copy the input. For
   * other systems use a blank body string. An empty string signals EMPTYSTRING.
   * Transverse velocity on the polar axis can signal INVALIDSTATE.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/xfmsta_c.html
   */
  xfmsta(
    state: Readonly<SpiceStateVector>,
    from: string,
    to: string,
    body: string,
  ): SpiceStateVector;

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
