/**
 * Contract conventions:
 * - Inputs are assumed validated at the backend boundary; the contract itself is primarily type-level.
 * - Methods throw on invalid arguments or SPICE errors.
 * - Lookups that may legitimately miss return `Found<T>` (`{ found: false }`) instead of throwing.
 */

import type { SpiceHandle } from "../shared/types.js";

/**
 * Result of running an EK query via `ekfind`.
 *
 * Notes:
 * - `ekfind` has a *non-standard* error reporting mechanism: query parse/semantic
 *   failures are returned via an `error/errmsg` output pair rather than SPICE's
 *   global error state.
 * - Backend implementations should surface that query-specific failure via this
 *   return type (no throw).
 * - SPICE-signaled failures (e.g. no loaded EKs) should still throw.
 */
export type EkFindResult =
  | {
      ok: true;
      /** Number of matching rows. */
      nmrows: number;
    }
  | {
      ok: false;
      /** Query language parse/semantic error message returned by `ekfind_c`. */
      errmsg: string;
    };

/**
 * Result of fetching an element from an EK query result set.
 *
 * This is a tri-state:
 * - `{ found: false }`: the requested element doesn't exist (commonly `elment`
 *   is out of range for the entry).
 * - `{ found: true, isNull: true }`: the entry exists but is SQL NULL.
 * - `{ found: true, isNull: false, value: T }`: a concrete value.
 */
export type EkGetResult<T> =
  | { found: false }
  | { found: true; isNull: true }
  | { found: true; isNull: false; value: T };

/** Backend contract for EK (Events Kernel) file/query operations. */
export interface EkApi {
  /**
   * Open an existing EK for read and return a backend-owned opaque token.
   * Duplicate read opens retain separate claims; close each explicitly.
   * Opening a file does not load its tables for queries.
   * @param path Existing backend filesystem path.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ekopr_c.html
   */
  ekopr(path: string): SpiceHandle;

  /**
   * Open an existing EK for writing, for example to append another segment.
   * @param path Existing backend filesystem path; conflicting read claims throw.
   * @returns Backend-owned token to finalize and close explicitly with `ekcls`.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ekopw_c.html
   */
  ekopw(path: string): SpiceHandle;

  /**
   * Create and open a new EK file for write (see `ekopn_c`).
   *
   * @param path New backend filesystem path; an existing output is an error.
   * @param ifname Internal label; CSPICE stores its first 60 C-string bytes.
   * @param ncomch Nonnegative int32 comment-character reservation.
   * @returns Backend-owned opaque write token; complete fast writes and close
   * with `ekcls` before independently reading the output.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ekopn_c.html
   */
  ekopn(path: string, ifname: string, ncomch: number): SpiceHandle;

  /**
   * Close an EK file opened via `ekopr` / `ekopw` / `ekopn` (see `ekcls_c`).
   *
   * Notes:
   * - EK handles are explicit resources and are not automatically closed by `unload()` / `kclear()`.
   * - If `path` was backed by byte-staged temp bytes, close EK handles before calling
   *   `unload()` / `kclear()` to allow best-effort temp file deletion (especially on Windows).
   * - Public tokens reject wrong-kind, foreign and already-closed claims before
   *   FFI; CSPICE's numeric close permits unrecognized handles as no-ops.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ekcls_c.html
   */
  ekcls(handle: SpiceHandle): void;

  /**
   * Number of logical EK tables currently loaded for querying. Multiple
   * segments/files with the same table name contribute one table; simply
   * opening an EK handle does not load its tables.
   *
   * Postconditions:
   * - Returns an integer count `n` with `0 <= n <= 2_147_483_647`.
   * - Backends should validate this postcondition and throw if violated.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ekntab_c.html
   */
  ekntab(): number;

  /**
   * Retrieve the EK table name by 0-based index (see `ektnam_c`).
   *
   * `n` must be in the range `0..ekntab()-1`. Empty state and out-of-range
   * access signal toolkit errors; negative/fractional indices fail preflight.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ektnam_c.html
   */
  ektnam(n: number): string;

  /**
   * Number of physical segments in an EK opened for read access, including
   * zero for an empty EK. This differs from the logical loaded-table count.
   *
   * Postconditions:
   * - Returns an integer count `n` with `0 <= n <= 2_147_483_647`.
   * - Backends should validate this postcondition and throw if violated.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/eknseg_c.html
   */
  eknseg(handle: SpiceHandle): number;

  // --- Query/data ops ------------------------------------------------------

  /**
   * Execute an EK query (see `ekfind_c`).
   *
   * Notes:
   * - EK query results live in CSPICE global state.
   * - Beginning fast-write via `ekifld` can invalidate the active selection/result set.
   *   Avoid interleaving `ekfind`/`ekg*` reads with fast-write; rerun `ekfind` after fast-write
   *   if you need to read again.
   */
  ekfind(query: string): EkFindResult;

  /**
   * Fetch a character-valued element from the active query result set (see `ekgc_c`).
   *
   * Indices are 0-based per NAIF:
   * - `selidx`: 0-based index of the selected item in the query's `SELECT` clause.
   * - `row`: 0-based row index in the result set (`0..nmrows-1` from the last successful `ekfind`).
   * - `elment`: 0-based element index within the cell entry (`0` for scalar entries).
   */
  ekgc(selidx: number, row: number, elment: number): EkGetResult<string>;

