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

  mxv(m: Mat3RowMajor, v: SpiceVector3): SpiceVector3;
  mtxv(m: Mat3RowMajor, v: SpiceVector3): SpiceVector3;
}
