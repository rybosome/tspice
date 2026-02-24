import type { CellsWindowsKitApi } from "@rybosome/tspice-backend-contract";

import { wrapSpiceError } from "../../errors.js";

/** Create cell/window helpers for a given backend. */
export function createCellsWindowsKit(
  cspice: CellsWindowsKitApi,
): CellsWindowsKitApi {
  return {
    newIntCell: (size) => {
      try {
        return cspice.newIntCell(size);
      } catch (error) {
        throw wrapSpiceError("newIntCell", error);
      }
    },

    newDoubleCell: (size) => {
      try {
        return cspice.newDoubleCell(size);
      } catch (error) {
        throw wrapSpiceError("newDoubleCell", error);
      }
    },

    newCharCell: (size, length) => {
      try {
        return cspice.newCharCell(size, length);
      } catch (error) {
        throw wrapSpiceError("newCharCell", error);
      }
    },

    newWindow: (maxIntervals) => {
      try {
        return cspice.newWindow(maxIntervals);
      } catch (error) {
        throw wrapSpiceError("newWindow", error);
      }
    },

    freeCell: (cell) => {
      try {
        cspice.freeCell(cell);
      } catch (error) {
        throw wrapSpiceError("freeCell", error);
      }
    },

    freeWindow: (window) => {
      try {
        cspice.freeWindow(window);
      } catch (error) {
        throw wrapSpiceError("freeWindow", error);
      }
    },

    cellGeti: (cell, index) => {
      try {
        return cspice.cellGeti(cell, index);
      } catch (error) {
        throw wrapSpiceError("cellGeti", error);
      }
    },

    cellGetd: (cell, index) => {
      try {
        return cspice.cellGetd(cell, index);
      } catch (error) {
        throw wrapSpiceError("cellGetd", error);
      }
    },

    cellGetc: (cell, index) => {
      try {
        return cspice.cellGetc(cell, index);
      } catch (error) {
        throw wrapSpiceError("cellGetc", error);
      }
    },
  };
}
