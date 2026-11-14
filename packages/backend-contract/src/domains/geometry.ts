/**
 * Contract conventions:
 * - Inputs are assumed validated at the backend boundary; the contract itself is primarily type-level.
 * - Methods throw on invalid arguments or SPICE errors.
 * - Lookups that may legitimately miss return `Found<T>` (`{ found: false }`) instead of throwing.
 */
import type {
  AbCorr,
  Found,
  IllumfResult,
  IllumgResult,
  IluminResult,
  Pl2nvcResult,
  SpicePlane,
  SubPointResult,
  SpiceVector3,
} from "../shared/types.js";

/** Backend contract for common SPICE geometry computations (subpoints, intercepts, illumination, etc). */
export interface GeometryApi {
  /** Map planetocentric longitude/latitude pairs in radians to target-frame surface points in km at ET (TDB). Select the reference ellipsoid or the outermost intercept on the requested DSK surfaces. Empty grids still perform the toolkit input checks.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/latsrf_c.html */
  latsrf(
    method: string,
    target: string,
    et: number,
    fixref: string,
    lonlat: readonly (readonly [number, number])[],
  ): SpiceVector3[];
  /** Compute outward unit normals for target-frame surface points in km. Ellipsoid normals follow the triaxial gradient; DSK normals at an edge or vertex can be non-unique and use the runtime point-membership margin.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/srfnrm_c.html */
  srfnrm(
    method: string,
    target: string,
    et: number,
    fixref: string,
    srfpts: readonly Readonly<SpiceVector3>[],
  ): SpiceVector3[];
  /** Find limb points on angular cuts about the target-observer line. The staged N0067 routine checks remaining cumulative capacity before writing each cut. Return each cut count, including zero, with dense target-fixed points and observer-to-point vectors in km and target epochs in TDB seconds. Roll, search step and solution tolerance are radians.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/limbpt_c.html */
  limbpt(
    method: string,
    target: string,
    et: number,
    fixref: string,
    abcorr: AbCorr | string,
    corloc: string,
    observer: string,
    refvec: Readonly<SpiceVector3>,
    rolstp: number,
    ncuts: number,
    schstp: number,
    soltol: number,
    maxn: number,
  ): {
    npts: number[];
    points: SpiceVector3[];
    epochs: number[];
    tangts: SpiceVector3[];
  };
  /** Find umbral or penumbral terminator points on angular cuts about the target-source line. N0067 can signal OUTOFROOM early for multi-point cuts. Return each cut count, including zero, with dense target-fixed points and observer-to-point vectors in km and target epochs in TDB seconds. Roll, search step and solution tolerance are radians.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/termpt_c.html */
  termpt(
    method: string,
    ilusrc: string,
    target: string,
    et: number,
    fixref: string,
    abcorr: AbCorr | string,
    corloc: string,
    observer: string,
    refvec: Readonly<SpiceVector3>,
    rolstp: number,
    ncuts: number,
    schstp: number,
    soltol: number,
    maxn: number,
  ): {
    npts: number[];
    points: SpiceVector3[];
    epochs: number[];
    trmvcs: SpiceVector3[];
  };

  /**
   * Compute the sub-observer point using nearest/radial ellipsoid or nadir/radial DSK geometry.
   * Returns the complete target-fixed point and observer-to-point vector (km),
   * and the target surface epoch in TDB seconds past J2000. `et` must be finite;
   * reception/transmission corrections use ET minus/plus surface light time.
   * DSK nadir follows the line to the nearest reference-ellipsoid point.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/subpnt_c.html
   */
  subpnt(
    method: string,
    target: string,
    et: number,
    fixref: string,
    abcorr: AbCorr | string,
    observer: string,
  ): SubPointResult;

