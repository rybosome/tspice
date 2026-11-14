/**
 * Low-level SPICE "cells" and DP windows.
 *
 * Contract notes:
 * - Cells/windows are **opaque handles** created by the backend and mutated in-place.
 * - Capacity is fixed at creation time; overflow should throw (CSPICE-like).
 * - Handles are opaque numbers, not C pointers or SpiceInt values. Preserve the
 *   full number without bitwise truncation and use its owning execution context
 *   (a native process or one WASM module). Freed handles must not be reused.
 */

// Type-only brands (no runtime Symbol export).
declare const __spiceIntCellBrand: unique symbol;
declare const __spiceDoubleCellBrand: unique symbol;
declare const __spiceCharCellBrand: unique symbol;
declare const __spiceWindowBrand: unique symbol;

/** Opaque handle to a CSPICE `SpiceCell` of type `SPICE_INT`. */
export type SpiceIntCell = number & { readonly [__spiceIntCellBrand]: true };
/** Opaque handle to a CSPICE `SpiceCell` of type `SPICE_DP`. */
export type SpiceDoubleCell = number & {
  readonly [__spiceDoubleCellBrand]: true;
};
/** Opaque handle to a CSPICE `SpiceCell` of type `SPICE_CHR`. */
export type SpiceCharCell = number & { readonly [__spiceCharCellBrand]: true };
/** Opaque handle to a CSPICE DP window (a `SPICE_DP` cell interpreted as intervals). */
export type SpiceWindow = number & { readonly [__spiceWindowBrand]: true };

/**
 * Backend-only cell/window helpers exposed to higher-level kit code.
 *
 * These are intentionally split from {@link CellsWindowsApi} so raw/kit
 * surfaces can evolve independently while backends still provide native hooks
 * for allocation and inspection. Backing byte sizes must fit the runtime address
 * space; impossible allocations throw before payload allocation.
 */
export interface CellsWindowsKitApi {
  // -- Creation / destruction -------------------------------------------------

  /** Create an empty integer set cell with the given capacity. */
  newIntCell(size: number): SpiceIntCell;

  /** Create an empty double-precision set cell with the given capacity. */
  newDoubleCell(size: number): SpiceDoubleCell;

  /**
   * Create an empty character set cell.
   *
   * `length` is the maximum string length (including trailing NUL). CSPICE
   * generally expects `length >= 2` and recommends `length >= 5`.
   */
  newCharCell(size: number, length: number): SpiceCharCell;

  /** Create an empty DP window with capacity for `maxIntervals` intervals. */
  newWindow(maxIntervals: number): SpiceWindow;

  /** Free a previously-created cell handle. */
  freeCell(cell: SpiceIntCell | SpiceDoubleCell | SpiceCharCell): void;

  /** Free a previously-created window handle. */
  freeWindow(window: SpiceWindow): void;

  // -- Cell element inspection (copies, no raw data views) -------------------

  /**
   * Element inspection helpers.
   *
   * Notes:
   * - These methods **copy** data out of the underlying cell.
   * - They are not intended as a high-performance bulk read API.
   */

  /** Fetch the `index`th element of an integer cell. */
  cellGeti(cell: SpiceIntCell, index: number): number;

  /** Fetch the `index`th element of a double cell. */
  cellGetd(cell: SpiceDoubleCell, index: number): number;

  /**
   * Fetch the `index`th element of a character cell.
   *
   * Backends may right-trim whitespace to match common CSPICE string handling.
   */
  cellGetc(cell: SpiceCharCell, index: number): string;
}

/** Backend contract for low-level raw SPICE cell/window operations. */
export interface CellsWindowsApi {
  /**
   * Parse a list into a live caller-owned character set. Delimiters are
   * individual bytes; ASCII blank clusters around another delimiter count as
   * one separator. Repeated nonblank delimiters can create an empty item.
   * Items are sorted and deduplicated after fixed-width truncation. An empty
   * list inserts an empty item into the existing set; a nonempty list replaces
   * the set. Read the resulting cardinality and entries with card and cellGetc.
   * N0067 can replace some rows before reporting insufficient capacity.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lparss_c.html
   */
  lparss(list: string, delims: string, set: SpiceCharCell): void;

  // -- Cells ------------------------------------------------------------------

