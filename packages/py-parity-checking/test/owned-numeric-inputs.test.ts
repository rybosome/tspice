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
        expect(
          raw.ducrss(
            readOnce(1, 2, -3, 4, 5, -6),
            readOnce(-2, 4, 7, -3, 2, 1),
          ),
        ).toEqual(raw.ducrss([1, 2, -3, 4, 5, -6], [-2, 4, 7, -3, 2, 1]));
        expect(
          raw.dvcrss(
            readOnce(1, 2, -3, 4, 5, -6),
            readOnce(-2, 4, 7, -3, 2, 1),
          ),
        ).toEqual(raw.dvcrss([1, 2, -3, 4, 5, -6], [-2, 4, 7, -3, 2, 1]));
        expect(
          raw.dvdot(readOnce(1, 2, -3, 4, 5, -6), readOnce(-2, 4, 7, -3, 2, 1)),
        ).toEqual(raw.dvdot([1, 2, -3, 4, 5, -6], [-2, 4, 7, -3, 2, 1]));
        expect(raw.dvhat(readOnce(1, 2, -3, 4, 5, -6))).toEqual(
          raw.dvhat([1, 2, -3, 4, 5, -6]),
        );
        expect(raw.dvnorm(readOnce(1, 2, -3, 4, 5, -6))).toEqual(
          raw.dvnorm([1, 2, -3, 4, 5, -6]),
        );
        expect(
          raw.dvsep(readOnce(1, 2, -3, 4, 5, -6), readOnce(-2, 4, 7, -3, 2, 1)),
        ).toEqual(raw.dvsep([1, 2, -3, 4, 5, -6], [-2, 4, 7, -3, 2, 1]));
        expect(raw.failed()).toBe(false);
      } finally {
        await dispose();
      }
    },
  );
}
