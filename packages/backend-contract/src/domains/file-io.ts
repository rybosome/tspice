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
  /**
   * Return whether a nonempty backend filesystem path exists.
   * A missing file returns false; this does not load or open a kernel.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/exists_c.html
   */
  exists(path: string): boolean;

  /**
   * Determine a file's architecture and type, such as DAS/DSK or KPL/LSK.
   * @param path Nonempty existing backend filesystem path; a missing file throws.
   * @returns Toolkit architecture/type identifiers (uppercase, including DLA types).
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/getfat_c.html
   */
  getfat(path: string): { arch: string; type: string };

  // --- DAF -----------------------------------------------------------------

  /** Begin a backward array search on this live DAF, sharing its per-file cursor with other opens of the same file.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dafbbs_c.html */
  dafbbs(handle: SpiceHandle): void;
  /** Select a previously started DAF search as the current search. Search selection is toolkit-global in each runtime.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dafcs_c.html */
  dafcs(handle: SpiceHandle): void;
  /** Select the handle’s search and move back one array. False denotes no previous array. Uses the same traced N0067 SPICELIB operation with defined error handling.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/daffpa_c.html */
  daffpa(handle: SpiceHandle): boolean;
  /** Return the oldest live DAF token in this backend for the current CSPICE search file. Repeated opens can share that file. An unowned current file is rejected.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dafgh_c.html */
  dafgh(): SpiceHandle;
  /** Select the handle's search and read the current array name. namlen is the signed byte capacity including NUL, default 1001. Smaller valid capacities retain the toolkit prefix. An incomplete or invalid UTF-8 result cannot be represented.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dafgn_c.html */
  dafgn(handle: SpiceHandle, namlen?: number): string;
  /** Select the handle's search and copy its current packed summary. The owned byte array contains 8*(ND+ceil(NI/2)) bytes in the runtime's native byte order, preserving all stored bit patterns. Use dafhsf for the layout.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dafgs_c.html */
  dafgs(handle: SpiceHandle): Uint8Array;
  /** Read the counts of double (nd) and integer (ni) summary components in this DAF.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dafhsf_c.html */
  dafhsf(handle: SpiceHandle): { nd: number; ni: number };
  /** Open an existing native-format DAF for write access and return a claim owned by this backend. Resolve mounted virtual paths as for dafopr. Close with dafcls.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dafopw_c.html */
  dafopw(path: string): SpiceHandle;

  /**
   * Open a DAF file for read and return a backend-owned opaque token.
   * Duplicate read opens have separate tokens but share CSPICE's file/cursor.
   * @param path Existing backend filesystem path (staged virtual ID in WASM).
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dafopr_c.html
   */
  dafopr(path: string): SpiceHandle;

  /**
   * Release one DAF read or write claim and invalidate its opaque token.
   * Wrong-kind, foreign and already-closed tokens throw at the registry boundary.
   * @param handle Live token returned by this backend's `dafopr` or `dafopw`.
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

  /**
   * Create an empty DLA file and return its backend-owned write token.
   * Close with `dascls` or `dlacls` to finalize the file before reopening.
   * @param path New nonempty backend path; an existing file is an error.
   * @param ftype Nonempty file type; CSPICE retains its first four characters.
   * @param ifname Nonempty internal filename stored in the DAS header.
   * @param ncomch Nonnegative int32 number of comment characters to reserve.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dlaopn_c.html
   */
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
   * @param descr Valid descriptor obtained from this file's `dlabfs`/`dlafns`.
   * Malformed integer fields are rejected before FFI; plausible fields alone
   * cannot establish that a descriptor belongs to the file.
   * @returns All eight descriptor fields on a hit, or `{ found: false }` at end.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dlafns_c.html
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

  /**
   * Create an empty DAS-backed DSK file and return its opaque write token.
   * @param path New nonempty backend path; an existing file is an error.
   * @param ifname Nonempty internal filename stored in the DAS header.
   * @param ncomch Nonnegative int32 comment-character reservation.
   * @returns Token accepted by `dskw02` and finalized with `dascls`/`dlacls`.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dskopn_c.html
   */
  dskopn(path: string, ifname: string, ncomch: number): SpiceHandle;

  /**
   * Build a type-2 DSK spatial index for flattened xyz vertices in km and
   * flattened triangle vertex numbers (one-based, in [1, nv]).
   * Array lengths must equal 3*nv and 3*np. Fine/coarse voxel scales follow
   * CSPICE; `makvtl` controls the optional vertex-to-plate list.
   * @param worksz Positive workspace size, at most 5,000,000 in this contract.
   * @param spxisz Positive integer-index capacity, at most 5,000,000.
   * @returns Ten double values and `spxisz` integers; pass both to `dskw02`.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dskmi2_c.html
   */
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

  /**
   * Append a type-2 DSK segment to a live `dskopn` write token.
   * Vertices are flattened xyz in km; plates contain one-based vertex numbers.
   * Bounds use the selected coordinate system's units, and epochs are ET
   * seconds past J2000. `corpar` has ten elements. Spatial-index components
   * must come from the same mesh's `dskmi2`; declared active integer spans are
   * checked before FFI, including vertex pointers when `makvtl` was false.
   * Close the handle to finalize output before reading it independently.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dskw02_c.html
   */
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
