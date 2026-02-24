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

/** Create a {@link CellsWindowsApi} implementation backed by the native Node addon. */
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
