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
  SpiceStateVector,
  SpiceVector3,
} from "../shared/types.js";

/** A singular nearest-point derivative still has a defined position and altitude. */
export type NearPointDerivative = {
  position: SpiceVector3;
  altitude: number;
} & (
  | { found: false }
  | { found: true; velocity: SpiceVector3; altitudeRate: number }
);
/** Six quantities defined by CSPICE TANGPT, in the target-fixed frame. */
export type TangentPoint = {
  tanpt: SpiceVector3;
  alt: number;
  range: number;
  srfpt: SpiceVector3;
  trgepc: number;
  srfvec: SpiceVector3;
};

/** Backend contract for common SPICE geometry computations (subpoints, intercepts, illumination, etc). */
export interface GeometryApi {
  /**
   * Return the nearest surface position and signed altitude for a Cartesian state and three semiaxes. When found is true, velocity and altitudeRate are also defined. A focal-set singularity can leave both derivatives undefined while position and altitude remain meaningful. Lengths and time derivatives share the units of the input state.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dnearp_c.html
   */
  dnearp(
    state: Readonly<SpiceStateVector>,
    a: number,
    b: number,
    c: number,
  ): NearPointDerivative;
  /**
   * Intersect a moving ray with the ellipsoid and return the position and velocity of the intercept in the input frame and units. When either is undefined, return found:false. The first three direction components specify the ray and the last three its time derivative.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/surfpv_c.html
   */
  surfpv(
    vertex: Readonly<SpiceStateVector>,
    direction: Readonly<SpiceStateVector>,
    a: number,
    b: number,
    c: number,
  ): Found<{ state: SpiceStateVector }>;
  /**
   * Find the tangent point of a ray relative to an ellipsoidal target. Supply the target-fixed frame, aberration correction, correction locus (TANGENT POINT or SURFACE POINT), observer, direction frame and nonzero ray. ET and the returned target epoch are TDB seconds past J2000. Positions, altitude and range are km. A ray entering the target can yield zero altitude.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/tangpt_c.html
   */
  tangpt(
    method: string,
    target: string,
    et: number,
    fixref: string,
    abcorr: string,
    corloc: string,
    observer: string,
    dref: string,
    dvec: Readonly<SpiceVector3>,
  ): TangentPoint;
  /**
   * Compute the angle at the target center between illuminator and observer, in radians
   * from 0 to π. Use three distinct body names or numeric strings, finite ET in TDB
   * seconds past J2000, and a geometric or reception correction. An SPK must connect the
   * bodies at the required epochs.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/phaseq_c.html
   */
  phaseq(
    et: number,
    target: string,
    illmn: string,
    observer: string,
    abcorr: AbCorr | string,
  ): number;

  /**
   * Return the planetocentric solar longitude in radians from 0 to 2π, measured from the
   * ascending equinox in the instantaneous orbital plane. Provide a central body name or
   * numeric string, finite TDB seconds past J2000 and an aberration correction for the
   * apparent Sun state. Requires body orientation and geometric heliocentric state. The
   * linked N0067 stages are checked before consuming their results.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lspcn_c.html
   */
  lspcn(body: string, et: number, abcorr: AbCorr | string): number;

  /**
   * Return the apparent angular gap between two targets as seen from the observer, in
   * radians. POINT has zero radius; SPHERE uses the largest PCK semi-axis. A negative
   * gap means apparent overlap. Provide three distinct body names or numeric strings, a
   * finite epoch in TDB seconds past J2000 and an aberration correction. Both frame
   * strings must be nonempty; N0067 ignores their values for these two shapes.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/trgsep_c.html
   */
  trgsep(
    et: number,
    targ1: string,
    shape1: string,
    frame1: string,
    targ2: string,
    shape2: string,
    frame2: string,
    observer: string,
    abcorr: AbCorr | string,
  ): number;

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