  /**
   * Set logical capacity and clear cardinality, preserving backing allocation.
   * The non-negative size must not exceed the capacity originally allocated.
   * A previously reduced size may be restored within that original bound.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ssize_c.html
   */
  ssize(
    size: number,
    cell: SpiceIntCell | SpiceDoubleCell | SpiceCharCell | SpiceWindow,
  ): void;

  /**
   * Set cardinality without sorting, initializing, or clearing stored elements.
   * `card` must be a non-negative SpiceInt no greater than logical capacity;
   * exceeding capacity signals SPICE(INVALIDCARDINALITY). Use zero to empty a
   * set/window; subsequent insertion overwrites retired data as needed.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/scard_c.html
   */
  scard(
    card: number,
    cell: SpiceIntCell | SpiceDoubleCell | SpiceCharCell | SpiceWindow,
  ): void;

  /**
   * Return stored element count; for windows this counts endpoints, not intervals.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/card_c.html
   */
  card(
    cell: SpiceIntCell | SpiceDoubleCell | SpiceCharCell | SpiceWindow,
  ): number;

  /**
   * Return logical maximum element count, independently of current cardinality.
   * For windows this counts endpoints. Insertion does not resize storage.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/size_c.html
   */
  size(
    cell: SpiceIntCell | SpiceDoubleCell | SpiceCharCell | SpiceWindow,
  ): number;

  /**
   * Sort/deduplicate the first `n` stored elements into a set of logical `size`.
   * Size must fit the original allocation and n must fit size. The shim rejects
   * sizes beyond allocated storage before CSPICE can change the descriptor.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/valid_c.html
   */
  valid(
    size: number,
    n: number,
    cell: SpiceIntCell | SpiceDoubleCell | SpiceCharCell | SpiceWindow,
  ): void;

  /**
   * Insert a signed 32-bit integer into a sorted integer set, ignoring duplicates.
   * A new value beyond capacity signals SPICE(SETEXCESS); duplicates in a full
   * set succeed. The handle must belong to a live integer cell.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/insrti_c.html
   */
  insrti(item: number, cell: SpiceIntCell): void;

  /**
   * Insert a double into a sorted double set, ignoring duplicates.
   * A new value beyond capacity signals SPICE(SETEXCESS); the live handle must
   * refer to a double cell. No units or tolerance are applied to set membership.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/insrtd_c.html
   */
  insrtd(item: number, cell: SpiceDoubleCell): void;

  /**
   * Insert a string into a sorted character set, ignoring duplicates. CSPICE
   * compares keys after truncation to cell string length (excluding NUL), ignores
   * trailing blanks, and preserves leading blanks. A new key beyond capacity
   * signals SPICE(SETEXCESS). Non-string JavaScript inputs throw TypeError.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/insrtc_c.html
   */
  insrtc(item: string, cell: SpiceCharCell): void;

  // -- Windows ----------------------------------------------------------------

  /**
   * Insert closed [left, right], merging overlapping or touching intervals.
   * Endpoints use caller units; equal endpoints create singleton intervals.
   * Reversed endpoints signal SPICE(BADENDPOINTS); insufficient endpoint storage
   * signals SPICE(WINDOWEXCESS). Insertion mutates the live window in place.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/wninsd_c.html
   */
  wninsd(left: number, right: number, window: SpiceWindow): void;

  /**
   * Return interval count (half the endpoint cardinality) of a live DP window.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/wncard_c.html
   */
  wncard(window: SpiceWindow): number;

  /**
   * Return [left, right] for a zero-based interval index in caller endpoint units.
   * Index must be a non-negative SpiceInt; an index beyond stored intervals
   * signals SPICE(NOINTERVAL). The returned pair is a copy.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/wnfetd_c.html
   */
  wnfetd(
    window: SpiceWindow,
    index: number,
  ): readonly [left: number, right: number];

  /**
   * Sort and merge the first `n` endpoints into a normalized DP window. Size/n
   * count endpoints, n must be even, and size must fit the original allocation.
   * Invalid endpoint counts/bounds signal CSPICE errors; allocated bounds are
   * checked before entering CSPICE.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/wnvald_c.html
   */
  wnvald(size: number, n: number, window: SpiceWindow): void;
}
