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
export type GfRelate =
  ">" | "<" | "=" | "ABSMAX" | "ABSMIN" | "LOCMAX" | "LOCMIN";

/** Backend contract for Geometry Finder (GF) event-finding routines. */
export interface GeometryGfApi {
  /** Read the interrupt flag shared by GF searches in this runtime. The initial flag is false. Explicit handler calls or a delivered native SIGINT set it. Reading preserves it.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/gfbail_c.html
   */
  gfbail(): boolean;

  /** Clear the shared GF interrupt flag. Subsequent reads return false until another interrupt. Clearing the flag preserves the installed signal handler.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/gfclrh_c.html
   */
  gfclrh(): void;

  /** Invoke the N0067 GF interrupt handler with a signed signal number. SIGINT (2 on supported platforms) installs the handler and sets the interrupt flag. Other signal codes raise INVALIDSIGNAL. Native clients share the host disposition until the last owner disposes or the host replaces it. A browser worker has a module-local signal disposition.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/gfinth_c.html
   */
  gfinth(sigcode: number): void;

  /** Report the current TDB time within a confinement interval using the reporter initialized with gfrepi. All three arguments are finite seconds, and time must lie in the closed interval. Reversed endpoints and out-of-range times raise toolkit errors. Output is rate-limited and may be empty. End the report with gfrepf.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/gfrepu_c.html
   */
  gfrepu(ivbeg: number, ivend: number, time: number): void;

  /**
   * Set a positive constant step in TDB seconds for {@link GeometryGfApi.gfstep}.
   * This process/module-global setting survives `kclear()`.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/gfsstp_c.html
   */
  gfsstp(step: number): void;

  /**
   * Return the configured constant step in seconds; the finite `time` is ignored.
   * Requires prior initialization by {@link GeometryGfApi.gfsstp}.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/gfstep_c.html
   */
  gfstep(time: number): number;

  /**
   * Set positive GF convergence tolerance in TDB seconds (default `1e-6`).
   * This global setting survives `kclear()` and does not affect `gfrefn()`.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/gfstol_c.html
   */
  gfstol(value: number): void;

  /**
   * Return the bisection midpoint of finite TDB epochs `t1` and `t2`.
   * CSPICE ignores the boolean state flags; both must still be booleans.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/gfrefn_c.html
   */
  gfrefn(t1: number, t2: number, s1: boolean, s2: boolean): number;

  /**
   * Initialize console progress for a valid window with printable messages.
   * The window is preserved. Callback-free searches do not drive this reporter.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/gfrepi_c.html
   */
  gfrepi(window: SpiceWindow, begmss: string, endmss: string): void;

  /**
   * Finalize the default console progress reporter, clearing its display.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/gfrepf_c.html
   */
  gfrepf(): void;

  /**
   * Angular separation search (`gfsep_c`).
   *
   * `refval` and `adjust` are in **radians**.
   * Epochs and positive `step` are TDB seconds. Replaces `result`, preserving
   * `cnfine`; result capacity must be at least one interval. Internal workspace
   * `nintvls` is separate and bounded to 256 MiB (3,355,440 intervals).
   * POINT equality to zero has CSPICE's documented alignment-detection limit.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/gfsep_c.html
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
   * Epochs and positive `step` are TDB seconds. Replaces `result`, preserving
   * `cnfine`; result capacity must be at least one interval. Internal workspace
   * `nintvls` is separate and bounded to 256 MiB (3,355,440 intervals).
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/gfdist_c.html
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
