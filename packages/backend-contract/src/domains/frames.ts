/**
* Contract conventions:
* - Inputs are assumed validated at the backend boundary; the contract itself is primarily type-level.
* - Methods throw on invalid arguments or SPICE errors.
* - Lookups that may legitimately miss return `Found<T>` (`{ found: false }`) instead of throwing.
*/
import type { Found, Mat3RowMajor, SpiceMatrix6x6, SpiceVector3 } from "../shared/types.js";

export interface FramesApi {
  namfrm(name: string): Found<{ code: number }>;
  frmnam(code: number): Found<{ name: string }>;

  cidfrm(center: number): Found<{ frcode: number; frname: string }>;
  cnmfrm(centerName: string): Found<{ frcode: number; frname: string }>;

  /** Get pointing (attitude) for a CK instrument at a given encoded spacecraft clock time. */
  ckgp(
    inst: number,
    sclkdp: number,
    tol: number,
    ref: string,
  ): Found<{ cmat: Mat3RowMajor; clkout: number }>;

  /** Get pointing + angular velocity for a CK instrument at a given encoded spacecraft clock time. */
  ckgpav(
    inst: number,
    sclkdp: number,
    tol: number,
    ref: string,
  ): Found<{ cmat: Mat3RowMajor; av: SpiceVector3; clkout: number }>;

  /** Compute a 3x3 frame transformation matrix (row-major). */
  pxform(from: string, to: string, et: number): Mat3RowMajor;

  /** Compute a 6x6 state transformation matrix (row-major). */
  sxform(from: string, to: string, et: number): SpiceMatrix6x6;
}
