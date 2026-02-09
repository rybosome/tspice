/**
* Contract conventions:
* - Inputs are assumed validated at the backend boundary; the contract itself is primarily type-level.
* - Methods throw on invalid arguments or SPICE errors.
* - Lookups that may legitimately miss return `Found<T>` (`{ found: false }`) instead of throwing.
*/

import type { SpiceHandle } from "../shared/types.js";

/**
* Plain-object representation of CSPICE `SpiceDLADescr`.
*
* These are the 8 integer components of a DLA descriptor.
*
* ## Portability
*
* Each field is an **int32** (32-bit signed integer). Backend implementations
* must reject (throw) non-integers and values outside the int32 range to
* prevent silent truncation across native/WASM boundaries.
*
* This matches tspice's project-wide assumption that `SpiceInt` is 32-bit
* (`sizeof(SpiceInt) == 4`) in all supported builds.
*/
export type DlaDescriptor = {
  bwdptr: number;
  fwdptr: number;
  ibase: number;
  isize: number;
  dbase: number;
  dsize: number;
  cbase: number;
  csize: number;
};

export type FoundDlaDescriptor =
  | { found: false }
  | {
      found: true;
      descr: DlaDescriptor;
    };

export interface FileIoApi {
  /** Returns whether a file exists at `path`. */
  exists(path: string): boolean;

  /** Determine SPICE file architecture + type (see `getfat_c`). */
  getfat(path: string): { arch: string; type: string };

  // --- DAF -----------------------------------------------------------------

  /** Open a DAF file for read (see `dafopr_c`). */
  dafopr(path: string): SpiceHandle;

  /** Close a DAF file previously opened by `dafopr()`. */
  dafcls(handle: SpiceHandle): void;

  /** Begin a forward search for arrays in the given DAF file (see `dafbfs_c`). */
  dafbfs(handle: SpiceHandle): void;

  /**
   * Find the next DAF array (see `daffna_c`).
   *
   * Backend implementations should select the current DAF via `dafcs_c(handle)`
   * before calling `daffna_c` to support interleaving multiple DAF searches.
   */
  daffna(handle: SpiceHandle): boolean;

  // --- DAS -----------------------------------------------------------------

  /** Open a DAS file for read (see `dasopr_c`). */
  dasopr(path: string): SpiceHandle;

  /** Close a DAS file previously opened by `dasopr()` (or DLA open helpers). */
  dascls(handle: SpiceHandle): void;

  // --- DLA -----------------------------------------------------------------

  /** Create and open a DLA file for write (see `dlaopn_c`). */
  dlaopn(path: string, ftype: string, ifname: string, ncomch: number): SpiceHandle;

  /** Begin a forward search for DLA segments (see `dlabfs_c`). */
  dlabfs(handle: SpiceHandle): FoundDlaDescriptor;

  /** Find the next DLA segment after `descr` (see `dlafns_c`). */
  dlafns(handle: SpiceHandle, descr: DlaDescriptor): FoundDlaDescriptor;

  /** Convenience close for DLA handles (DLA is DAS-backed). */
  dlacls(handle: SpiceHandle): void;
}
