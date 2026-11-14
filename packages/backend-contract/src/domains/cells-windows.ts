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

/** Three ordinary cells of the same CSPICE element type, in input/input/result order. */
type SetOperationArgs =
  | [a: SpiceCharCell, b: SpiceCharCell, result: SpiceCharCell]
  | [a: SpiceDoubleCell, b: SpiceDoubleCell, result: SpiceDoubleCell]
  | [a: SpiceIntCell, b: SpiceIntCell, result: SpiceIntCell];

type SetRelationArgs =
  | [a: SpiceCharCell, op: string, b: SpiceCharCell]
  | [a: SpiceDoubleCell, op: string, b: SpiceDoubleCell]
  | [a: SpiceIntCell, op: string, b: SpiceIntCell];

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
  // -- Cells ------------------------------------------------------------------

  /**
   * Append a NUL-free string to an ordinary character cell, retaining order and duplicates.
   * CSPICE compares the full UTF-8 input with the previous stored row before copying
   * at most length−1 bytes. Thus two distinct inputs can store the same prefix while
   * isSet remains true. Truncating a UTF-8 scalar is rejected before writing.
   * A full cell signals SPICE(CELLTOOSMALL), even for duplicates.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/appndc_c.html
   */
  appndc(item: string, cell: SpiceCharCell): void;

  /**
   * Append an ordered double, including either infinity, to an ordinary double cell.
   * Duplicates and out-of-order values are stored and clear the set flag.
   * NaN is rejected. A full cell signals SPICE(CELLTOOSMALL).
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/appndd_c.html
   */
  appndd(item: number, cell: SpiceDoubleCell): void;

  /**
   * Append a signed 32-bit integer to an ordinary integer cell without sorting.
   * Duplicates and out-of-order values are stored and clear the set flag.
   * A full cell signals SPICE(CELLTOOSMALL), even for duplicates.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/appndi_c.html
   */
  appndi(item: number, cell: SpiceIntCell): void;

  /**
   * Test membership in a sorted, set-flagged character cell. The full NUL-free
   * UTF-8 key is compared case-sensitively with stored bytes. Trailing ASCII
   * spaces are insignificant, tabs are significant. An empty set returns false.
   * An unset set flag signals SPICE(NOTASET).
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/elemc_c.html
   */
  elemc(item: string, cell: SpiceCharCell): boolean;

  /**
   * Test exact membership in a sorted, set-flagged double cell, including
   * either infinity. NaN is rejected. An empty set returns false and an unset
   * set flag signals SPICE(NOTASET).
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/elemd_c.html
   */
  elemd(item: number, cell: SpiceDoubleCell): boolean;

  /**
   * Test exact membership of a signed 32-bit integer in a sorted, set-flagged
   * integer cell. An empty set returns false and an unset set flag signals
   * SPICE(NOTASET).
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/elemi_c.html
   */
  elemi(item: number, cell: SpiceIntCell): boolean;

  /**
   * Write the sorted elements of a that are absent from b. Character result rows
   * must be at least as wide as a. Pass distinct input and result cells; both
   * inputs must be sorted sets. SETEXCESS can write a prefix while the result
   * descriptor retains its old cardinality. Reset with scard(0, result) before
   * reusing as empty.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/diff_c.html
   */
  diff(...args: SetOperationArgs): void;

  /**
   * Write the sorted common elements of a and b. Character result rows must be at
   * least as wide as both inputs. Pass distinct input and result cells; both
   * inputs must be sorted sets. SETEXCESS can write a prefix while the result
   * descriptor retains its old cardinality. Reset with scard(0, result) before
   * reusing as empty.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/inter_c.html
   */
  inter(...args: SetOperationArgs): void;

  /**
   * Write the sorted elements belonging to exactly one input. Character result
   * rows must be at least as wide as both inputs. Pass distinct input and result
   * cells; both inputs must be sorted sets. SETEXCESS can write a prefix while the
   * result descriptor retains its old cardinality. Reset with scard(0, result)
   * before reusing as empty.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/sdiff_c.html
   */
  sdiff(...args: SetOperationArgs): void;

  /**
   * Write the sorted union, retaining each common element once. Character result
   * rows must be at least as wide as both inputs. Pass distinct input and result
   * cells; both inputs must be sorted sets. SETEXCESS can write a prefix while the
   * result descriptor retains its old cardinality. Reset with scard(0, result)
   * before reusing as empty.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/union_c.html
   */
  union(...args: SetOperationArgs): void;

  /**
   * Compare two ordinary, same-type sets using <, <=, =, <>, >, >=, & (intersect),
   * or ~ (disjoint). The two input handles may coincide. CSPICE reports invalid
   * operators and unset set flags.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/set_c.html
   */
  set(...args: SetRelationArgs): boolean;

  /**
   * Remove a NUL-free UTF-8 character member in place. An absent item leaves the
   * set unchanged. Requires a sorted, set-flagged ordinary cell.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/removc_c.html
   */
  removc(item: string, cell: SpiceCharCell): void;

  /**
   * Remove a ordered double (including either infinity) member in place. An absent
   * item leaves the set unchanged. Requires a sorted, set-flagged ordinary cell.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/removd_c.html
   */
  removd(item: number, cell: SpiceDoubleCell): void;

  /**
   * Remove a signed 32-bit integer member in place. An absent item leaves the set
   * unchanged. Requires a sorted, set-flagged ordinary cell.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/removi_c.html
   */
  removi(item: number, cell: SpiceIntCell): void;

  /**
   * Return the zero-based ordinal of a NUL-free UTF-8 character member, or −1 if
   * absent. Requires a sorted, set-flagged ordinary cell.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ordc_c.html
   */
  ordc(item: string, cell: SpiceCharCell): number;

  /**
   * Return the zero-based ordinal of a ordered double (including either infinity)
   * member, or −1 if absent. Requires a sorted, set-flagged ordinary cell.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ordd_c.html
   */
  ordd(item: number, cell: SpiceDoubleCell): number;

  /**
   * Return the zero-based ordinal of a signed 32-bit integer member, or −1 if
   * absent. Requires a sorted, set-flagged ordinary cell.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ordi_c.html
   */
  ordi(item: number, cell: SpiceIntCell): number;

  /**
   * Copy elements in order into a live, same-type ordinary cell, preserving its
   * capacity and set flag. Self-copy is supported. Use valid before membership if
   * the copied contents were unsorted. Numeric copies that signal CELLTOOSMALL
   * can write the fitting prefix while the destination descriptor retains its old
   * cardinality. Reset with scard(0, destination) before reusing it as empty.
   * Character copies use temporary storage, trim trailing ASCII spaces on success,
   * and leave the destination untouched on capacity or row-width errors. Both
   * character widths must accommodate the five-byte Fortran control encoding
   * plus NUL. Narrower destination rows can accept values whose nonblank bytes fit.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/copy_c.html
   */
  copy(
    ...args:
      | [source: SpiceCharCell, destination: SpiceCharCell]
      | [source: SpiceDoubleCell, destination: SpiceDoubleCell]
      | [source: SpiceIntCell, destination: SpiceIntCell]
  ): void;

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

  /**
   * Write the closure of the complement of window inside [left,right] to result.
   * Boundary points can belong to both the input and the complement. Finite
   * left > right signals SPICE(BADENDPOINTS).
   *
   * Supply a distinct result window with enough endpoint slots for the output.
   * An undersized result can signal a CSPICE error after partial writes.
   * On a failed result write, card(result) can retain the old C descriptor
   * cardinality while wncard/wnfetd expose the written Fortran window.
   * Clear with scard(0,result) before reusing it as an empty destination.
   * Result capacity must be even.
   *
   * Use live windows from kit.newWindow in the owning backend. Stored
   * intervals must be ordered, disjoint and closed. No kernels are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/wncomd_c.html
   */
  wncomd(
    left: number,
    right: number,
    window: SpiceWindow,
    result: SpiceWindow,
  ): void;

  /**
   * Contract each interval in place by adding left to its left endpoint and
   * subtracting right from its right endpoint. Negative amounts expand.
   * Reversed intervals disappear and overlapping or touching intervals merge.
   * Finite amounts can produce nonfinite endpoints through arithmetic overflow.
   *
   * Use live windows from kit.newWindow in the owning backend. Stored
   * intervals must be ordered, disjoint and closed. No kernels are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/wncond_c.html
   */
  wncond(left: number, right: number, window: SpiceWindow): void;

  /**
   * Write the closure of the set difference a minus b to result. Boundary
   * points can belong to both the output and b. The inputs may be identical.
   *
   * Supply a distinct result window with enough endpoint slots for the output.
   * An undersized result can signal a CSPICE error after partial writes.
   * On a failed result write, card(result) can retain the old C descriptor
   * cardinality while wncard/wnfetd expose the written Fortran window.
   * Clear with scard(0,result) before reusing it as an empty destination.
   * Result capacity must be even.
   *
   * Use live windows from kit.newWindow in the owning backend. Stored
   * intervals must be ordered, disjoint and closed. No kernels are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/wndifd_c.html
   */
  wndifd(a: SpiceWindow, b: SpiceWindow, result: SpiceWindow): void;

  /**
   * Test whether a finite point lies in any closed interval of window.
   * Endpoints are included. An empty window returns false.
   *
   * Use live windows from kit.newWindow in the owning backend. Stored
   * intervals must be ordered, disjoint and closed. No kernels are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/wnelmd_c.html
   */
  wnelmd(point: number, window: SpiceWindow): boolean;

  /**
   * Expand each interval in place by subtracting left from its left endpoint
   * and adding right to its right endpoint. Negative amounts contract. Reversed
   * intervals disappear and overlapping or touching intervals merge. Finite
   * amounts can produce nonfinite endpoints through arithmetic overflow.
   *
   * Use live windows from kit.newWindow in the owning backend. Stored
   * intervals must be ordered, disjoint and closed. No kernels are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/wnexpd_c.html
   */
  wnexpd(left: number, right: number, window: SpiceWindow): void;

  /**
   * Replace each interval with a singleton at the selected endpoint. L/l
   * selects the left endpoint and R/r the right. The side is one ASCII byte.
   * Other bytes reach CSPICE and signal SPICE(INVALIDENDPNTSPEC).
   *
   * Use live windows from kit.newWindow in the owning backend. Stored
   * intervals must be ordered, disjoint and closed. No kernels are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/wnextd_c.html
   */
  wnextd(side: string, window: SpiceWindow): void;

  /**
   * Fill gaps between successive intervals in place when their width is at
   * most small. The signed threshold is used directly. The pinned comparison
   * adds small to the preceding right endpoint before comparing the next left
   * endpoint, so floating-point rounding applies at the threshold.
   *
   * Use live windows from kit.newWindow in the owning backend. Stored
   * intervals must be ordered, disjoint and closed. No kernels are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/wnfild_c.html
   */
  wnfild(small: number, window: SpiceWindow): void;

  /**
   * Remove intervals whose length is at most small, in place. Zero removes
   * singletons. A negative threshold preserves intervals with nonnegative length.
   *
   * Use live windows from kit.newWindow in the owning backend. Stored
   * intervals must be ordered, disjoint and closed. No kernels are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/wnfltd_c.html
   */
  wnfltd(small: number, window: SpiceWindow): void;

  /**
   * Test whether left >= an interval's left endpoint and right <= its right
   * endpoint for the same interval. Both arguments are finite. CSPICE does
   * not reorder reversed query endpoints. An empty window returns false.
   *
   * Use live windows from kit.newWindow in the owning backend. Stored
   * intervals must be ordered, disjoint and closed. No kernels are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/wnincd_c.html
   */
  wnincd(left: number, right: number, window: SpiceWindow): boolean;

  /**
   * Write the intersection of a and b to result. Touching intervals intersect
   * at their shared endpoint. The two input handles may be identical.
   *
   * Supply a distinct result window with enough endpoint slots for the output.
   * An undersized result can signal a CSPICE error after partial writes.
   * On a failed result write, card(result) can retain the old C descriptor
   * cardinality while wncard/wnfetd expose the written Fortran window.
   * Clear with scard(0,result) before reusing it as an empty destination.
   * Result capacity must be even.
   *
   * Use live windows from kit.newWindow in the owning backend. Stored
   * intervals must be ordered, disjoint and closed. No kernels are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/wnintd_c.html
   */
  wnintd(a: SpiceWindow, b: SpiceWindow, result: SpiceWindow): void;

  /**
   * Compare a and b as sets of closed intervals. Operators = and <> test
   * equality and inequality. The operators <, <=, >, >= test proper or
   * inclusive subset and superset. Empty sets participate in these relations.
   * The two input handles may be identical. Supply a well-formed, NUL-free
   * string. Trailing ASCII spaces are accepted by the pinned comparison.
   * An empty operator signals SPICE(EMPTYSTRING) and unknown operators
   * signal SPICE(INVALIDOPERATION).
   *
   * Use live windows from kit.newWindow in the owning backend. Stored
   * intervals must be ordered, disjoint and closed. No kernels are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/wnreld_c.html
   */
  wnreld(a: SpiceWindow, op: string, b: SpiceWindow): boolean;

  /**
   * Return interval-length statistics in an owned object. meas is total
   * measure, avg is mean length, and stddev is population standard deviation.
   * shortest and longest are zero-based left-endpoint indices in flattened
   * endpoint storage (twice the interval ordinal). The first interval wins
   * ties. An empty window yields zero measures and both indices are -1.
   * Odd cardinality signals SPICE(INVALIDCARDINALITY). Floating-point
   * overflow and cancellation can yield infinities or NaN in the measures.
   *
   * Use live windows from kit.newWindow in the owning backend. Stored
   * intervals must be ordered, disjoint and closed. No kernels are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/wnsumd_c.html
   */
  wnsumd(window: SpiceWindow): {
    meas: number;
    avg: number;
    stddev: number;
    shortest: number;
    longest: number;
  };

  /**
   * Write the union of a and b to result. The two input handles may be
   * identical. Pinned N0067 can return success after its output reaches
   * capacity while later overlapping intervals extend only an internal
   * endpoint. For example, the union of [0,4] and [2,8] gives [0,4] with
   * one available interval, [0,8] with two, and an empty result with zero
   * capacity. All three calls succeed. Allocating room for the sum
   * of the two input interval counts accommodates all disjoint intervals.
   *
   * Supply a distinct result window with enough endpoint slots for the output.
   * An undersized result can signal a CSPICE error after partial writes.
   * On a failed result write, card(result) can retain the old C descriptor
   * cardinality while wncard/wnfetd expose the written Fortran window.
   * Clear with scard(0,result) before reusing it as an empty destination.
   * Result capacity must be even.
   *
   * Use live windows from kit.newWindow in the owning backend. Stored
   * intervals must be ordered, disjoint and closed. No kernels are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/wnunid_c.html
   */
  wnunid(a: SpiceWindow, b: SpiceWindow, result: SpiceWindow): void;

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
