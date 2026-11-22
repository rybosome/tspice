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

  /** Rotation from CK frame class ID inst to the selected segment base frame at ET seconds past J2000. Returns its row-major matrix and reference frame ID, or found:false when pointing or clock data are unavailable. Segment priority and exact-time search follow CSPICE. A loaded CK cannot use a clock ID of −2147483648 because N0067 negates it.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ckfrot_c.html */
  ckfrot(
    inst: number,
    et: number,
  ): Found<{ rotate: Mat3RowMajor; ref: number }>;
  /** State transformation from CK frame class ID inst to the returned segment base frame at ET seconds past J2000. The 36 row-major entries include a lower-left derivative block in inverse seconds; arithmetic at extreme angular velocities may yield IEEE nonfinite values. Only segments containing angular velocity are eligible. Clock, priority and genuine absence follow ckfrot.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ckfxfm_c.html */
  ckfxfm(
    inst: number,
    et: number,
  ): Found<{ xform: SpiceMatrix6x6; ref: number }>;
  /** Read a one-based record of an authenticated type 2 segment on a live owned DAF handle. start/stop are encoded SCLK ticks; rate is seconds per tick. The scalar-first SPICE quaternion rotates reference to instrument; angular velocity is in reference-frame radians/second. All returned fields are copies.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ckgr02_c.html */
  ckgr02(
    handle: SpiceHandle,
    descr: Uint8Array,
    recno: number,
  ): {
    start: number;
    stop: number;
    rate: number;
    quaternion: [number, number, number, number];
    av: SpiceVector3;
  };
  /** Read a one-based type 3 record from an authenticated segment on a live owned DAF handle. sclkdp is encoded ticks. The scalar-first reference-to-instrument quaternion is followed by reference-frame angular velocity (radians/second) when stored; av is null for a segment without angular velocity.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ckgr03_c.html */
  ckgr03(
    handle: SpiceHandle,
    descr: Uint8Array,
    recno: number,
  ): {
    sclkdp: number;
    quaternion: [number, number, number, number];
    av: SpiceVector3 | null;
  };
  /** Resolve a CK frame class ID’s SCLK or SPK ID from kernel-pool overrides or the conventional spacecraft code. The zero default for IDs above −1000 is an actual result. The selector is NUL-free text; unrecognized selectors raise toolkit errors.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ckmeta_c.html */
  ckmeta(ckid: number, meta: string): number;
  /** Count type 2 pointing intervals. Supply exactly 40 native-order packed descriptor bytes matching an actual segment in this owned CK DAF. A retained copy remains usable as the search moves. Wrong segment type raises CKWRONGDATATYPE.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/cknr02_c.html */
  cknr02(handle: SpiceHandle, descr: Uint8Array): number;
  /** Count type 3 discrete pointing records across all interpolation intervals. Supply the same owned CK DAF handle and exact packed segment descriptor as cknr02. Reads preserve the current DAF search cursor.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/cknr03_c.html */
  cknr03(handle: SpiceHandle, descr: Uint8Array): number;

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
