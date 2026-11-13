import { describe, expect, it } from "vitest";
import { createWasmBackend } from "@rybosome/tspice-backend-wasm";

describe("cell backing allocation arithmetic", () => {
  it("rejects unrepresentable wasm32 storage before allocating payloads", async () => {
    const b = await createWasmBackend();
    const max = 0x7fff_ffff;
    expect(() => b.kit.newIntCell(max)).toThrow(
      /allocation exceeds addressable memory/,
    );
    expect(() => b.kit.newDoubleCell(max)).toThrow(
      /allocation exceeds addressable memory/,
    );
    expect(() => b.kit.newCharCell(max, max)).toThrow(
      /allocation exceeds addressable memory/,
    );
    expect(() => b.kit.newWindow(Math.floor(max / 2))).toThrow(
      /allocation exceeds addressable memory/,
    );
    const cell = b.kit.newIntCell(2);
    try {
      b.raw.insrti(3, cell);
      expect(b.raw.card(cell)).toBe(1);
    } finally {
      b.kit.freeCell(cell);
    }
  });
});
