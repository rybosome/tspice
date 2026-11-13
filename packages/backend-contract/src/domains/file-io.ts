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

/** Backend-only file I/O helpers exposed to higher-level kit code. */
export interface FileIoKitApi {
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
}

/** Backend contract for SPICE file I/O primitives (DAF/DAS/DLA). */
export interface FileIoApi {
  /** Returns whether a file exists at `path`. */
  exists(path: string): boolean;

  /** Determine SPICE file architecture + type (see `getfat_c`). */
  getfat(path: string): { arch: string; type: string };

  // --- DAF -----------------------------------------------------------------

  /**
   * Open a DAF file for read and return a backend-owned opaque token.
   * Duplicate read opens have separate tokens but share CSPICE's file/cursor.
   * @param path Existing backend filesystem path (staged virtual ID in WASM).
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dafopr_c.html
   */
  dafopr(path: string): SpiceHandle;

  /**
   * Release one DAF read claim and invalidate its opaque token.
   * Wrong-kind, foreign and already-closed tokens throw at the registry boundary.
   * @param handle Live token returned by this backend's `dafopr`.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dafcls_c.html
   */
  dafcls(handle: SpiceHandle): void;

  /**
   * Start or restart the given DAF file's forward array search.
   * @param handle Live DAF token; two read claims on one file share its cursor.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dafbfs_c.html
   */
  dafbfs(handle: SpiceHandle): void;

  /**
   * Find the next DAF array (see `daffna_c`).
   *
   * Backend implementations should select the current DAF via `dafcs_c(handle)`
   * before calling `daffna_c` to support interleaving multiple DAF searches.
   * @param handle Live DAF token with a search started by `dafbfs`.
   * @returns True on the next array, false at/after the end of the array list.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/daffna_c.html
   */
  daffna(handle: SpiceHandle): boolean;

  // --- DAS -----------------------------------------------------------------

  /**
   * Open a DAS-backed file (including DLA/DSK) for read.
   * @param path Existing backend filesystem path (staged virtual ID in WASM).
   * @returns Backend-owned opaque token; duplicate opens retain read claims.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dasopr_c.html
   */
  dasopr(path: string): SpiceHandle;

  /**
   * Close a DAS-backed file handle.
   *
   * CSPICE `dascls_c` closes both DAS and DLA handles. tspice provides `dlacls`
   * as an alias: `dascls` and `dlacls` are interchangeable
   * and accept handles returned from either `dasopr()` (read) or `dlaopn()`
   * (write). The opaque-token contract rejects already-closed tokens even though
   * CSPICE's numeric close primitive permits unknown handles as no-ops.
   * @param handle Live DAS/DLA token belonging to this backend.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dascls_c.html
   */
  dascls(handle: SpiceHandle): void;

  // --- DLA -----------------------------------------------------------------

  /** Create and open a DLA file for write (see `dlaopn_c`). */
  dlaopn(
    path: string,
    ftype: string,
    ifname: string,
    ncomch: number,
  ): SpiceHandle;

  /**
   * Begin a forward search for DLA segments (see `dlabfs_c`).
   *
   * DLA is DAS-backed: `handle` must be a DAS handle to a DLA file, opened via
   * `dasopr()` (read) or `dlaopn()` (write).
   * @param handle Live DAS-backed DLA token.
   * @returns A miss for an empty file, or all eight descriptor fields.
   * Descriptor addresses/sizes are valid only when `found` is true.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dlabfs_c.html
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
   * This is a tspice alias of `dascls` (same handle compatibility); CSPICE has
   * no separate `dlacls_c` entrypoint.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dascls_c.html
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
