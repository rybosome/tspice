import { expect, it } from "vitest";
import { createSpiceHandleRegistry } from "@rybosome/tspice-core";
import { getNativeAddon } from "../src/native.js";
import { createEphemerisApi } from "../src/domains/ephemeris.js";
import { createKernelStager } from "../src/runtime/kernel-staging.js";
import { createVirtualOutputStager } from "../src/runtime/virtual-output-staging.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";
for (const kind of [5, 10, 15, 17] as const) {
  it.runIf(nodeAddonAvailable())(
    "validates complete type " +
      kind +
      " physical addon buffers before indexing and can append after an error",
    () => {
      const native = getNativeAddon(),
        handles = createSpiceHandleRegistry(),
        outputs = createVirtualOutputStager(),
        api = createEphemerisApi(
          native,
          handles,
          createKernelStager(),
          outputs,
        ),
        file = { kind: "virtual-output", path: "a.bsp" } as const;
      const h = api.spkopn(file, "ADDON", 0),
        actual = handles.lookup(h, ["SPK"], "test").nativeHandle;
      const symbol =
        kind === 5
          ? "spkw05"
          : kind === 10
            ? "spkw10"
            : kind === 15
              ? "spkw15"
              : "spkw17";
      const pack = new Float64Array(
        kind === 5
          ? [1, 1, 0, 0, 0, 1, 0, 0]
          : kind === 10
            ? [
                0.001, 0, 0, 0.074, 120, 78, 6378, 1, 0, 0, 0, 0.5, 0.2, 0.03,
                0.4, 0.7, 0.06, 0, 0,
              ]
            : kind === 15
              ? [
                  0, 0, 0, 3, 2, 0, 0, 7000, 0.1, 3, 0, 0, 2, 398600, 0.001,
                  6378,
                ]
              : [0, 7000, 0, 0, 0, 0, 0, 0, 0.001, 0, 0, 1],
      );
      const write = (n: number, data: Float64Array) =>
        native[symbol](actual, 1001, 0, "J2000", -2, 2, "TEST", n, data);
      try {
        expect(() => write(2147483647, pack)).toThrow(/Incomplete/);
        expect(() => write(1, pack.subarray(0, -1))).toThrow(/Incomplete/);
        const bad = pack.slice();
        bad[bad.length - 1] = NaN;
        expect(() => write(1, bad)).toThrow(/Nonfinite/);
        if (kind === 15) {
          bad.set(pack);
          bad[9] = 2 ** 31;
          expect(() => write(1, bad)).toThrow(/signed/);
        }
        if (kind === 10) {
          const two = new Float64Array(30);
          two.set(pack.subarray(0, 18));
          two.set(pack.subarray(8, 18), 18);
          two.set([3, 1], 28);
          expect(() => write(2, two)).toThrow(/increase/);
        }
        write(1, pack);
        api.spkcls(h);
        expect(outputs.readVirtualOutput(file).length).toBeGreaterThan(1024);
      } finally {
        outputs.dispose();
      }
    },
  );
  it.runIf(nodeAddonAvailable())(
    "rejects an unowned type " +
      kind +
      " handle before inspecting caller storage",
    () => {
      const outputs = createVirtualOutputStager(),
        api = createEphemerisApi(
          getNativeAddon(),
          createSpiceHandleRegistry(),
          createKernelStager(),
          outputs,
        );
      const handle = createSpiceHandleRegistry().register("SPK", 1),
        common = [handle, 100, 0, "J2000", 0, 1, "TEST"] as const;
      const unread = new Proxy([0, 0, 1] as const, {
        get() {
          throw Error("unexpected caller read");
        },
      });
      try {
        expect(() =>
          kind === 5
            ? api.spkw05(...common, 1, unread, [])
            : kind === 10
              ? api.spkw10(...common, unread, [], [])
              : kind === 15
                ? api.spkw15(
                    ...common,
                    0,
                    unread,
                    unread,
                    1,
                    0,
                    0,
                    unread,
                    1,
                    0,
                    1,
                  )
                : api.spkw17(...common, 0, unread, 0, 1),
        ).toThrow(/handle/i);
      } finally {
        outputs.dispose();
      }
    },
  );
}
