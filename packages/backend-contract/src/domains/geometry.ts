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
   * Construct a plane through point from a finite nonzero normal. CSPICE unitizes the normal and reverses its direction when needed for a nonnegative distance constant. A zero normal signals ZEROVECTOR.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/nvp2pl_c.html
   */
  nvp2pl(
    normal: Readonly<SpiceVector3>,
    point: Readonly<SpiceVector3>,
  ): SpicePlane;

  /**
   * Extract the stored unit normal and the closest point to the origin from a finite CSPICE plane. The input plane must have its canonical unit normal and nonnegative constant.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/pl2nvp_c.html
   */
  pl2nvp(plane: Readonly<SpicePlane>): {
    normal: SpiceVector3;
    point: SpiceVector3;
  };

  /**
   * Return the closest point to the origin and the ordered orthonormal spanning vectors chosen by CSPICE for this finite canonical plane. The normal, span1 and span2 form a right-handed system.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/pl2psv_c.html
   */
  pl2psv(plane: Readonly<SpicePlane>): {
    point: SpiceVector3;
    span1: SpiceVector3;
    span2: SpiceVector3;
  };

  /**
   * Construct a plane through a point and two spanning vectors. A computed zero cross product signals DEGENERATECASE. Nearly parallel vectors can amplify floating-point roundoff when their cross product is unitized.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/psv2pl_c.html
   */
  psv2pl(
    point: Readonly<SpiceVector3>,
    span1: Readonly<SpiceVector3>,
    span2: Readonly<SpiceVector3>,
  ): SpicePlane;

  /**
   * Intersect a ray with a finite canonical plane. Return nxpts = -1 for a contained ray, 0 for a miss, or 1 for a single intersection. xpt is the vertex for a contained ray and the zero vector for a miss. CSPICE rejects a zero direction or a vertex norm or plane distance at least DPMAX/3.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/inrypl_c.html
   */
  inrypl(
    vertex: Readonly<SpiceVector3>,
    dir: Readonly<SpiceVector3>,
    plane: Readonly<SpicePlane>,
  ): { nxpts: -1 | 0 | 1; xpt: SpiceVector3 };

  /**
   * Orthogonally project vin onto a finite canonical plane. Its supplied normal must be unit length. Finite inputs can produce nonfinite components when intermediate products or sums overflow.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vprjp_c.html
   */
  vprjp(vin: Readonly<SpiceVector3>, plane: Readonly<SpicePlane>): SpiceVector3;

  /**
   * Find the point on invpl whose orthogonal projection onto projpl is vin. Supply finite canonical planes and vin in projpl. CSPICE reports found=false for an undefined or excessively large inverse displacement, including perpendicular plane normals. Only a hit has a vout.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vprjpi_c.html
   */
  vprjpi(
    vin: Readonly<SpiceVector3>,
    projpl: Readonly<SpicePlane>,
    invpl: Readonly<SpicePlane>,
  ): Found<{ vout: SpiceVector3 }>;

  /**
   * Return the nearest point on the infinite line and its distance from point, in the coordinate units of the inputs. A zero line direction signals ZEROVECTOR. Preserve the toolkit’s IEEE results at finite arithmetic extremes.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/nplnpt_c.html
   */
  nplnpt(
    linpt: Readonly<SpiceVector3>,
    lindir: Readonly<SpiceVector3>,
    point: Readonly<SpiceVector3>,
  ): { pnear: SpiceVector3; dist: number };

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
