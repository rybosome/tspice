import { describe, expect, it } from "vitest";
import { createWasmBackend } from "@rybosome/tspice-backend-wasm";

describe("cell handle ownership", () => {
  it("rejects a foreign handle even when two module heaps allocate the same address", async () => {
    const a = await createWasmBackend();
    const b = await createWasmBackend();
    const local = a.kit.newIntCell(4);
    const foreign = b.kit.newIntCell(4);
    try {
      expect(() => a.raw.insrti(12, foreign)).toThrow(
        /unknown|expired|foreign|per-module/i,
      );
      expect(a.raw.card(local)).toBe(0);
      expect(b.raw.card(foreign)).toBe(0);
    } finally {
      a.kit.freeCell(local);
      b.kit.freeCell(foreign);
    }
  });

  it("does not revive an expired handle when the allocator reuses its address", async () => {
    const a = await createWasmBackend();
    const expired = a.kit.newIntCell(4);
    a.kit.freeCell(expired);
    const replacement = a.kit.newIntCell(4);
    try {
      expect(() => a.raw.insrti(12, expired)).toThrow(/unknown|expired/i);
      expect(() => a.kit.freeCell(expired)).toThrow(/unknown|expired/i);
      expect(a.raw.card(replacement)).toBe(0);
    } finally {
      a.kit.freeCell(replacement);
    }
  });
});

describe("window identities and cell-consuming domains", () => {
  it("rejects foreign and expired window identities", async () => {
    const a = await createWasmBackend();
    const b = await createWasmBackend();
    const local = a.kit.newWindow(4);
    const foreign = b.kit.newWindow(4);
    const expired = a.kit.newWindow(4);
    a.kit.freeWindow(expired);
    const replacement = a.kit.newWindow(4);
    try {
      expect(() => a.raw.wninsd(1, 2, foreign)).toThrow(
        /unknown|expired|per-module/i,
      );
      expect(() => a.kit.freeWindow(foreign)).toThrow(
        /unknown|expired|per-module/i,
      );
      expect(() => a.raw.wninsd(1, 2, expired)).toThrow(/unknown|expired/i);
      expect(() => a.kit.freeWindow(expired)).toThrow(/unknown|expired/i);
      for (const window of [local, replacement])
        expect(a.raw.wncard(window)).toBe(0);
      expect(b.raw.wncard(foreign)).toBe(0);
    } finally {
      a.kit.freeWindow(local);
      a.kit.freeWindow(replacement);
      b.kit.freeWindow(foreign);
    }
  });

  it("rejects foreign tokens before all other domains enter CSPICE", async () => {
    const a = await createWasmBackend();
    const b = await createWasmBackend();
    const local = a.kit.newIntCell(4);
    const foreign = b.kit.newIntCell(4);
    const localWindow = a.kit.newWindow(4);
    const foreignWindow = b.kit.newWindow(4);
    const attempts = [
      () => a.raw.kplfrm(-1, foreign),
      () => a.raw.spkobj("unused.bsp", foreign),
      () => a.raw.spkcov("unused.bsp", 0, foreignWindow),
      () => a.raw.ckobj("unused.bc", foreign),
      () =>
        a.raw.ckcov("unused.bc", 0, false, "SEGMENT", 0, "TDB", foreignWindow),
      () => a.raw.dskobj("unused.bds", foreign),
      () => a.raw.dsksrf("unused.bds", 0, foreign),
      () => a.raw.gfrepi(foreignWindow, "BEGIN", "END"),
      () =>
        a.raw.gfsep(
          "EARTH",
          "POINT",
          "J2000",
          "MOON",
          "POINT",
          "J2000",
          "NONE",
          "SUN",
          ">",
          1,
          0,
          1,
          10,
          foreignWindow,
          localWindow,
        ),
      () =>
        a.raw.gfdist(
          "EARTH",
          "NONE",
          "SUN",
          ">",
          1,
          0,
          1,
          10,
          foreignWindow,
          localWindow,
        ),
    ];
    try {
      // A missing file/kernel failure must not pass this ownership assertion.
      for (const attempt of attempts)
        expect(attempt).toThrow(/unknown|expired|per-module/i);
      expect(a.raw.card(local)).toBe(0);
      expect(b.raw.card(foreign)).toBe(0);
      expect(a.raw.wncard(localWindow)).toBe(0);
      expect(b.raw.wncard(foreignWindow)).toBe(0);
    } finally {
      a.kit.freeCell(local);
      b.kit.freeCell(foreign);
      a.kit.freeWindow(localWindow);
      b.kit.freeWindow(foreignWindow);
    }
  });
});
