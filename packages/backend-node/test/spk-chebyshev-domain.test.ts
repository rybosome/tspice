import { expect, it } from "vitest";
import { createSpiceHandleRegistry } from "@rybosome/tspice-core";
import { createEphemerisApi } from "../src/domains/ephemeris.js";
import { createKernelStager } from "../src/runtime/kernel-staging.js";
import { createVirtualOutputStager } from "../src/runtime/virtual-output-staging.js";
import { getNativeAddon } from "../src/native.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";
for (const kind of [2, 3, 20] as const) {
  it.runIf(nodeAddonAvailable())(
    "type " +
      kind +
      " checks physical native buffer length and preserves a writer after real CSPICE errors",
    () => {
      const native = getNativeAddon(),
        outputs = createVirtualOutputStager(),
        stager = createKernelStager(),
        handles = createSpiceHandleRegistry(),
        raw = createEphemerisApi(native, handles, stager, outputs);
      const output = {
        kind: "virtual-output",
        path: "native-e04.bsp",
      } as const;
      const h = raw.spkopn(output, "NATIVE", 0),
        nh = handles.lookup(h, ["SPK"], "test").nativeHandle;
      const args = [nh, 195100, 0, "J2000", 0, 1, "NATIVE"] as const;
      const add = (data: Float64Array, n: number, degree: number) =>
        kind === 20
          ? native.spkw20(...args, 1, n, degree, data, 1, 1, 2451545, 0)
          : native[kind === 2 ? "spkw02" : "spkw03"](
              ...args,
              1,
              n,
              degree,
              data,
              0,
            );
      try {
        expect(() => add(new Float64Array([1]), 0x7fffffff, 0)).toThrow(
          /length/,
        );
        expect(() =>
          add(new Float64Array(kind === 2 ? 3 : 6).fill(Number.NaN), 1, 0),
        ).toThrow(/finite/);
        expect(() => add(new Float64Array(0), 1, 51)).toThrow(/INVALIDDEGREE/);
        expect(() => add(new Float64Array(0), -1, 0)).toThrow(
          kind === 20 ? /INVALIDCOUNT/ : /NUMCOEFFSNOTPOS/,
        );
        add(
          new Float64Array(kind === 2 ? [2, 3, 4] : [2, 3, 4, 5, 6, 7]),
          1,
          0,
        );
        raw.spkcls(h);
        expect(outputs.readVirtualOutput(output).length).toBeGreaterThan(1024);
      } finally {
        outputs.dispose();
      }
    },
  );
  it.runIf(nodeAddonAvailable())(
    "type " +
      kind +
      " rejects foreign and incompatible handles before copying coefficient entries",
    () => {
      const native = getNativeAddon(),
        outputs = createVirtualOutputStager(),
        stager = createKernelStager(),
        handles = createSpiceHandleRegistry(),
        raw = createEphemerisApi(native, handles, stager, outputs);
      const invalid = [
        handles.register("DAS", 12),
        createSpiceHandleRegistry().register("SPK", 12),
      ];
      const data = new Proxy([1, 2, 3], {
        get() {
          throw Error("unexpected coefficient access");
        },
      });
      try {
        for (const h of invalid) {
          const args = [h, 195100, 0, "J2000", 0, 1, "NATIVE"] as const;
          expect(() =>
            kind === 20
              ? raw.spkw20(...args, 1, 1, 0, data, 1, 1, 2451545, 0)
              : raw[kind === 2 ? "spkw02" : "spkw03"](
                  ...args,
                  1,
                  1,
                  0,
                  data,
                  0,
                ),
          ).toThrow(/handle/i);
        }
      } finally {
        outputs.dispose();
      }
    },
  );
}
