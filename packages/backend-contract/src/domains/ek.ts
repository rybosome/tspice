/**
* Contract conventions:
* - Inputs are assumed validated at the backend boundary; the contract itself is primarily type-level.
* - Methods throw on invalid arguments or SPICE errors.
* - Lookups that may legitimately miss return `Found<T>` (`{ found: false }`) instead of throwing.
*/

import type { SpiceHandle } from "../shared/types.js";

export interface EkApi {
  /** Open an existing EK file for read (see `ekopr_c`). */
  ekopr(path: string): SpiceHandle;

  /** Open an existing EK file for write (see `ekopw_c`). */
  ekopw(path: string): SpiceHandle;

  /**
   * Create and open a new EK file for write (see `ekopn_c`).
   *
   * `ncomch` is the number of comment characters to allocate for the EK.
   */
  ekopn(path: string, ifname: string, ncomch: number): SpiceHandle;

  /** Close an EK file opened via `ekopr` / `ekopw` / `ekopn` (see `ekcls_c`). */
  ekcls(handle: SpiceHandle): void;

  /** Number of EK tables currently loaded (see `ekntab_c`). */
  ekntab(): number;

  /**
   * Retrieve the EK table name by 0-based index (see `ektnam_c`).
   *
   * `n` must be in the range `0..ekntab()-1`.
   */
  ektnam(n: number): string;

  /** Number of segments in an EK file opened via handle (see `eknseg_c`). */
  eknseg(handle: SpiceHandle): number;
}
