import { describe, expect, it, vi } from "vitest";
import { createSpiceHandleRegistry } from "@rybosome/tspice-core";
import { createEphemerisApi } from "../src/domains/ephemeris.js";
import { getNativeAddon, type NativeAddon } from "../src/runtime/addon.js";
import { createKernelStager } from "../src/runtime/kernel-staging.js";
import { createVirtualOutputStager } from "../src/runtime/virtual-output-staging.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

// Only the method configured for this test is called. No kernel or file slots are used.
function mockApi(
  method: keyof NativeAddon,
  call: (...args: never[]) => unknown,
) {
  const native = { [method]: call } as NativeAddon;
  return createEphemerisApi(
    native,
    createSpiceHandleRegistry(),
    createKernelStager(),
    createVirtualOutputStager(),
  );
}
function once(values: number[]) {
  const accessed = new Set<string>();
  return new Proxy([...values], {
    get(target, key, receiver) {
      if (typeof key === "string" && (key === "length" || /^\d+$/.test(key))) {
        if (accessed.has(key)) throw new Error("Repeated tuple read: " + key);
        accessed.add(key);
      }
      return Reflect.get(target, key, receiver);
    },
  });
}

const cases = [
  {
    method: "spkcpo",
    args: [
      "100001",
      125.25,
      "RELATIVE_SPIN",
      "TARGET",
      "CN+S",
      [321.5, -224.25, 111.375],
      "0",
      "J2000",
    ],
    width: 7,
  },
  {
    method: "spkcpt",
    args: [
      [321.5, -224.25, 111.375],
      "0",
      "J2000",
      125.25,
      "RELATIVE_SPIN",
      "CENTER",
      "CN+S",
      "100001",
    ],
    width: 7,
  },
  {
    method: "spkcvo",
    args: [
      "100001",
      125.25,
      "RELATIVE_SPIN",
      "CENTER",
      "XCN+S",
      [321.5, -224.25, 111.375, 0.375, -0.25, 0.1875],
      -211.5,
      "0",
      "J2000",
    ],
    width: 7,
  },
  {
    method: "spkcvt",
    args: [
      [321.5, -224.25, 111.375, 0.375, -0.25, 0.1875],
      -211.5,
      "0",
      "J2000",
      125.25,
      "RELATIVE_SPIN",
      "TARGET",
      "XCN+S",
      "100001",
    ],
    width: 7,
  },
  {
    method: "azlcpo",
    args: [
      "ELLIPSOID",
      "100102",
      21.5,
      "CN+S",
      true,
      true,
      [3.2, 1.7, -0.75],
      "100101",
      "AUDIT_GEOMETRY_FIXED",
    ],
    width: 7,
  },
] as const;

describe.each(cases)("$method native boundary", ({ method, args, width }) => {
  it("snapshots each input once, retains scalar ordering and publishes owned IEEE output", () => {
    const words = Array.from({ length: width }, (_, i) =>
      i === 0 ? -0 : i === width - 1 ? Infinity : i,
    );
    const call = vi.fn(() => once(words)),
      api = mockApi(method, call);
    const captured: unknown[] = args.map((a) =>
      Array.isArray(a) ? once([...a]) : a,
    );
    const result: unknown = Reflect.apply(api[method], undefined, captured);
    const inputs: unknown[] = Reflect.get(call.mock.calls, 0);
    expect(inputs).toEqual(args);
    for (const [i, input] of inputs.entries())
      if (Array.isArray(input))
        expect(Object.is(input, captured[i])).toBe(false);
    expect(result).toEqual({ state: words.slice(0, 6), lt: words[6] });
    expect(Object.is(result, call.mock.results[0]!.value)).toBe(false);
  });
  it("rejects malformed vectors, nonfinite epochs, invalid logical values and embedded NUL before dispatch", () => {
    const call = vi.fn(),
      api = mockApi(method, call);
    for (const [i, sample] of args.entries()) {
      const wrong = Array.isArray(sample)
        ? [
            [],
            Array(sample.length),
            [...sample.slice(1), Infinity],
            new Float64Array(sample),
          ]
        : typeof sample === "string"
          ? [42, "bad\0suffix"]
          : [Infinity, NaN, "0"];
      for (const value of wrong) {
        const bad: unknown[] = [...args];
        bad[i] = value;
        expect(() => Reflect.apply(api[method], undefined, bad)).toThrow();
      }
    }
    expect(call).not.toHaveBeenCalled();
  });
  it("rejects malformed native output and retains native error identity", () => {
    for (const bad of [
      [],
      Array(width),
      Array(width).fill("0"),
      Array(width + 1).fill(0),
    ]) {
      expect(() =>
        Reflect.apply(mockApi(method, () => bad)[method], undefined, args),
      ).toThrow();
    }
    const original = new Error("SPICE error"),
      api = mockApi(method, () => {
        throw original;
      });
    expect(() => Reflect.apply(api[method], undefined, args)).toThrow(original);
  });
});

it.runIf(nodeAddonAvailable)(
  "direct addon validates missing inputs, and retains SPICE errors and safe reuse",
  () => {
    const n = getNativeAddon();
    expect(() =>
      n.spkcpo("0", 0, "J2000", "CENTER", "NONE", [1, 2], "0", "J2000"),
    ).toThrow();
    expect(() =>
      n.spkcvt(
        [1, 0, 0, 0, 0, 0],
        0,
        "0",
        "J2000",
        0,
        "bad\0frame",
        "CENTER",
        "NONE",
        "0",
      ),
    ).toThrow();
    expect(() =>
      n.spkcvo(
        "0",
        0,
        "J2000",
        "OBSERVER",
        "CN+S",
        [-1, 0, 0, 0, 299792.458, 0],
        0,
        "0",
        "J2000",
      ),
    ).toThrow(/DIVIDEBYZERO/);
    expect(
      n.spkcpt([3, 4, 0], "0", "J2000", 0, "J2000", "CENTER", "NONE", "0"),
    ).toEqual([3, 4, 0, 0, 0, 0, 5 / 299792.458]);
  },
);
