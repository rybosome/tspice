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
  SpiceEllipse,
  SpiceEllipseInput,
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
   * Construct an ellipse from its center and two generating vectors. The computed semi-axes are orthogonal and ordered by length. Collinear or zero generators may produce a segment or point. Axis signs and equal-length orientations follow CSPICE.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/cgv2el_c.html
   */
  cgv2el(
    center: Readonly<SpiceVector3>,
    vec1: Readonly<SpiceVector3>,
    vec2: Readonly<SpiceVector3>,
  ): SpiceEllipse;

  /**
   * Extract the stored center, semi-major and semi-minor vectors from an ellipse. CSPICE copies these fields directly, including zeros and signs. The returned arrays are independent.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/el2cgv_c.html
   */
  el2cgv(ellipse: SpiceEllipseInput): {
    center: SpiceVector3;
    smajor: SpiceVector3;
    sminor: SpiceVector3;
  };

  /**
   * Compute the ordered semi-axes of the ellipse generated by two finite vectors. Degenerate inputs can return zero axes. Equal-length axes have a nonunique geometric orientation. Results retain CSPICE signs and finite-input IEEE overflow.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/saelgv_c.html
   */
  saelgv(
    vec1: Readonly<SpiceVector3>,
    vec2: Readonly<SpiceVector3>,
  ): { smajor: SpiceVector3; sminor: SpiceVector3 };

  /**
   * Orthogonally project an ellipse onto the supplied finite canonical plane. Projection may yield a segment or point. CSPICE projects the center and regenerates ordered axes from the projected directions.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/pjelpl_c.html
   */
  pjelpl(ellipse: SpiceEllipseInput, plane: Readonly<SpicePlane>): SpiceEllipse;

  /**
   * Intersect an origin-centered triaxial ellipsoid with a finite canonical plane. Nonpositive radii signal DEGENERATECASE. An empty intersection returns found=false; exact tangency can return a point ellipse with found=true. Near tangency is sensitive to rounding.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/inedpl_c.html
   */
  inedpl(
    a: number,
    b: number,
    c: number,
    plane: Readonly<SpicePlane>,
  ): Found<{ ellipse: SpiceEllipse }>;

  /**
   * Intersect an ellipse with a canonical plane. A contained non-point ellipse returns nxpts=-1 and a miss returns 0. One or two intersections return both toolkit point vectors in order, including their individual roundoff at a single intersection. Malformed plane or nonorthogonal ellipse axes can signal INVALIDPLANE or INVALIDELLIPSE.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/inelpl_c.html
   */
  inelpl(
    ellipse: SpiceEllipseInput,
    plane: Readonly<SpicePlane>,
  ):
    | { nxpts: -1 | 0 }
    | { nxpts: 1 | 2; xpt1: SpiceVector3; xpt2: SpiceVector3 };

  /**
   * Find a nearest point on a nondegenerate ellipse and its Euclidean distance. Any minimizer may be returned when the geometric solution is nonunique. A zero-length axis signals DEGENERATECASE. Supply axes and a point that permit the documented scaling and translation; the underlying NEARPT routine also limits axis ratios and input magnitudes.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/npelpt_c.html
   */
  npelpt(
    point: Readonly<SpiceVector3>,
    ellipse: SpiceEllipseInput,
  ): { pnear: SpiceVector3; dist: number };

  /**
   * Find a nearest surface point on the origin-centered ellipsoid and signed altitude. Altitude is negative inside and zero on the surface. A nonunique interior solution follows CSPICE. Nonpositive or disproportionately scaled radii can signal BADAXISLENGTH, and excessive scaled coordinates can signal INPUTSTOOLARGE.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/nearpt_c.html
   */
  nearpt(
    position: Readonly<SpiceVector3>,
    a: number,
    b: number,
    c: number,
  ): { npoint: SpiceVector3; alt: number };

  /**
   * Find a nearest ellipsoid point to an infinite line and its nonnegative distance. An intersection gives zero distance. CSPICE tries the forward ray first, then the reverse ray. A zero direction takes precedence over nonpositive axes. Numerical degeneracy can prevent a projection or inverse projection. The projected nearest-point workspace must have a representable translation and scale.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/npedln_c.html
   */
  npedln(
    a: number,
    b: number,
    c: number,
    linept: Readonly<SpiceVector3>,
    linedr: Readonly<SpiceVector3>,
  ): { pnear: SpiceVector3; dist: number };

  /**
   * Compute the apparent limb seen from an external point as an owned center and two semi-axis vectors. On-surface views can produce a point ellipse. N0067 reports DEGENERATECASE for nonpositive radii, an interior viewpoint, or unrepresentable scaled axes.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/edlimb_c.html
   */
  edlimb(
    a: number,
    b: number,
    c: number,
    viewpt: Readonly<SpiceVector3>,
  ): SpiceEllipse;

  /**
   * Return the surface point with the specified outward normal direction. A zero normal, invalid axes or a lost scaled axis signals a toolkit error. The normal need not have unit length.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ednmpt_c.html
   */
  ednmpt(
    a: number,
    b: number,
    c: number,
    normal: Readonly<SpiceVector3>,
  ): SpiceVector3;

  /**
   * Scale a nonzero vector radially onto the ellipsoid. N0067 reports INVALIDRADII for nonpositive axes, ZEROVECTOR for the origin and POINTTOOSMALL when the squared level underflows.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/edpnt_c.html
   */
  edpnt(
    point: Readonly<SpiceVector3>,
    a: number,
    b: number,
    c: number,
  ): SpiceVector3;

  /**
   * Compute the outward unit normal at a surface point using the axis-scaled direction. Supply a point on the ellipsoid for a geometric surface normal. The pinned calculation at the origin returns the zero vector. Nonpositive axes signal BADAXISLENGTH.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/surfnm_c.html
   */
  surfnm(
    a: number,
    b: number,
    c: number,
    point: Readonly<SpiceVector3>,
  ): SpiceVector3;

  /**
   * Return the first intersection of a forward ray and an origin-centered ellipsoid. A miss returns found=false without a point. The surface vertex, when exactly recognized, is its own first intersection. A zero direction or nonpositive axis signals a toolkit error.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/surfpt_c.html
   */
  surfpt(
    position: Readonly<SpiceVector3>,
    direction: Readonly<SpiceVector3>,
    a: number,
    b: number,
    c: number,
  ): Found<{ point: SpiceVector3 }>;

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
