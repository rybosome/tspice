import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

// Every index has a fixed, safe numeric value. A repeated read fails before
// scientific execution; this regression does not resize buffers or arrays.
function readOnce<T extends number[]>(...values: T): T {
  const observed = new Set<number>();
  for (let index = 0; index < values.length; index++) {
    const value = values[index];
    Object.defineProperty(values, index, {
      get() {
        if (observed.has(index))
          throw new Error(`Input index ${index} was read again`);
        observed.add(index);
        return value;
      },
    });
  }
  return values;
}

for (const backend of ["node", "wasm"] as const) {
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    `${backend}: uses each validated numeric input once`,
    async () => {
      const { spice, dispose } = await spiceClients.toSync({ backend });
      const raw = spice.raw;
      try {
        expect(raw.sumad(readOnce(2, -3, 5, 4))).toEqual(
          raw.sumad([2, -3, 5, 4]),
        );
        expect(raw.sumai(readOnce(2, -3, 5, 4))).toEqual(
          raw.sumai([2, -3, 5, 4]),
        );
        expect(raw.maxd(readOnce(2, -3, 5, 4))).toEqual(
          raw.maxd([2, -3, 5, 4]),
        );
        expect(raw.maxi(readOnce(2, -3, 5, 4))).toEqual(
          raw.maxi([2, -3, 5, 4]),
        );
        expect(raw.mind(readOnce(2, -3, 5, 4))).toEqual(
          raw.mind([2, -3, 5, 4]),
        );
        expect(raw.mini(readOnce(2, -3, 5, 4))).toEqual(
          raw.mini([2, -3, 5, 4]),
        );
        expect(raw.failed()).toBe(false);
      } finally {
        await dispose();
      }
    },
  );
}
