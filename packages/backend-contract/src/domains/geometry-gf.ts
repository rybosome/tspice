/**
 * GF (Geometry Finder) event finding.
 *
 * Tranche 1 scope:
 * - "Plumbing" utilities (`gfsstp/gfstep`, `gfstol`, `gfrefn`, `gfrepi/gfrepf`).
 * - Callback-free distance, angular separation, occultation and field-of-view searches.
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
  /** Find occultations of the back target by the front target. Supply the occultation type, each body’s shape and fixed frame, correction and observer. Point shapes permit an empty frame; ellipsoid and supported DSK shapes need their kernels.
   * The positive search step is in TDB seconds and updates the global GF step. The routine replaces the distinct, preallocated result window with complete TDB intervals. A miss yields an empty window. Step size controls event detection; the GF convergence tolerance controls boundary refinement.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/gfoclt_c.html
   */
  gfoclt(
    occtyp: string,
    front: string,
    fshape: string,
    fframe: string,
    back: string,
    bshape: string,
    bframe: string,
    abcorr: string,
    obsrvr: string,
    step: number,
    cnfine: SpiceWindow,
    result: SpiceWindow,
  ): void;

  /** Find epochs when the supplied direction in rframe is within the instrument field of view. The three-component direction is dimensionless and need not be normalized. FOV and time-dependent frames require the corresponding kernels.
   * The positive search step is in TDB seconds and updates the global GF step. The routine replaces the distinct, preallocated result window with complete TDB intervals. A miss yields an empty window. Step size controls event detection; the GF convergence tolerance controls boundary refinement.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/gfrfov_c.html
   */
  gfrfov(
    inst: string,
    raydir: readonly [number, number, number],
    rframe: string,
    abcorr: string,
    obsrvr: string,
    step: number,
    cnfine: SpiceWindow,
    result: SpiceWindow,
  ): void;

  /** Find epochs when the instrument sees any part of the target. POINT uses the center; ELLIPSOID uses its limb and a body-fixed frame. A point target permits an empty frame.
   * The positive search step is in TDB seconds and updates the global GF step. The routine replaces the distinct, preallocated result window with complete TDB intervals. A miss yields an empty window. Step size controls event detection; the GF convergence tolerance controls boundary refinement.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/gftfov_c.html
   */
  gftfov(
    inst: string,
    target: string,
    tshape: string,
    tframe: string,
    abcorr: string,
    obsrvr: string,
    step: number,
    cnfine: SpiceWindow,
    result: SpiceWindow,
  ): void;

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
