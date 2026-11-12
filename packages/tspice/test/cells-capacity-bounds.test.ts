import { describe, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

describe("cell backing capacity bounds", () => {
  for (const backend of ["wasm", "node"] as const) {
    const testBackend =
      backend === "node" ? it.runIf(nodeBackendAvailable) : it;
    for (const kind of ["int", "double", "char"] as const) {
      for (const operation of ["ssize", "valid"] as const) {
        testBackend(
          `${backend}: ${operation} cannot grow ${kind} storage`,
          async () => {
            const { spice, dispose } = await spiceClients.toSync({ backend });
            const cell =
              kind === "int"
                ? spice.kit.newIntCell(2)
                : kind === "double"
                  ? spice.kit.newDoubleCell(2)
                  : spice.kit.newCharCell(2, 8);
            try {
              // n=0 avoids out-of-bounds reads in the failing old implementation.
              expect(() =>
                operation === "ssize"
                  ? spice.raw.ssize(6, cell)
                  : spice.raw.valid(6, 0, cell),
              ).toThrow(/allocated.*capacity/);
              expect(spice.raw.size(cell)).toBe(2);
              expect(spice.raw.card(cell)).toBe(0);
              expect(spice.raw.failed()).toBe(false);
              spice.raw.ssize(0, cell);
              expect(spice.raw.size(cell)).toBe(0);
              spice.raw.ssize(2, cell);
              expect(spice.raw.size(cell)).toBe(2);
            } finally {
              spice.kit.freeCell(cell);
              await dispose();
            }
          },
        );
      }
    }
    testBackend(`${backend}: wnvald cannot grow endpoint storage`, async () => {
      const { spice, dispose } = await spiceClients.toSync({ backend });
      const window = spice.kit.newWindow(1);
      try {
        expect(() => spice.raw.wnvald(6, 0, window)).toThrow(
          /allocated.*capacity/,
        );
        expect(spice.raw.size(window)).toBe(2);
        expect(spice.raw.wncard(window)).toBe(0);
        expect(spice.raw.failed()).toBe(false);
        spice.raw.wnvald(0, 0, window);
        spice.raw.wnvald(2, 0, window);
        spice.raw.wninsd(1, 2, window);
        expect(spice.raw.wnfetd(window, 0)).toEqual([1, 2]);
      } finally {
        spice.kit.freeWindow(window);
        await dispose();
      }
    });
    testBackend(
      `${backend}: registry growth/removal preserves original capacities`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        const cells = Array.from({ length: 80 }, (_, i) => ({
          cell: spice.kit.newIntCell(3 + (i % 7)),
          capacity: 3 + (i % 7),
          freed: false,
        }));
        try {
          for (const entry of cells.slice(0, 60)) {
            spice.kit.freeCell(entry.cell);
            entry.freed = true;
          }
          // This exercises entry memmoves and registry shrink while handles remain.
          for (const { cell, capacity } of cells.slice(60)) {
            spice.raw.ssize(1, cell);
            spice.raw.valid(capacity, 0, cell);
            expect(spice.raw.size(cell)).toBe(capacity);
            expect(() => spice.raw.ssize(capacity + 1, cell)).toThrow(
              /allocated.*capacity/,
            );
            expect(spice.raw.size(cell)).toBe(capacity);
          }
        } finally {
          for (const entry of cells)
            if (!entry.freed) spice.kit.freeCell(entry.cell);
          await dispose();
        }
      },
    );
  }
});
