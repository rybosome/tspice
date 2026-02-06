import type {
  CellsWindowsApi,
  SpiceCharCell,
  SpiceDoubleCell,
  SpiceIntCell,
  SpiceWindow,
} from "@rybosome/tspice-backend-contract";
import {
  assertSpiceInt32,
  assertSpiceInt32NonNegative,
} from "@rybosome/tspice-backend-contract";
import { invariant } from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";

export function createCellsWindowsApi(native: NativeAddon): CellsWindowsApi {
  return {
    newIntCell: (size) => {
      assertSpiceInt32NonNegative(size, "newIntCell(size)");
      const handle = native.newIntCell(size);
      invariant(typeof handle === "number", "Expected newIntCell() to return a number handle");
      return handle as SpiceIntCell;
    },
    newDoubleCell: (size) => {
      assertSpiceInt32NonNegative(size, "newDoubleCell(size)");
      const handle = native.newDoubleCell(size);
      invariant(typeof handle === "number", "Expected newDoubleCell() to return a number handle");
      return handle as SpiceDoubleCell;
    },
    newCharCell: (size, length) => {
      assertSpiceInt32NonNegative(size, "newCharCell(size)");
      assertSpiceInt32(length, "newCharCell(length)", { min: 1 });
      const handle = native.newCharCell(size, length);
      invariant(typeof handle === "number", "Expected newCharCell() to return a number handle");
      return handle as SpiceCharCell;
    },
    newWindow: (maxIntervals) => {
      assertSpiceInt32NonNegative(maxIntervals, "newWindow(maxIntervals)");
      const handle = native.newWindow(maxIntervals);
      invariant(typeof handle === "number", "Expected newWindow() to return a number handle");
      return handle as SpiceWindow;
    },

    freeCell: (cell) => {
      native.freeCell(cell);
    },
    freeWindow: (window) => {
      native.freeWindow(window);
    },

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

    cellGeti: (cell, index) => {
      assertSpiceInt32NonNegative(index, "cellGeti(index)");
      const out = native.cellGeti(cell, index);
      invariant(typeof out === "number", "Expected cellGeti() to return a number");
      return out;
    },
    cellGetd: (cell, index) => {
      assertSpiceInt32NonNegative(index, "cellGetd(index)");
      const out = native.cellGetd(cell, index);
      invariant(typeof out === "number", "Expected cellGetd() to return a number");
      return out;
    },
    cellGetc: (cell, index) => {
      assertSpiceInt32NonNegative(index, "cellGetc(index)");
      const out = native.cellGetc(cell, index);
      invariant(typeof out === "string", "Expected cellGetc() to return a string");
      return out.trimEnd();
    },

    wninsd: (left, right, window) => {
      native.wninsd(left, right, window);
    },
    wncard: (window) => {
      const out = native.wncard(window);
      invariant(typeof out === "number", "Expected wncard() to return a number");
      return out;
    },
    wnfetd: (window, index) => {
      assertSpiceInt32NonNegative(index, "wnfetd(index)");
      const out = native.wnfetd(window, index);
      invariant(Array.isArray(out) && out.length === 2, "Expected wnfetd() to return [left,right]");
      invariant(typeof out[0] === "number" && typeof out[1] === "number", "Expected wnfetd() to return numbers");
      return [out[0], out[1]] as const;
    },
    wnvald: (size, n, window) => {
      assertSpiceInt32NonNegative(size, "wnvald(size)");
      assertSpiceInt32NonNegative(n, "wnvald(n)");
      native.wnvald(size, n, window);
    },
  };
}
