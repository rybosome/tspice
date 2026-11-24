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
  { method: "spkacs", args: [0, 0, "J2000", "NONE", 0], width: 8 },
  {
    method: "spkapo",
    args: [0, 0, "J2000", [0, 0, 0, 0, 0, 0], "NONE"],
    width: 4,
  },
  {
    method: "spkapp",
    args: [0, 0, "J2000", [0, 0, 0, 0, 0, 0], "NONE"],
    width: 7,
  },
  {
    method: "spkaps",
    args: [0, 0, "J2000", "NONE", [0, 0, 0, 0, 0, 0], [0, 0, 0]],
    width: 8,
  },
  {
    method: "spkltc",
    args: [0, 0, "J2000", "NONE", [0, 0, 0, 0, 0, 0]],
    width: 8,
  },
  {
    method: "stelab",
    args: [
      [2, 0, 0],
      [0, 0, 0],
    ],
    width: 3,
  },
  {
    method: "stlabx",
    args: [
      [2, 0, 0],
      [0, 0, 0],
    ],
    width: 3,
  },
  { method: "ltime", args: [0, 0, "->", 0], width: 2 },
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
    const expected: { [key: number]: unknown } = {
      2: { ettarg: words[0], elapsd: words[1] },
      3: words,
      4: { pos: words.slice(0, 3), lt: words[3] },
      7: { state: words.slice(0, 6), lt: words[6] },
      8: { state: words.slice(0, 6), lt: words[6], dlt: words[7] },
    };
    expect(result).toEqual(expected[width]);
    expect(Object.is(result, call.mock.results[0]!.value)).toBe(false);
  });
  it("rejects malformed vectors, nonfinite epochs, invalid IDs and embedded NUL before dispatch", () => {
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
  "checks direct-addon inputs, arbitrary raw correction strings and live recovery",
  () => {
    const native = getNativeAddon();
    expect(() => native.spkacs(2147483648, 0, "J2000", "NONE", 0)).toThrow();
    expect(() =>
      native.spkapp(0, 0, "J2000", [0, 0, 0, 0, 0, 0], "CN\0+S"),
    ).toThrow();
    expect(() => native.stlabx([1, 0, 0], [0, 300000, 0])).toThrow(
      /VALUEOUTOFRANGE/,
    );
    expect(native.stlabx([1, 0, 0], [0, 0, 0])).toEqual([1, 0, 0]);
  },
);
