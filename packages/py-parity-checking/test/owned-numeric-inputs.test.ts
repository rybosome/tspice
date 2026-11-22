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
        expect(raw.reccyl(readOnce(3, 4, 5))).toEqual(raw.reccyl([3, 4, 5]));
        expect(raw.recazl(readOnce(3, 4, 5), true, false)).toEqual(
          raw.recazl([3, 4, 5], true, false),
        );
        expect(raw.recpgr("EARTH", readOnce(3, 4, 5), 1, 0)).toEqual(
          raw.recpgr("EARTH", [3, 4, 5], 1, 0),
        );
        expect(raw.recrad(readOnce(3, 4, 5))).toEqual(raw.recrad([3, 4, 5]));
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
