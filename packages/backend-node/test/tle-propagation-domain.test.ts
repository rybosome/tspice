import { fileURLToPath } from "node:url";
import { expect, it, vi } from "vitest";
import { createSpiceHandleRegistry } from "@rybosome/tspice-core";
import { createEphemerisApi } from "../src/domains/ephemeris.js";
import { getNativeAddon, type NativeAddon } from "../src/runtime/addon.js";
import { createKernelStager } from "../src/runtime/kernel-staging.js";
import { createVirtualOutputStager } from "../src/runtime/virtual-output-staging.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";
import sample from "../../py-parity-checking/fixtures/audit-tle.json" with { type: "json" };
const a = [1, 2, 3, 4, 5, 6, 7, 8] as const,
  b = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
function mock(method: keyof NativeAddon, fn: (...args: never[]) => unknown) {
  return createEphemerisApi(
    { [method]: fn } as NativeAddon,
    createSpiceHandleRegistry(),
    createKernelStager(),
    createVirtualOutputStager(),
  );
}
it("copies native parser results and delegates independent ASCII rows", () => {
  const source: number[] = Array.from(b),
    call = vi.fn(() => ({ epoch: 10, elems: source })),
    api = mock("getelm", call);
  const rows = ["first", "second"] as const;
  const result = api.getelm(1957, rows);
  expect(call).toHaveBeenCalledWith(1957, rows);
  expect(Reflect.get(call.mock.calls[0]!, 1)).not.toBe(rows);
  source[0] = 40;
  expect(result.elems).toEqual(b);
  expect(() => api.getelm(1.5, rows)).toThrow();
  expect(() => api.getelm(1957, ["😀", "two"])).toThrow();
  expect(call).toHaveBeenCalledTimes(1);
});
it("copies both numeric operands and all six native result entries", () => {
  const state = [1, -2, 3, -4, 5, -6],
    call = vi.fn(() => state),
    api = mock("evsgp4", call);
  const actual = api.evsgp4(123, a, b);
  expect(call).toHaveBeenCalledWith(123, a, b);
  expect(Reflect.get(call.mock.calls[0]!, 1)).not.toBe(a);
  expect(Reflect.get(call.mock.calls[0]!, 2)).not.toBe(b);
  state[4] = 91;
  expect(actual).toEqual([1, -2, 3, -4, 5, -6]);
  expect(() => Reflect.apply(api.evsgp4, null, [1, [0, 1], b])).toThrow();
  expect(() => api.evsgp4(Infinity, a, b)).toThrow();
  expect(call).toHaveBeenCalledTimes(1);
});
it("rejects malformed native results and propagates the original native status error", () => {
  expect(() =>
    mock("getelm", () => ({ epoch: 2, elems: [1] })).getelm(1957, ["a", "b"]),
  ).toThrow(/10/);
  expect(() =>
    mock("evsgp4", () => [0, 0, 0, 0, 0, "text"]).evsgp4(1, a, b),
  ).toThrow(/numeric/);
  const error = new Error("CSPICE test status");
  expect(() =>
    mock("evsgp4", () => {
      throw error;
    }).evsgp4(1, a, b),
  ).toThrow(error);
});
it.runIf(nodeAddonAvailable())(
  "direct compiled addon validates extents under mutation and recovers from actual toolkit errors",
  () => {
    const n = getNativeAddon(),
      rows = sample.lines.survey;
    n.kclear();
    try {
      const elems: number[] = Array.from(b),
        g = Array.from(a);
      Object.defineProperty(g, 0, {
        get() {
          elems.length = 3;
          return 1;
        },
      });
      expect(() => n.evsgp4(1, g, elems)).toThrow(/extent/);
      for (const invalid of [["a"], [null, "b"], ["x\0", "y"]])
        expect(() => Reflect.apply(n.getelm, n, [1957, invalid])).toThrow();
      expect(() => Reflect.apply(n.getelm, n, [0x100000000, rows])).toThrow();
      expect(() => Reflect.apply(n.getelm, n, [1957, rows])).toThrow(
        /NOLEAPSECONDS/,
      );
      n.furnsh(
        fileURLToPath(
          new URL(
            "../../py-parity-checking/fixtures/kernels/naif0012.tls",
            import.meta.url,
          ),
        ),
      );
      const parsed = n.getelm(1957, [rows[0]!, rows[1]!]);
      expect(parsed.elems).toHaveLength(10);
      const broken = parsed.elems.slice();
      broken[5] = 0.7;
      expect(() => n.evsgp4(parsed.epoch, sample.geophs, broken)).toThrow(
        /SUBORBITAL/,
      );
      expect(n.evsgp4(parsed.epoch, sample.geophs, parsed.elems)).toHaveLength(
        6,
      );
    } finally {
      n.kclear();
    }
  },
);
