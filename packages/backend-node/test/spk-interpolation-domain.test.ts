import { expect, it } from "vitest";
import { createSpiceHandleRegistry } from "@rybosome/tspice-core";
import { getNativeAddon } from "../src/native.js";
import { createEphemerisApi } from "../src/domains/ephemeris.js";
import { createKernelStager } from "../src/runtime/kernel-staging.js";
import { createVirtualOutputStager } from "../src/runtime/virtual-output-staging.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";
for (const kind of [9, 12, 13, 18] as const) {
  it.runIf(nodeAddonAvailable())(
    "type " +
      kind +
      " validates physical addon buffers before passing rows to the real writer and recovers",
    () => {
      const native = getNativeAddon(),
        handles = createSpiceHandleRegistry(),
        outputs = createVirtualOutputStager(),
        api = createEphemerisApi(
          native,
          handles,
          createKernelStager(),
          outputs,
        );
      const out = { kind: "virtual-output", path: "e05addon.bsp" } as const,
        h = api.spkopn(out, "REAL", 0),
        nh = handles.lookup(h, ["SPK"], "reference").nativeHandle;
      const data = new Float64Array([1, 2, 3, 4, 5, 6, 2, 4, 8, 3, 7, 9]),
        epochs = new Float64Array([0, 1]);
      const write = (
        n: number,
        buf: Float64Array,
        ep: Float64Array = epochs,
        degree = 1,
      ) => {
        const pre = [199100, 0, "J2000", 0, 1, "A", degree, n, buf] as const;
        if (kind === 12) native.spkw12(nh, ...pre, 0, 1);
        else if (kind === 18) native.spkw18(nh, 1, ...pre, ep);
        else native[kind === 9 ? "spkw09" : "spkw13"](nh, ...pre, ep);
      };
      try {
        expect(() => write(2147483647, data)).toThrow(/Incomplete/);
        expect(() => write(2, data.subarray(0, -1))).toThrow(/Incomplete/);
        if (kind !== 12)
          expect(() => write(2, data, epochs.subarray(0, 1))).toThrow(
            /Incomplete/,
          );
        expect(() => write(2, new Float64Array(12).fill(Infinity))).toThrow(
          /Nonfinite/,
        );
        expect(() => write(2, data, epochs, 2147483647)).toThrow(
          kind === 9 ? /INVALIDDEGREE/ : /window arithmetic/,
        );
        write(2, data);
        api.spkcls(h);
        expect(outputs.readVirtualOutput(out).length).toBeGreaterThan(1024);
      } finally {
        outputs.dispose();
      }
    },
  );
  it.runIf(nodeAddonAvailable())(
    "type " + kind + " refuses foreign handles before packet observation",
    () => {
      const native = getNativeAddon(),
        h = createSpiceHandleRegistry().register("SPK", 9),
        outputs = createVirtualOutputStager(),
        api = createEphemerisApi(
          native,
          createSpiceHandleRegistry(),
          createKernelStager(),
          outputs,
        );
      const pre = [199100, 0, "J2000", 0, 1, "A", 1] as const,
        unread = new Proxy([0], {
          get() {
            throw Error("unexpected caller read");
          },
        });
      try {
        expect(() =>
          kind === 12
            ? api.spkw12(h, ...pre, unread, 0, 1)
            : kind === 18
              ? api.spkw18(h, 1, ...pre, unread, [])
              : api[kind === 9 ? "spkw09" : "spkw13"](h, ...pre, unread, []),
        ).toThrow(/handle/i);
      } finally {
        outputs.dispose();
      }
    },
  );
}
