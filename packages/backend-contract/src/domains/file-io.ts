/**
 * Contract conventions:
 * - Inputs are assumed validated at the backend boundary; the contract itself is primarily type-level.
 * - Methods throw on invalid arguments or SPICE errors.
 * - Lookups that may legitimately miss return `Found<T>` (`{ found: false }`) instead of throwing.
 */

import type { SpiceHandle, VirtualOutput } from "../shared/types.js";

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

/** Backend contract for SPICE file I/O primitives (DAF/DAS/DLA + virtual outputs). */
export interface FileIoApi {
  /** Returns whether a file exists at `path`. */
  exists(path: string): boolean;

  /** Determine SPICE file architecture + type (see `getfat_c`). */
  getfat(path: string): { arch: string; type: string };

  /**
   * Read back bytes for a previously-created virtual output file.
   *
   * Notes:
   * - Virtual outputs are only guaranteed to be readable after their associated
   *   writer handle has been closed (e.g. `spkcls(handle)` for SPK outputs).
   * - Backends may reject reads for outputs they did not create via a writer
   *   API. This is intentionally **not** a general filesystem read.
   */
  readVirtualOutput(output: VirtualOutput): Uint8Array;

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

  /**
   * Close a DAS-backed file handle.
   *
   * In CSPICE, `dascls_c` closes both DAS and DLA handles, and `dlacls_c` is an
   * alias. We mirror that behavior: `dascls` and `dlacls` are interchangeable
   * and accept handles returned from either `dasopr()` (read) or `dlaopn()`
   * (write).
   */
  dascls(handle: SpiceHandle): void;

  // --- DLA -----------------------------------------------------------------

  /** Create and open a DLA file for write (see `dlaopn_c`). */
  dlaopn(path: string, ftype: string, ifname: string, ncomch: number): SpiceHandle;

  /**
   * Begin a forward search for DLA segments (see `dlabfs_c`).
   *
   * DLA is DAS-backed: `handle` must be a DAS handle to a DLA file, opened via
   * `dasopr()` (read) or `dlaopn()` (write).
   */
  dlabfs(handle: SpiceHandle): FoundDlaDescriptor;

  /**
   * Find the next DLA segment after `descr` (see `dlafns_c`).
   *
   * DLA is DAS-backed: `handle` must be a DAS handle to a DLA file, opened via
   * `dasopr()` (read) or `dlaopn()` (write).
   */
  dlafns(handle: SpiceHandle, descr: DlaDescriptor): FoundDlaDescriptor;

  /**
   * Close a DAS-backed DLA handle.
   *
   * Provided for parity with CSPICE `dlacls_c`, but implemented as an alias of
   * `dascls` (same handle compatibility).
   */
  dlacls(handle: SpiceHandle): void;

  // --- DSK (DAS-backed) ---------------------------------------------------

  /** Create and open a DSK file for write (see `dskopn_c`). */
  dskopn(path: string, ifname: string, ncomch: number): SpiceHandle;

  /** Build the spatial index for a type 2 DSK segment (see `dskmi2_c`). */
  dskmi2(
    nv: number,
    vrtces: readonly number[],
    np: number,
    plates: readonly number[],
    finscl: number,
    corscl: number,
    worksz: number,
    voxpsz: number,
    voxlsz: number,
    makvtl: boolean,
    spxisz: number,
  ): { spaixd: number[]; spaixi: number[] };

  /** Write a type 2 segment to a DSK file opened by `dskopn` (see `dskw02_c`). */
  dskw02(
    handle: SpiceHandle,
    center: number,
    surfid: number,
    dclass: number,
    frame: string,
    corsys: number,
    corpar: readonly number[],
    mncor1: number,
    mxcor1: number,
    mncor2: number,
    mxcor2: number,
    mncor3: number,
    mxcor3: number,
    first: number,
    last: number,
    nv: number,
    vrtces: readonly number[],
    np: number,
    plates: readonly number[],
    spaixd: readonly number[],
    spaixi: readonly number[],
  ): void;
}
