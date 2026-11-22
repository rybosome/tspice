import { describe, expect, it, vi } from "vitest";
import { getNativeAddon, type NativeAddon } from "../src/runtime/addon.js";
import { createStringsApi } from "../src/domains/strings.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

describe("numeric string addon boundaries", () => {
  const cases = [
    ["dp2hx", [Infinity, 30]],
    ["dp2hx", [1, 2147483648]],
    ["hx2dp", ["A^1\0", 40]],
    ["hx2dp", ["A^1", 0.25]],
    ["prsdp", ["\ud800"]],
    ["prsint", ["2\0"]],
    ["repmc", ["#", "#", "\ud800", 4]],
    ["repmct", ["#", "#", 1, "é", 40]],
    ["repmd", ["#", "#", NaN, 3, 40]],
    ["repmf", ["#", "#", 1, 2.5, "F", 40]],
    ["repmi", ["#", "#", -2147483649, 40]],
    ["repml", ["#", "#", 1, "C", 40]],
    ["repmot", ["#", "#", 1, "LT", 40]],
  ] as const;
  for (const [method, args] of cases)
    it.runIf(nodeAddonAvailable())(
      `rejects direct ${method} ${JSON.stringify(args)}`,
      () => {
        const addon = getNativeAddon();
        expect(() => Reflect.apply(addon[method], addon, args)).toThrow();
      },
    );
  it("validates the native parsed value, conversion flag and full encoded size", () => {
    const hx2dp = vi.fn(() => ({
      error: false,
      errmsg: "unexpected",
      number: 3,
    }));
    const dp2hx = vi.fn(() => ({ hxstr: "X", hxssiz: 257 }));
    const api = createStringsApi({ hx2dp, dp2hx } as NativeAddon);
    expect(() => api.hx2dp("1^1")).toThrow(/Invalid/);
    expect(() => api.dp2hx(1)).toThrow(/Invalid/);
  });
  it.runIf(nodeAddonAvailable())(
    "accepts declared maximal room with physically bounded native output",
    () => {
      const n = getNativeAddon();
      expect(n.dp2hx(1, 2147483647)).toEqual({ hxstr: "1^1", hxssiz: 3 });
      expect(n.repmot("a#z", "#", 21, "l", 2147483647)).toBe("atwenty-firstz");
      expect(n.hx2dp("1G^1", 2147483647)).toEqual({
        error: true,
        errmsg: "ERROR: Illegal character 'G' encountered.",
      });
    },
  );
});
