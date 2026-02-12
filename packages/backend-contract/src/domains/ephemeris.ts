/**
* Contract conventions:
* - Inputs are assumed validated at the backend boundary; the contract itself is primarily type-level.
* - Methods throw on invalid arguments or SPICE errors.
* - Lookups that may legitimately miss return `Found<T>` (`{ found: false }`) instead of throwing.
*/
import type { AbCorr, SpkezrResult, SpkposResult, SpiceHandle, VirtualOutput } from "../shared/types.js";

export interface EphemerisApi {
  /**
   * Compute state relative to observer using loaded kernels (see `spkezr_c`).
   *
   * Note: `abcorr` is a known set of SPICE aberration correction strings, but we allow arbitrary
   * strings for forward-compatibility.
   */
  spkezr(
    target: string,
    et: number,
    ref: string,
    abcorr: AbCorr | string,
    observer: string,
  ): SpkezrResult;

  /**
   * Compute position relative to observer using loaded kernels (see `spkpos_c`).
   */
  spkpos(
    target: string,
    et: number,
    ref: string,
    abcorr: AbCorr | string,
    observer: string,
  ): SpkposResult;

  // --- SPK writers ---------------------------------------------------------

  /**
   * Open a new SPK file for write (see `spkopn_c`).
   *
   * `file` interpretation is backend-dependent:
   * - Node: OS filesystem path
   * - WASM: virtual FS path/id (currently under `/kernels/...`)
   *
   * When `file` is a `VirtualOutput`, backends should allow reading bytes back
   * via `readVirtualOutput()` after closing the file handle.
   *
   * Callers should retain the `VirtualOutput` they passed to `spkopn`/`spkopa`.
   * It is the identifier used to read bytes back later.
   */
  spkopn(file: string | VirtualOutput, ifname: string, ncomch: number): SpiceHandle;

  /** Open an existing SPK for append (see `spkopa_c`). */
  spkopa(file: string | VirtualOutput): SpiceHandle;

  /** Close an SPK file previously opened by `spkopn`/`spkopa` (see `spkcls_c`). */
  spkcls(handle: SpiceHandle): void;

  /**
   * Write a type 8 SPK segment (see `spkw08_c`).
   *
   * `states` is a flat array with layout `[x,y,z, dx,dy,dz]` for each record.
   * The number of records `n` is derived as `states.length / 6`.
   */
  spkw08(
    handle: SpiceHandle,
    body: number,
    center: number,
    frame: string,
    first: number,
    last: number,
    segid: string,
    degree: number,
    states: readonly number[],
    epoch1: number,
    step: number,
  ): void;
}
