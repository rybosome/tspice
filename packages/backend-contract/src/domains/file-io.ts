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

/** DAS fixed-file-record counters, in records or characters as named by NAIF. */
export type DasFileRecord = {
  idword: string;
  ifname: string;
  nresvr: number;
  nresvc: number;
  ncomr: number;
  ncomc: number;
};

/** DAS file summary; each last triple is ordered character, double, integer. */
export type DasFileSummary = {
  nresvr: number;
  nresvc: number;
  ncomr: number;
  ncomc: number;
  free: number;
  lastla: [number, number, number];
  lastrc: [number, number, number];
  lastwd: [number, number, number];
};

/** Backend contract for SPICE file I/O primitives (DAF/DAS/DLA). */
export interface FileIoApi {
  /** Append the supplied comment lines to a writable DAF. Printable ASCII is accepted by CSPICE.
   * Trailing spaces are removed and leading/embedded spaces and empty rows are retained.
   * The rectangular UTF-8 input table must fit 256 MiB. Finish any partial extraction before mutation.
   * Adding comment records can relocate arrays and reposition this file's search.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dafac_c.html */
  dafac(handle: SpiceHandle, lines: readonly string[]): void;
  /** Delete the entire comment area of a writable DAF. Finish any partial extraction first.
   * N0067 may relocate array addresses when freeing reserved records.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dafdc_c.html */
  dafdc(handle: SpiceHandle): void;
  /** Extract up to bufsiz lines from this DAF. buffln defaults to 1024 bytes and includes the NUL.
   * A positive rectangular output must fit 256 MiB. Returned lines own their text. Open aliases
   * share one per-file cursor. Reading after done restarts at the beginning. Closing the final
   * local DAF link finishes any partial extraction so the native reader releases its cursor.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dafec_c.html */
  dafec(
    handle: SpiceHandle,
    bufsiz: number,
    buffln?: number,
  ): { n: number; lines: string[]; done: boolean };
  /** Select a writable DAF's current array and replace its packed summary. Supply exactly the file's
   * native-order 8*(ND+ceil(NI/2)) bytes. CSPICE retains the final two integer address fields.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dafrs_c.html */
  dafrs(handle: SpiceHandle, summary: Uint8Array): void;
  /** Pack the effective prefixes of double and signed 32-bit integer components into owned native-order bytes. Double components may include signed zero and IEEE nonfinite values. Negative counts consume zero components; at most 125 words are packed, doubles first. Extra input entries are ignored. An unused odd integer half-word is zeroed before publication.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dafps_c.html */
  dafps(
    nd: number,
    ni: number,
    dc: readonly number[],
    ic: readonly number[],
  ): Uint8Array;
  /** Unpack a native-order DAF summary using the same clipped counts as dafps. The input must contain the requested prefix. Returned arrays own every effective component. Integer words remain exact. JS number outputs preserve NaN classification; byte-oriented APIs retain packed payload bits.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dafus_c.html */
  dafus(
    summary: Uint8Array,
    nd: number,
    ni: number,
  ): { dc: number[]; ic: number[] };
  /** Read a summary record from a live DAF claim. Record and word numbers are one-based. Intersect the inclusive word interval with 1 through 128. Found records may yield zero bytes, and missing records omit data. Returns owned host-order bytes including packed integers. Non-native input must identify a genuine summary record or a missing record; malformed converted summary counts are rejected. The WASM direct-access seek limit is record 2,097,152.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dafgsr_c.html */
  dafgsr(
    handle: SpiceHandle,
    recno: number,
    begin: number,
    end: number,
  ): { found: false } | { found: true; data: Uint8Array };
  /** Read file summary sizes, internal name, first/last summary records and first free address. The default 61-byte capacity includes a terminator. Positive smaller capacities truncate before trailing ASCII blanks are removed. Capacity one yields an empty name. Incomplete or invalid returned UTF-8 is rejected.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dafrfr_c.html */
  dafrfr(
    handle: SpiceHandle,
    ifnlen?: number,
  ): {
    nd: number;
    ni: number;
    ifname: string;
    fward: number;
    bward: number;
    free: number;
  };
  /** Read an inclusive one-based range of native-format physical words as owned bytes, including packed integer or NaN payloads. Unavailable records contribute zero words. This deprecated CSPICE operation requires a live native-format DAF handle. Each call accepts up to 256 MiB of output. WASM supports addresses through 268,435,456.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dafrda_c.html */
  dafrda(handle: SpiceHandle, begin: number, end: number): Uint8Array;
  /** Read an inclusive one-based range containing only double-precision array data through a live DAF handle, including supported non-native file formats. Missing records are zero-filled. The caller supplies a valid numeric data range and may use the segment summary addresses. Each call accepts up to 256 MiB of output. WASM supports addresses through 268,435,456.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dafgda_c.html */
  dafgda(handle: SpiceHandle, begin: number, end: number): number[];

