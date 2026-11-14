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
   * Construct a right-handed orthonormal frame from x. Return the unitized x and both auxiliary vectors chosen by CSPICE. A zero input returns the standard Cartesian basis. The supplied array is unchanged.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/frame_c.html
   */
  frame(x: Readonly<SpiceVector3>): {
    x: SpiceVector3;
    y: SpiceVector3;
    z: SpiceVector3;
  };

  /**
   * Construct the row-major rotation into the frame defined by a principal axis and a principal plane. Distinct axes use X=1, Y=2, Z=3. Bad indices, equal indices and dependent directions are scientific errors.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/twovec_c.html
   */
  twovec(
    axdef: Readonly<SpiceVector3>,
    indexa: number,
    plndef: Readonly<SpiceVector3>,
    indexp: number,
  ): Mat3RowMajor;

  /**
   * Construct the row-major state transform into the frame defined by two position/velocity states. Axis numbers use X=1, Y=2, Z=3. Distinct indices and independent position directions are required. Velocity units are position units per unit time.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/twovxf_c.html
   */
  twovxf(
    axdef: Readonly<SpiceStateVector>,
    indexa: number,
    plndef: Readonly<SpiceStateVector>,
    indexp: number,
  ): SpiceMatrix6x6;

  /**
   * Build the state transform for passive Euler rotations about the supplied axes, in A, B, C product order. The first three components are radians and the last three their rates per unit time. Repeated valid adjacent axes are supported. The output has row-major blocks [R,0;dR/dt,R].
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/eul2xf_c.html
   */
  eul2xf(
    eulang: Readonly<SpiceStateVector>,
    axisa: number,
    axisb: number,
    axisc: number,
  ): SpiceMatrix6x6;

  /**
   * Factor a state transformation into three Euler angles in radians and their three rates per unit time. The middle axis must differ from both its neighbors. Preserve all six components when unique=false, including the toolkit singularity convention. The upper-left rotation and lower-left derivative blocks are consumed.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/xf2eul_c.html
   */
  xf2eul(
    xform: Readonly<SpiceMatrix6x6>,
    axisa: number,
    axisb: number,
    axisc: number,
  ): { eulang: SpiceStateVector; unique: boolean };

  /**
   * Extract the rotation into the destination frame and its angular velocity relative to the source, expressed in source-frame coordinates (radians per unit time). CSPICE uses the upper-left rotation and lower-left derivative blocks of the row-major state transform.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/xf2rav_c.html
   */
  xf2rav(xform: Readonly<SpiceMatrix6x6>): {
    rot: Mat3RowMajor;
    av: SpiceVector3;
  };

  /**
   * Construct a row-major state transform from the source-to-destination position rotation and angular velocity of the destination relative to the source, expressed in source-frame coordinates. The derivative block is below the rotation.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/rav2xf_c.html
   */
  rav2xf(rot: Mat3RowMajor, av: Readonly<SpiceVector3>): SpiceMatrix6x6;

  /**
   * Invert a rotation-derived state transform using transposes of its 3×3 blocks. The input must represent a state transformation for the result to be its inverse; CSPICE does not check that condition. The result preserves the exact block-transpose operation.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/invstm_c.html
   */
  invstm(mat: Readonly<SpiceMatrix6x6>): SpiceMatrix6x6;

  /**
   * Transpose an arbitrary finite 6×6 matrix in flat row-major order. Copy all 36 elements, including signed zeros, into a new mutable matrix.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/xpose6_c.html
   */
  xpose6(m1: Readonly<SpiceMatrix6x6>): SpiceMatrix6x6;

  /**
   * Map position/velocity states from one frame to another at a finite TDB ET.
   * @param et Ephemeris seconds past J2000; derivative rates are per second.
   * @returns Mutable 36-element row-major tuple, with blocks [R,0;dR/dt,R].
   * Unknown frames/missing orientation data throw; every returned component is finite.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/sxform_c.html
   */
  sxform(from: string, to: string, et: number): SpiceMatrix6x6;
}
