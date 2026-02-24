import { describe, expect, it } from "vitest";

import { createWasmBackend } from "@rybosome/tspice-backend-wasm";

describe("@rybosome/tspice-backend-wasm cells/windows", () => {
  it("supports basic set cells (ordering + de-dupe + getters)", async () => {
    const b = await createWasmBackend();

    const icell = b.kit.newIntCell(10);
    const dcell = b.kit.newDoubleCell(10);
    const ccell = b.kit.newCharCell(10, 16);

    try {
      b.raw.insrti(3, icell);
      b.raw.insrti(1, icell);
      b.raw.insrti(2, icell);
      b.raw.insrti(2, icell);
      expect(b.raw.card(icell)).toBe(3);
      expect(b.raw.size(icell)).toBe(10);
      expect(b.kit.cellGeti(icell, 0)).toBe(1);
      expect(b.kit.cellGeti(icell, 1)).toBe(2);
      expect(b.kit.cellGeti(icell, 2)).toBe(3);

      b.raw.insrtd(3.25, dcell);
      b.raw.insrtd(-1.0, dcell);
      b.raw.insrtd(3.25, dcell);
      expect(b.raw.card(dcell)).toBe(2);
      expect(b.kit.cellGetd(dcell, 0)).toBe(-1.0);
      expect(b.kit.cellGetd(dcell, 1)).toBe(3.25);

      b.raw.insrtc("b", ccell);
      b.raw.insrtc("a", ccell);
      b.raw.insrtc("b", ccell);
      b.raw.insrtc("c", ccell);
      expect(b.raw.card(ccell)).toBe(3);
      expect(b.kit.cellGetc(ccell, 0)).toBe("a");
      expect(b.kit.cellGetc(ccell, 1)).toBe("b");
      expect(b.kit.cellGetc(ccell, 2)).toBe("c");
    } finally {
      b.kit.freeCell(icell);
      b.kit.freeCell(dcell);
      b.kit.freeCell(ccell);
    }
  });

  it("supports basic windows (insert + merge + fetch)", async () => {
    const b = await createWasmBackend();
    const win = b.kit.newWindow(4);

    try {
      b.raw.wninsd(0, 1, win);
      b.raw.wninsd(2, 3, win);
      b.raw.wninsd(0.5, 2.5, win);

      expect(b.raw.wncard(win)).toBe(1);
      expect(b.raw.wnfetd(win, 0)).toEqual([0, 3]);
    } finally {
      b.kit.freeWindow(win);
    }
  });

  it("throws on capacity overflow (CSPICE-like)", async () => {
    const b = await createWasmBackend();

    const icell = b.kit.newIntCell(2);
    try {
      b.raw.insrti(1, icell);
      b.raw.insrti(2, icell);
      expect(() => b.raw.insrti(3, icell)).toThrow();
    } finally {
      b.kit.freeCell(icell);
    }
  });
});
