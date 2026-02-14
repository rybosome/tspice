/**
 * Contract conventions:
 * - Inputs are assumed validated at the backend boundary; the contract itself is primarily type-level.
 * - Methods throw on invalid arguments or SPICE errors.
 * - Lookups that may legitimately miss return `Found<T>` (`{ found: false }`) instead of throwing.
 */
import type { Mat3RowMajor, SpiceVector3 } from "../shared/types.js";

export interface CoordsVectorsApi {
  reclat(rect: SpiceVector3): { radius: number; lon: number; lat: number };
  latrec(radius: number, lon: number, lat: number): SpiceVector3;

  recsph(rect: SpiceVector3): { radius: number; colat: number; lon: number };
  sphrec(radius: number, colat: number, lon: number): SpiceVector3;

  vnorm(v: SpiceVector3): number;

  /**
   * Compute the unit vector of `v`.
   *
   * **Zero-vector behavior:** if `v` is `[0, 0, 0]`, this returns `[0, 0, 0]` and
   * does **not** throw.
   *
   * This matches the NAIF CSPICE `vhat_c` definition.
   */
  vhat(v: SpiceVector3): SpiceVector3;
  vdot(a: SpiceVector3, b: SpiceVector3): number;
  vcrss(a: SpiceVector3, b: SpiceVector3): SpiceVector3;

  vadd(a: SpiceVector3, b: SpiceVector3): SpiceVector3;
  vsub(a: SpiceVector3, b: SpiceVector3): SpiceVector3;
  vminus(v: SpiceVector3): SpiceVector3;
  vscl(s: number, v: SpiceVector3): SpiceVector3;

  mxm(a: Mat3RowMajor, b: Mat3RowMajor): Mat3RowMajor;

  /**
   * Generate a rotation matrix representing a rotation about a coordinate axis.
   *
   * Axis is 1=x, 2=y, 3=z.
   */
  rotate(angle: number, axis: number): Mat3RowMajor;

  /**
   * Rotate a matrix about a coordinate axis.
   *
   * Axis is 1=x, 2=y, 3=z.
   */
  rotmat(m: Mat3RowMajor, angle: number, axis: number): Mat3RowMajor;

  /**
   * Convert an axis and angle to a rotation matrix.
   */
  axisar(axis: SpiceVector3, angle: number): Mat3RowMajor;

  georec(lon: number, lat: number, alt: number, re: number, f: number): SpiceVector3;
  recgeo(rect: SpiceVector3, re: number, f: number): { lon: number; lat: number; alt: number };

  mxv(m: Mat3RowMajor, v: SpiceVector3): SpiceVector3;
  mtxv(m: Mat3RowMajor, v: SpiceVector3): SpiceVector3;
}