  /**
   * Fetch a double-valued element from the active query result set (see `ekgd_c`).
   *
   * Indices are 0-based per NAIF:
   * - `selidx`: 0-based index of the selected item in the query's `SELECT` clause.
   * - `row`: 0-based row index in the result set (`0..nmrows-1` from the last successful `ekfind`).
   * - `elment`: 0-based element index within the cell entry (`0` for scalar entries).
   */
  ekgd(selidx: number, row: number, elment: number): EkGetResult<number>;

  /**
   * Fetch an integer-valued element from the active query result set (see `ekgi_c`).
   *
   * Indices are 0-based per NAIF:
   * - `selidx`: 0-based index of the selected item in the query's `SELECT` clause.
   * - `row`: 0-based row index in the result set (`0..nmrows-1` from the last successful `ekfind`).
   * - `elment`: 0-based element index within the cell entry (`0` for scalar entries).
   */
  ekgi(selidx: number, row: number, elment: number): EkGetResult<number>;

  // --- Fast write ----------------------------------------------------------

  /**
   * Begin fast-write for a new EK segment (see `ekifld_c`).
   *
   * Returns `segno` (new segment number) and the `rcptrs` workspace array.
   * `rcptrs` must be passed to the subsequent column-add calls and to `ekffld`.
   *
   * Only one segment may be in fast-write at a time. Add every column and
   * complete it with `ekffld` before any other EK operation, including queries.
   * Rerun `ekfind` afterward if the earlier selection is needed.
   * @param nrows Positive int32 row count, at most 1,000,000 in this contract.
   * @param cnames One to 100 column names (N0067's maximum); a string array.
   * @param decls Matching declaration strings. CSPICE defaults SIZE to 1,
   * INDEXED to FALSE and NULLS_OK to FALSE when omitted.
   * @returns Zero-based segment number and exactly `nrows` record pointers.
   * Treat these pointers as unchanged workspace for this file/segment only.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ekifld_c.html
   */
  ekifld(
    handle: SpiceHandle,
    tabnam: string,
    nrows: number,
    cnames: readonly string[],
    decls: readonly string[],
  ): { segno: number; rcptrs: number[] };

  /**
   * Add an integer column's data to a fast-write segment (see `ekacli_c`).
   *
   * Packing:
   * - `entszs`, `nlflgs`, and `rcptrs` are per-row arrays and must have the same length
   *   `nrows` (the `nrows` passed to `ekifld`, i.e. `rcptrs.length`).
   * - `ivals` is a packed array containing exactly `sum(entszs)` values.
   *
   * NULL rows (`nlflgs[i] === true`):
   * - Variable-size columns: set `entszs[i] = 0` and do not include any values for that row.
   * - Fixed-size columns (`SIZE = N`): include/pad `N` placeholder values for that row and set
   *   `entszs[i] = N` so `ivals.length === sum(entszs)` remains true.
   */
  ekacli(
    handle: SpiceHandle,
    segno: number,
    column: string,
    ivals: readonly number[],
    entszs: readonly number[],
    nlflgs: readonly boolean[],
    rcptrs: readonly number[],
  ): void;

  /**
   * Add a double-precision column's data to a fast-write segment (see `ekacld_c`).
   *
   * Packing:
   * - `entszs`, `nlflgs`, and `rcptrs` are per-row arrays and must have the same length
   *   `nrows` (the `nrows` passed to `ekifld`, i.e. `rcptrs.length`).
   * - `dvals` is a packed array containing exactly `sum(entszs)` values.
   *
   * NULL rows (`nlflgs[i] === true`):
   * - Variable-size columns: set `entszs[i] = 0` and do not include any values for that row.
   * - Fixed-size columns (`SIZE = N`): include/pad `N` placeholder values for that row and set
   *   `entszs[i] = N` so `dvals.length === sum(entszs)` remains true.
   */
  ekacld(
    handle: SpiceHandle,
    segno: number,
    column: string,
    dvals: readonly number[],
    entszs: readonly number[],
    nlflgs: readonly boolean[],
    rcptrs: readonly number[],
  ): void;

  /**
   * Add a character column's data to a fast-write segment (see `ekaclc_c`).
   *
   * Packing:
   * - `entszs`, `nlflgs`, and `rcptrs` are per-row arrays and must have the same length
   *   `nrows` (the `nrows` passed to `ekifld`, i.e. `rcptrs.length`).
   * - `cvals` is a packed array containing exactly `sum(entszs)` values.
   *
   * NULL rows (`nlflgs[i] === true`):
   * - Variable-size columns: set `entszs[i] = 0` and do not include any values for that row.
   * - Fixed-size columns (`SIZE = N`): include/pad `N` placeholder values for that row and set
   *   `entszs[i] = N` so `cvals.length === sum(entszs)` remains true.
   */
  ekaclc(
    handle: SpiceHandle,
    segno: number,
    column: string,
    cvals: readonly string[],
    entszs: readonly number[],
    nlflgs: readonly boolean[],
    rcptrs: readonly number[],
  ): void;

  /** Complete a fast-write segment (see `ekffld_c`). */
  ekffld(handle: SpiceHandle, segno: number, rcptrs: readonly number[]): void;
}