  /** Append printable ASCII comment lines to a writable DAS. Leading/internal spaces
   * and empty rows are retained. Trailing ASCII spaces are dropped. Finish an active
   * extraction first. Input row storage must fit 256 MiB.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dasac_c.html */
  dasac(handle: SpiceHandle, lines: readonly string[]): void;
  /** Delete all DAS comment records. Data logical addresses survive relocation.
   * Requires write access and a finished comment extraction.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dasdc_c.html */
  dasdc(handle: SpiceHandle): void;
  /** Read at most bufsiz lines from a live DAS-backed file, with buffln bytes per
   * row including NUL (default 1024). A rectangular page may occupy up to 256 MiB.
   * Returns only the n defined rows. Read aliases share position; EOF resets the
   * cursor. Explicitly close each link after use, including partially read files.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dasec_c.html */
  dasec(
    handle: SpiceHandle,
    bufsiz: number,
    buffln?: number,
  ): { n: number; lines: string[]; done: boolean };

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

  /**
   * Append n bytes to a DAS or DLA writer. Nonpositive n writes no logical data. The Uint8Array
   * holds complete datlen-byte rows. bpos through epos select inclusive zero-based byte columns.
   * NUL and high bytes are data. New partial physical records have zeroed unused words. Writes
   * remain buffered until normal flush or close. Individual transfer buffers are limited to 256
   * MiB.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dasadc_c.html
   */
  dasadc(
    handle: SpiceHandle,
    n: number,
    bpos: number,
    epos: number,
    datlen: number,
    data: Uint8Array,
  ): void;

  /**
   * Append n doubles to a DAS or DLA writer. Nonpositive n writes no logical data. Doubles
   * preserve IEEE values, including signed zero, infinity and NaN. New partial physical records
   * have zeroed unused words. Writes remain buffered until normal flush or close. Individual
   * transfer buffers are limited to 256 MiB.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dasadd_c.html
   */
  dasadd(handle: SpiceHandle, n: number, data: readonly number[]): void;

  /**
   * Append n integers to a DAS or DLA writer. Nonpositive n writes no logical data. Each integer
   * is signed 32-bit. New partial physical records have zeroed unused words. Writes remain
   * buffered until normal flush or close. Individual transfer buffers are limited to 256 MiB.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dasadi_c.html
   */
  dasadi(handle: SpiceHandle, n: number, data: readonly number[]): void;

  /**
   * Read bytes from inclusive one-based DAS logical addresses first through last. The Uint8Array
   * holds complete datlen-byte rows. bpos through epos select inclusive zero-based byte columns.
   * NUL and high bytes are data. Returns an owned copy of the entire supplied destination,
   * preserving every unselected byte. Individual transfer buffers are limited to 256 MiB.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dasrdc_c.html
   */
  dasrdc(
    handle: SpiceHandle,
    first: number,
    last: number,
    bpos: number,
    epos: number,
    datlen: number,
    data: Uint8Array,
  ): Uint8Array;

  /**
   * Read doubles from inclusive one-based DAS logical addresses first through last. Doubles
   * preserve IEEE values, including signed zero, infinity and NaN. Returns an independent array.
   * Individual transfer buffers are limited to 256 MiB.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dasrdd_c.html
   */
  dasrdd(handle: SpiceHandle, first: number, last: number): number[];

  /**
   * Read integers from inclusive one-based DAS logical addresses first through last. Each
   * integer is signed 32-bit. Returns an independent array. Individual transfer buffers are
   * limited to 256 MiB.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dasrdi_c.html
   */
  dasrdi(handle: SpiceHandle, first: number, last: number): number[];

  /**
   * Replace bytes at inclusive one-based DAS logical addresses first through last. The
   * Uint8Array holds complete datlen-byte rows. bpos through epos select inclusive zero-based
   * byte columns. NUL and high bytes are data. N0067 may advance the source row early at a
   * physical record boundary with nonzero bpos. Supply complete rows for the actual cursor.
   * Individual transfer buffers are limited to 256 MiB.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dasudc_c.html
   */
  dasudc(
    handle: SpiceHandle,
    first: number,
    last: number,
    bpos: number,
    epos: number,
    datlen: number,
    data: Uint8Array,
  ): void;