  /**
   * Compute the sub-solar point using nearest/radial ellipsoid or nadir/radial DSK geometry.
   * Returns target-fixed point/vector in km and target surface TDB epoch.
   * Supports geometric and reception corrections; transmission is unsupported.
   * Sun ephemerides are required. CSPICE permits observer at the target center.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/subslr_c.html
   */
  subslr(
    method: string,
    target: string,
    et: number,
    fixref: string,
    abcorr: AbCorr | string,
    observer: string,
  ): SubPointResult;

  /**
   * Compute the closest forward ray intercept with the ellipsoid or selected DSK.
   * `dvec` is a finite three-vector expressed in `dref`; it need not be unit.
   * A true miss returns `{found:false}`. Zero directions and toolkit errors
   * remain errors. A hit returns the target-fixed point/vector in km and
   * target surface TDB epoch for the finite observer ET/correction.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/sincpt_c.html
   */
  sincpt(
    method: string,
    target: string,
    et: number,
    fixref: string,
    abcorr: AbCorr | string,
    observer: string,
    dref: string,
    dvec: SpiceVector3,
  ): Found<SubPointResult>;

  /**
   * Compute solar phase/incidence/emission angles (radians in [0,pi]),
   * target surface TDB epoch and observer-to-point vector (km). `spoint` is
   * a finite target-fixed three-vector. A DSK point must lie on a smooth facet;
   * normals at ridges/vertices are undefined. `et` must be finite.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ilumin_c.html
   */
  ilumin(
    method: string,
    target: string,
    et: number,
    fixref: string,
    abcorr: AbCorr | string,
    observer: string,
    spoint: SpiceVector3,
  ): IluminResult;

  /**
   * Compute illumination angles at a surface point, with a caller-specified
   * illumination source body. Returns all three angles in radians, target
   * surface TDB epoch and observer-to-point vector in km. Supply finite ET
   * and a finite target-fixed point; DSK normals require a facet interior.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/illumg_c.html
   */
  illumg(
    method: string,
    target: string,
    ilusrc: string,
    et: number,
    fixref: string,
    abcorr: AbCorr | string,
    observer: string,
    spoint: SpiceVector3,
  ): IllumgResult;

  /**
   * Compute general-source illumination angles, target epoch/vector and
   * independent visibility/lighting flags. Flags include obstruction and shadow.
   * Angles are radians and vector components km; ET and point must be finite.
   * DSK normals at ridges/vertices are undefined. Pinned CSPICE N0067 parses
   * surface lists but uses all target DSK surfaces for this computation.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/illumf_c.html
   */
  illumf(
    method: string,
    target: string,
    ilusrc: string,
    et: number,
    fixref: string,
    abcorr: AbCorr | string,
    observer: string,
    spoint: SpiceVector3,
  ): IllumfResult;

  /**
   * Return occultation code -3..3: negative means the first target is occulted,
   * positive the second; magnitude1/2/3 means partial/annular/total, zero none.
   * Ellipsoid, point and supported DSK shapes use loaded geometry at finite
   * TDB `et`. An ignored point-frame string must still be nonempty.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/occult_c.html
   */
  occult(
    targ1: string,
    shape1: string,
    frame1: string,
    targ2: string,
    shape2: string,
    frame2: string,
    abcorr: AbCorr | string,
    observer: string,
    et: number,
  ): number;

  /**
   * Construct a canonical plane for dot(x,normal)=konst. The finite nonzero
   * normal need not be unit; the result has a unit normal and nonnegative
   * distance constant. A negative input constant reverses orientation. Zero
   * normal raises ZEROVECTOR. CSPICE does not guard arithmetic overflow.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/nvc2pl_c.html
   */
  nvc2pl(normal: SpiceVector3, konst: number): SpicePlane;

  /**
   * Extract the unit normal and nonnegative distance constant of a valid
   * CSPICE-created plane, such as the result of `nvc2pl`. This routine is
   * scientifically error-free under that precondition; it does not validate
   * malformed plane geometry. JS shape/type/finite checks remain separate.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/pl2nvc_c.html
   */
  pl2nvc(plane: SpicePlane): Pl2nvcResult;
}
