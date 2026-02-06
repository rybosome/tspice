/**
* Low-level SPICE "cells" and DP windows.
*
* Contract notes:
* - Cells/windows are **opaque handles** created by the backend and mutated in-place.
* - Capacity is fixed at creation time; overflow should throw (CSPICE-like).
* - Inspection is done via the raw operations here (no `.data` exposure).
*/

// Type-only brands (no runtime Symbol export).
declare const __spiceIntCellBrand: unique symbol;
declare const __spiceDoubleCellBrand: unique symbol;
declare const __spiceCharCellBrand: unique symbol;
declare const __spiceWindowBrand: unique symbol;

/** Opaque handle to a CSPICE `SpiceCell` of type `SPICE_INT`. */
export type SpiceIntCell = number & { readonly [__spiceIntCellBrand]: true };
/** Opaque handle to a CSPICE `SpiceCell` of type `SPICE_DP`. */
export type SpiceDoubleCell = number & { readonly [__spiceDoubleCellBrand]: true };
/** Opaque handle to a CSPICE `SpiceCell` of type `SPICE_CHR`. */
export type SpiceCharCell = number & { readonly [__spiceCharCellBrand]: true };
/** Opaque handle to a CSPICE DP window (a `SPICE_DP` cell interpreted as intervals). */
export type SpiceWindow = number & { readonly [__spiceWindowBrand]: true };

export interface CellsWindowsApi {
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

  // -- Cell descriptor ops (CSPICE `*_c`) ------------------------------------

  /** Set the maximum cardinality of a cell. (`ssize_c`) */
  ssize(size: number, cell: SpiceIntCell | SpiceDoubleCell | SpiceCharCell | SpiceWindow): void;

  /** Set the cardinality of a cell. (`scard_c`) */
  scard(card: number, cell: SpiceIntCell | SpiceDoubleCell | SpiceCharCell | SpiceWindow): void;

  /** Get the cardinality of a cell. (`card_c`) */
  card(cell: SpiceIntCell | SpiceDoubleCell | SpiceCharCell | SpiceWindow): number;

  /** Get the maximum cardinality of a cell. (`size_c`) */
  size(cell: SpiceIntCell | SpiceDoubleCell | SpiceCharCell | SpiceWindow): number;

  /** Validate and normalize a set cell. (`valid_c`) */
  valid(
    size: number,
    n: number,
    cell: SpiceIntCell | SpiceDoubleCell | SpiceCharCell | SpiceWindow,
  ): void;

  // -- Set insertors ----------------------------------------------------------

  /** Insert an integer into an integer set cell. (`insrti_c`) */
  insrti(item: number, cell: SpiceIntCell): void;

  /** Insert a double into a double set cell. (`insrtd_c`) */
  insrtd(item: number, cell: SpiceDoubleCell): void;

  /** Insert a string into a character set cell. (`insrtc_c`) */
  insrtc(item: string, cell: SpiceCharCell): void;

  // -- Cell element inspection (copies, no raw data views) -------------------

  /**
   * Element inspection helpers.
   *
   * These are intentionally part of the public backend contract so callers can
   * write tests / diagnostics without exposing raw memory views.
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

  // -- Windows ----------------------------------------------------------------

  /** Insert an interval into a DP window, merging overlaps. (`wninsd_c`) */
  wninsd(left: number, right: number, window: SpiceWindow): void;

  /** Return the number of intervals in a DP window. (`wncard_c`) */
  wncard(window: SpiceWindow): number;

  /** Fetch the `index`th interval from a DP window. (`wnfetd_c`) */
  wnfetd(window: SpiceWindow, index: number): readonly [left: number, right: number];

  /** Validate and normalize a DP window. (`wnvald_c`) */
  wnvald(size: number, n: number, window: SpiceWindow): void;
}
