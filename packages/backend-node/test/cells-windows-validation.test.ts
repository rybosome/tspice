import { describe, expect, it, vi } from "vitest";

import { createCellsWindowsApi } from "../src/domains/cells-windows.js";

// These tests intentionally do not require the native addon to be available.
// We validate that the JS wrapper performs early argument checking before
// crossing the JS -> native boundary.

describe("@rybosome/tspice-backend-node cells/windows validation", () => {
  it("validates handles for freeCell/freeWindow", () => {
    const freeCell = vi.fn();
    const freeWindow = vi.fn();

    const api = createCellsWindowsApi({ freeCell, freeWindow } as never);

    expect(() => api.freeCell(-1 as never)).toThrow(/freeCell\(cell\)/);
    expect(() => api.freeCell(1.25 as never)).toThrow(/freeCell\(cell\)/);
    expect(() => api.freeWindow(-1 as never)).toThrow(/freeWindow\(window\)/);

    api.freeCell(0 as never);
    api.freeWindow(0 as never);

    expect(freeCell).toHaveBeenCalledTimes(1);
    expect(freeWindow).toHaveBeenCalledTimes(1);
  });
});
