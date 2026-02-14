/**
 * GF (Geometry Finder) event finding.
 *
 * Tranche 1 scope:
 * - "Plumbing" utilities (`gfsstp/gfstep`, `gfstol`, `gfrefn`, `gfrepi/gfrepf`).
 * - A couple high-level, callback-free searches: `gfsep` and `gfdist`.
 *
 * Notes:
 * - The CSPICE GF subsystem has some **global mutable state** (e.g. `gfsstp`,
 *   `gfstol`). Callers should treat these as process-global knobs.
 * - Confinement/result windows use Group 2 `SpiceWindow` opaque handles.
 */

import type { AbCorr } from "../shared/types.js";
import type { SpiceWindow } from "./cells-windows.js";

/** Relation operators accepted by many high-level GF searches. */
export type GfRelate = ">" | "<" | "=" | "ABSMAX" | "ABSMIN" | "LOCMAX" | "LOCMIN";

export interface GeometryGfApi {
  /** Set the constant step size used by {@link GeometryGfApi.gfstep} (`gfsstp_c`). */
  gfsstp(step: number): void;

  /** Return the constant step size set by {@link GeometryGfApi.gfsstp} (`gfstep_c`). */
  gfstep(time: number): number;

  /** Override the GF convergence tolerance (`gfstol_c`). */
  gfstol(value: number): void;

  /** Default refinement estimator used by the GF subsystem (`gfrefn_c`). */
  gfrefn(t1: number, t2: number, s1: boolean, s2: boolean): number;

  /** Initialize the default console progress reporter (`gfrepi_c`). */
  gfrepi(window: SpiceWindow, begmss: string, endmss: string): void;

  /** Finalize the default console progress reporter (`gfrepf_c`). */
  gfrepf(): void;

  /**
   * Angular separation search (`gfsep_c`).
   *
   * `refval` and `adjust` are in **radians**.
   */
  gfsep(
    targ1: string,
    shape1: string,
    frame1: string,
    targ2: string,
    shape2: string,
    frame2: string,
    abcorr: AbCorr | string,
    obsrvr: string,
    relate: GfRelate | string,
    refval: number,
    adjust: number,
    step: number,
    nintvls: number,
    cnfine: SpiceWindow,
    result: SpiceWindow,
  ): void;

  /**
   * Observer-target distance search (`gfdist_c`).
   *
   * `refval` and `adjust` are in **km**.
   */
  gfdist(
    target: string,
    abcorr: AbCorr | string,
    obsrvr: string,
    relate: GfRelate | string,
    refval: number,
    adjust: number,
    step: number,
    nintvls: number,
    cnfine: SpiceWindow,
    result: SpiceWindow,
  ): void;
}
