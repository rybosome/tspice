/**
 * Low-level SPICE "cells" and DP windows.
 *
 * Contract notes:
 * - Cells/windows are **opaque handles** created by the backend and mutated in-place.
 * - Capacity is fixed at creation time; overflow should throw (CSPICE-like).
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

/** Backend contract for low-level SPICE cell/window operations. */
export interface CellsWindowsApi {

  // -- Cells ------------------------------------------------------------------

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

  /** Insert an integer into an integer set cell. (`insrti_c`) */
  insrti(item: number, cell: SpiceIntCell): void;

  /** Insert a double into a double set cell. (`insrtd_c`) */
  insrtd(item: number, cell: SpiceDoubleCell): void;

  /** Insert a string into a character set cell. (`insrtc_c`) */
  insrtc(item: string, cell: SpiceCharCell): void;

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
