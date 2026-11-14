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
        expect(raw.recazl(readOnce(3, 4, 5), true, false)).toEqual(
          raw.recazl([3, 4, 5], true, false),
        );
        expect(raw.recpgr("EARTH", readOnce(3, 4, 5), 1, 0)).toEqual(
          raw.recpgr("EARTH", [3, 4, 5], 1, 0),
        );
        expect(raw.recrad(readOnce(3, 4, 5))).toEqual(raw.recrad([3, 4, 5]));
        expect(raw.failed()).toBe(false);
      } finally {
        await dispose();
      }
    },
  );
}