  /**
   * Replace doubles at inclusive one-based DAS logical addresses first through last. Doubles
   * preserve IEEE values, including signed zero, infinity and NaN. Individual transfer buffers
   * are limited to 256 MiB.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dasudd_c.html
   */
  dasudd(
    handle: SpiceHandle,
    first: number,
    last: number,
    data: readonly number[],
  ): void;

  /**
   * Replace integers at inclusive one-based DAS logical addresses first through last. Each
   * integer is signed 32-bit. Individual transfer buffers are limited to 256 MiB.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dasudi_c.html
   */
  dasudi(
    handle: SpiceHandle,
    first: number,
    last: number,
    data: readonly number[],
  ): void;

  /**
   * Create a named DAS for writing and return an owned token. File type is
   * case-sensitive; the first four bytes starting at the first nonblank byte are
   * stored in the eight-byte ID word. Internal name has 60 bytes. ncomr counts
   * 1024-byte comment records. Physical pathname must fit the 255-byte toolkit
   * field. Record and seek bounds depend on platform. Explicit VirtualOutput
   * supports readback after close. Node accepts a filesystem path; WASM uses /kernels.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dasonw_c.html
   */
  dasonw(
    file: string | VirtualOutput,
    ftype: string,
    ifname: string,
    ncomr: number,
  ): SpiceHandle;

  /**
   * Open an unnamed temporary DAS writer. Closing releases the scratch file.
   * DASHFN may return an empty name. N0067 can retain the previous file's ID
   * word in the scratch record; the internal file name is DAS SCRATCH FILE.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dasops_c.html
   */
  dasops(): SpiceHandle;

  /**
   * Open an existing native-format DAS for exclusive write. Ordinary string
   * paths may open an existing DAS. A VirtualOutput must previously have been
   * created by dasonw on this backend. Conflicting open access signals a SPICE error.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dasopw_c.html
   */
  dasopw(file: string | VirtualOutput): SpiceHandle;

  /**
   * Return the actual CSPICE file name, which may be an owner-specific staged
   * path or an empty scratch name. namlen includes the NUL byte; default 256.
   * Short positive capacities truncate; a truncated invalid UTF-8 sequence throws.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dashfn_c.html
   */
  dashfn(handle: SpiceHandle, namlen?: number): string;

  /**
   * Return the in-memory file summary, including the first free record,
   * last logical addresses, descriptor record numbers and descriptor word
   * positions. Each three-element field is ordered character, double, integer.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dashfs_c.html
   */
  dashfs(handle: SpiceHandle): DasFileSummary;

  /**
   * Return the last character, double and integer logical addresses. A zero
   * address means that type has no data. DAS logical addresses start at one.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/daslla_c.html
   */
  daslla(handle: SpiceHandle): { lastc: number; lastd: number; lasti: number };

  /**
   * Low-level close of a caller-owned DAS/DLA claim. This releases one link
   * without flushing updated data buffers or segregating records. Flush a writer
   * first with daswbr, or use dascls for normal finalization. Low-closing a
   * dirty writer may lose writes and leave stale N0067 process-global buffers
   * that can cause a later operation on a different file to fail.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dasllc_c.html
   */
  dasllc(handle: SpiceHandle): void;

  /**
   * Read ID word, internal filename and all four counters from the file record.
   * The default byte capacities 9 and 61 include NUL. Each length is independent;
   * one-byte capacity signals STRINGTOOSHORT. Output must be representable UTF-8.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dasrfr_c.html
   */
  dasrfr(handle: SpiceHandle, idwlen?: number, ifnlen?: number): DasFileRecord;

  /**
   * Write this open writer's buffered DAS data records without closing it or
   * segregating the file. A read-only handle signals an actual toolkit access error.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/daswbr_c.html
   */
  daswbr(handle: SpiceHandle): void;

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

  /** Return the last DLA segment with all eight descriptor words, or a miss on an empty file.
   * A newly begun segment has provisional component sizes of −1 until finalized.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dlabbs_c.html */
  dlabbs(handle: SpiceHandle): FoundDlaDescriptor;
  /** Append and link a new segment to a writable DLA. Its descriptor precedes its integer data.
   * Supply component data via DAS appends, then finalize this segment with dlaens.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dlabns_c.html */
  dlabns(handle: SpiceHandle): void;
  /** Finalize the last segment's character, double and integer sizes from the file's
   * current logical addresses. The file remains open. A segment must exist.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dlaens_c.html */
  dlaens(handle: SpiceHandle): void;
  /** Follow the backward link in a descriptor from this DLA, or return a miss at the first segment.
   * A segment's data start at each base address plus one.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dlafps_c.html */
  dlafps(
    handle: SpiceHandle,
    descr: Readonly<DlaDescriptor>,
  ): FoundDlaDescriptor;

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
