import type { CellsWindowsKitApi, SpiceBackend } from "@rybosome/tspice-backend-contract";

import { wrapSpiceError } from "../../errors.js";

/** Create cell/window helpers for a given backend. */
export function createCellsWindowsKit(
  cspice: SpiceBackend,
): CellsWindowsKitApi {
  return {
    newIntCell: (size) => {
      try {
        return cspice.kit.newIntCell(size);
      } catch (error) {
        throw wrapSpiceError("newIntCell", error);
      }
    },

    newDoubleCell: (size) => {
      try {
        return cspice.kit.newDoubleCell(size);
      } catch (error) {
        throw wrapSpiceError("newDoubleCell", error);
      }
    },

    newCharCell: (size, length) => {
      try {
        return cspice.kit.newCharCell(size, length);
      } catch (error) {
        throw wrapSpiceError("newCharCell", error);
      }
    },

    newWindow: (maxIntervals) => {
      try {
        return cspice.kit.newWindow(maxIntervals);
      } catch (error) {
        throw wrapSpiceError("newWindow", error);
      }
    },

    freeCell: (cell) => {
      try {
        cspice.kit.freeCell(cell);
      } catch (error) {
        throw wrapSpiceError("freeCell", error);
      }
    },

    freeWindow: (window) => {
      try {
        cspice.kit.freeWindow(window);
      } catch (error) {
        throw wrapSpiceError("freeWindow", error);
      }
    },

    cellGeti: (cell, index) => {
      try {
        return cspice.kit.cellGeti(cell, index);
      } catch (error) {
        throw wrapSpiceError("cellGeti", error);
      }
    },

    cellGetd: (cell, index) => {
      try {
        return cspice.kit.cellGetd(cell, index);
      } catch (error) {
        throw wrapSpiceError("cellGetd", error);
      }
    },

    cellGetc: (cell, index) => {
      try {
        return cspice.kit.cellGetc(cell, index);
      } catch (error) {
        throw wrapSpiceError("cellGetc", error);
      }
    },
  };
}
