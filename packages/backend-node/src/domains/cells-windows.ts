import type {
  CellsWindowsApi,
  CellsWindowsKitApi,
  SpiceCharCell,
  SpiceDoubleCell,
  SpiceIntCell,
  SpiceWindow,
} from "@rybosome/tspice-backend-contract";
import {
  assertWindowScalar,
  windowSideByte,
  windowOperatorBytes,
  windowSummaryIndex,
  assertSpiceInt32,
  assertSpiceInt32NonNegative,
  invariant,
} from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";

/** Create the raw {@link CellsWindowsApi} implementation backed by the native Node addon. */
export function createCellsWindowsApi(native: NativeAddon): CellsWindowsApi {
  return {
    ssize: (size, cell) => {
      assertSpiceInt32NonNegative(size, "ssize(size)");
      native.ssize(size, cell);
    },
    scard: (card, cell) => {
      assertSpiceInt32NonNegative(card, "scard(card)");
      native.scard(card, cell);
    },
    card: (cell) => {
      const out = native.card(cell);
      invariant(typeof out === "number", "Expected card() to return a number");
      return out;
    },
    size: (cell) => {
      const out = native.size(cell);
      invariant(typeof out === "number", "Expected size() to return a number");
      return out;
    },
    valid: (size, n, cell) => {
      assertSpiceInt32NonNegative(size, "valid(size)");
      assertSpiceInt32NonNegative(n, "valid(n)");
      native.valid(size, n, cell);
    },
    insrti: (item, cell) => {
      assertSpiceInt32(item, "insrti(item)");
      native.insrti(item, cell);
    },
    insrtd: (item, cell) => {
      native.insrtd(item, cell);
    },
    insrtc: (item, cell) => {
      native.insrtc(item, cell);
    },
    wncomd: (left, right, window, result) => {
      assertWindowScalar(left, "wncomd(left)");
      assertWindowScalar(right, "wncomd(right)");
      if (result === window)
        throw new RangeError("Result window must be distinct from each input");
      native.wncomd(left, right, window, result);
    },
    wncond: (left, right, window) => {
      assertWindowScalar(left, "wncond(left)");
      assertWindowScalar(right, "wncond(right)");
      native.wncond(left, right, window);
    },
    wndifd: (a, b, result) => {
      if (result === a || result === b)
        throw new RangeError("Result window must be distinct from each input");
      native.wndifd(a, b, result);
    },
    wnelmd: (point, window) => {
      assertWindowScalar(point, "wnelmd(point)");
      const out = native.wnelmd(point, window);
      invariant(
        typeof out === "boolean",
        "Expected wnelmd() to return a boolean",
      );
      return out;
    },
    wnexpd: (left, right, window) => {
      assertWindowScalar(left, "wnexpd(left)");
      assertWindowScalar(right, "wnexpd(right)");
      native.wnexpd(left, right, window);
    },
    wnextd: (side, window) => {
      windowSideByte(side);
      native.wnextd(side, window);
    },
    wnfild: (small, window) => {
      assertWindowScalar(small, "wnfild(small)");
      native.wnfild(small, window);
    },
    wnfltd: (small, window) => {
      assertWindowScalar(small, "wnfltd(small)");
      native.wnfltd(small, window);
    },
    wnincd: (left, right, window) => {
      assertWindowScalar(left, "wnincd(left)");
      assertWindowScalar(right, "wnincd(right)");
      const out = native.wnincd(left, right, window);
      invariant(
        typeof out === "boolean",
        "Expected wnincd() to return a boolean",
      );
      return out;
    },
    wnintd: (a, b, result) => {
      if (result === a || result === b)
        throw new RangeError("Result window must be distinct from each input");
      native.wnintd(a, b, result);
    },
    wnreld: (a, op, b) => {
      windowOperatorBytes(op);
      const out = native.wnreld(a, op, b);
      invariant(
        typeof out === "boolean",
        "Expected wnreld() to return a boolean",
      );
      return out;
    },
    wnsumd: (window) => {
      const out = native.wnsumd(window);
      invariant(
        out !== null && typeof out === "object",
        "Expected wnsumd() to return a summary",
      );
      const { meas, avg, stddev, shortest, longest } = out;
      invariant(
        typeof meas === "number" &&
          typeof avg === "number" &&
          typeof stddev === "number",
        "Expected numeric window summary measures",
      );
      return {
        meas,
        avg,
        stddev,
        shortest: windowSummaryIndex(shortest),
        longest: windowSummaryIndex(longest),
      };
    },
    wnunid: (a, b, result) => {
      if (result === a || result === b)
        throw new RangeError("Result window must be distinct from each input");
      native.wnunid(a, b, result);
    },
    wninsd: (left, right, window) => {
      native.wninsd(left, right, window);
    },
    wncard: (window) => {
      const out = native.wncard(window);
      invariant(
        typeof out === "number",
        "Expected wncard() to return a number",
      );
      return out;
    },
    wnfetd: (window, index) => {
      assertSpiceInt32NonNegative(index, "wnfetd(index)");
      const out = native.wnfetd(window, index);
      invariant(
        Array.isArray(out) && out.length === 2,
        "Expected wnfetd() to return [left,right]",
      );
      invariant(
        typeof out[0] === "number" && typeof out[1] === "number",
        "Expected wnfetd() to return numbers",
      );
      return [out[0], out[1]] as const;
    },
    wnvald: (size, n, window) => {
      assertSpiceInt32NonNegative(size, "wnvald(size)");
      assertSpiceInt32NonNegative(n, "wnvald(n)");
      native.wnvald(size, n, window);
    },
  };
}

