import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
for (const backend of ["node", "wasm"] as const)
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    `${backend}: valid descriptor NaN payload survives public pack/unpack`,
    async () => {
      const setup = await spiceClients.toSync({ backend });
      try {
        const descriptor = setup.spice.raw.spkpds(
          -123456,
          -42,
          "J2000",
          8,
          -123.5,
          456.75,
        );
        expect(descriptor).toHaveLength(5);
        expect(Number.isNaN(descriptor[2])).toBe(true);
        expect(setup.spice.raw.spkuds(descriptor)).toEqual({
          body: -123456,
          center: -42,
          frame: 1,
          type: 8,
          first: -123.5,
          last: 456.75,
          baddr: 0,
          eaddr: 0,
        });
      } finally {
        await setup.dispose();
      }
    },
  );
for (const backend of ["node", "wasm"] as const)
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    `${backend}: SPK descriptor boundaries and recovery`,
    async () => {
      const setup = await spiceClients.toSync({ backend }),
        raw = setup.spice.raw;
      try {
        for (const bad of [NaN, Infinity, -Infinity]) {
          expect(() => raw.spkpds(1000, 0, "J2000", 8, bad, 1)).toThrow();
          expect(() => raw.spkpds(1000, 0, "J2000", 8, 0, bad)).toThrow();
        }
        for (const bad of [1.25, 4294967297, NaN, Infinity]) {
          expect(() => raw.spkpds(bad, 0, "J2000", 8, 0, 1)).toThrow();
          expect(() => raw.spkpds(1000, bad, "J2000", 8, 0, 1)).toThrow();
          expect(() => raw.spkpds(1000, 0, "J2000", bad, 0, 1)).toThrow();
        }
        for (const bad of [
          [],
          [1, 2, 3, 4],
          [1, 2, 3, 4, 5, 6],
          [1, 2, 3, 4, "5"],
        ])
          expect(() => Reflect.apply(raw.spkuds, raw, [bad])).toThrow();
        expect(raw.spkuds(raw.spkpds(1000, 0, "J2000", 8, 0, 1)).body).toBe(
          1000,
        );
      } finally {
        await setup.dispose();
      }
    },
  );
