import { describe, expect, it } from "vitest";

import { createWasmBackend } from "@rybosome/tspice-backend-wasm";


describe("@rybosome/tspice-backend-wasm cells/windows", () => {
  it("supports basic set cells (ordering + de-dupe + getters)", async () => {
    const b = await createWasmBackend();

    const icell = b.newIntCell(10);
    const dcell = b.newDoubleCell(10);
    const ccell = b.newCharCell(10, 16);

    try {
      b.insrti(3, icell);
      b.insrti(1, icell);
      b.insrti(2, icell);
      b.insrti(2, icell);
      expect(b.card(icell)).toBe(3);
      expect(b.size(icell)).toBe(10);
      expect(b.cellGeti(icell, 0)).toBe(1);
      expect(b.cellGeti(icell, 1)).toBe(2);
      expect(b.cellGeti(icell, 2)).toBe(3);

      b.insrtd(3.25, dcell);
      b.insrtd(-1.0, dcell);
      b.insrtd(3.25, dcell);
      expect(b.card(dcell)).toBe(2);
      expect(b.cellGetd(dcell, 0)).toBe(-1.0);
      expect(b.cellGetd(dcell, 1)).toBe(3.25);

      b.insrtc("b", ccell);
      b.insrtc("a", ccell);
      b.insrtc("b", ccell);
      b.insrtc("c", ccell);
      expect(b.card(ccell)).toBe(3);
      expect(b.cellGetc(ccell, 0)).toBe("a");
      expect(b.cellGetc(ccell, 1)).toBe("b");
      expect(b.cellGetc(ccell, 2)).toBe("c");
    } finally {
      b.freeCell(icell);
      b.freeCell(dcell);
      b.freeCell(ccell);
    }
  });

  it("supports basic windows (insert + merge + fetch)", async () => {
    const b = await createWasmBackend();

    const win = b.newWindow(4);

    try {
      b.wninsd(0, 1, win);
      b.wninsd(2, 3, win);
      b.wninsd(0.5, 2.5, win);

      expect(b.wncard(win)).toBe(1);
      expect(b.wnfetd(win, 0)).toEqual([0, 3]);
    } finally {
      b.freeWindow(win);
    }
  });

  it("throws on capacity overflow (CSPICE-like)", async () => {
    const b = await createWasmBackend();

    const icell = b.newIntCell(2);
    try {
      b.insrti(1, icell);
      b.insrti(2, icell);
      expect(() => b.insrti(3, icell)).toThrow();
    } finally {
      b.freeCell(icell);
    }
  });
});