/** Create backend kit hooks for cells/windows backed by the native Node addon. */
export function createCellsWindowsKitApi(
  native: NativeAddon,
  pckDestinations?: { ids: Set<number>; windows: Set<number> },
): CellsWindowsKitApi {
  return {
    newIntCell: (size) => {
      assertSpiceInt32NonNegative(size, "newIntCell(size)");
      const handle = native.newIntCell(size);
      invariant(
        typeof handle === "number",
        "Expected newIntCell() to return a number handle",
      );
      pckDestinations?.ids.add(handle);
      return handle as SpiceIntCell;
    },
    newDoubleCell: (size) => {
      assertSpiceInt32NonNegative(size, "newDoubleCell(size)");
      const handle = native.newDoubleCell(size);
      invariant(
        typeof handle === "number",
        "Expected newDoubleCell() to return a number handle",
      );
      return handle as SpiceDoubleCell;
    },
    newCharCell: (size, length) => {
      assertSpiceInt32NonNegative(size, "newCharCell(size)");
      assertSpiceInt32(length, "newCharCell(length)", { min: 1 });
      const handle = native.newCharCell(size, length);
      invariant(
        typeof handle === "number",
        "Expected newCharCell() to return a number handle",
      );
      return handle as SpiceCharCell;
    },
    newWindow: (maxIntervals) => {
      assertSpiceInt32NonNegative(maxIntervals, "newWindow(maxIntervals)");
      const handle = native.newWindow(maxIntervals);
      invariant(
        typeof handle === "number",
        "Expected newWindow() to return a number handle",
      );
      pckDestinations?.windows.add(handle);
      return handle as SpiceWindow;
    },

    freeCell: (cell) => {
      assertSpiceInt32NonNegative(cell as unknown as number, "freeCell(cell)");
      native.freeCell(cell);
      pckDestinations?.ids.delete(cell);
      pckDestinations?.windows.delete(cell);
    },
    freeWindow: (window) => {
      assertSpiceInt32NonNegative(
        window as unknown as number,
        "freeWindow(window)",
      );
      native.freeWindow(window);
      pckDestinations?.windows.delete(window);
      pckDestinations?.ids.delete(window);
    },

    cellGeti: (cell, index) => {
      assertSpiceInt32NonNegative(index, "cellGeti(index)");
      const out = native.cellGeti(cell, index);
      invariant(
        typeof out === "number",
        "Expected cellGeti() to return a number",
      );
      return out;
    },
    cellGetd: (cell, index) => {
      assertSpiceInt32NonNegative(index, "cellGetd(index)");
      const out = native.cellGetd(cell, index);
      invariant(
        typeof out === "number",
        "Expected cellGetd() to return a number",
      );
      return out;
    },
    cellGetc: (cell, index) => {
      assertSpiceInt32NonNegative(index, "cellGetc(index)");
      const out = native.cellGetc(cell, index);
      invariant(
        typeof out === "string",
        "Expected cellGetc() to return a string",
      );
      return out.trimEnd();
    },
  };
}
