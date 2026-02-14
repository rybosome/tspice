/**
 * Contract conventions:
 * - Inputs are assumed validated at the backend boundary; the contract itself is primarily type-level.
 * - Methods throw on invalid arguments or SPICE errors.
 * - Lookups that may legitimately miss return `Found<T>` (`{ found: false }`) instead of throwing.
 */
import type { Found, Mat3RowMajor, SpiceMatrix6x6, SpiceVector3 } from "../shared/types.js";

import type { SpiceIntCell, SpiceWindow } from "./cells-windows.js";

/** Coverage detail level returned by {@link FramesApi.ckcov}. */
export type CkCoverageLevel = "SEGMENT" | "INTERVAL";

/** Time system used for coverage windows returned by {@link FramesApi.ckcov}. */
export type CkCoverageTimeSystem = "SCLK" | "TDB";

/** Backend contract for frame/name lookups, CK access, and frame transformations. */
export interface FramesApi {
  /** SPICE `namfrm_c`: look up a frame code by frame name. */
  namfrm(name: string): Found<{ code: number }>;
  /** SPICE `frmnam_c`: look up a frame name by frame code. */
  frmnam(code: number): Found<{ name: string }>;

  /** SPICE `cidfrm_c`: look up frame information for a center body ID. */
  cidfrm(center: number): Found<{ frcode: number; frname: string }>;
  /** SPICE `cnmfrm_c`: look up frame information for a center body name. */
  cnmfrm(centerName: string): Found<{ frcode: number; frname: string }>;

  /** SPICE `frinfo_c`: get center + frame class info for a frame ID. */
  frinfo(frameId: number): Found<{ center: number; frameClass: number; classId: number }>;

  /** SPICE `ccifrm_c`: map frame class + class ID to a frame code/name/center triple. */
  ccifrm(frameClass: number, classId: number): Found<{ frcode: number; frname: string; center: number }>;

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

  // --- CK file query / management (read-only) ------------------------------

  /**
   * Load a CK file for access by pointing routines (`cklpf_c`).
   *
   * Returns a CK file handle suitable for {@link FramesApi.ckupf}.
   */
  cklpf(ck: string): number;

  /** Unload a CK file previously loaded by {@link FramesApi.cklpf} (`ckupf_c`). */
  ckupf(handle: number): void;

  /** Return the set of instrument/object IDs for which the specified CK has segments (`ckobj_c`). */
  ckobj(ck: string, ids: SpiceIntCell): void;

  /** Return coverage for an instrument/object in a CK file (`ckcov_c`). */
  ckcov(
    ck: string,
    idcode: number,
    needav: boolean,
    level: CkCoverageLevel,
    tol: number,
    timsys: CkCoverageTimeSystem,
    cover: SpiceWindow,
  ): void;

  /** Compute a 3x3 frame transformation matrix (row-major). */
  pxform(from: string, to: string, et: number): Mat3RowMajor;

  /** Compute a 6x6 state transformation matrix (row-major). */
  sxform(from: string, to: string, et: number): SpiceMatrix6x6;
}
