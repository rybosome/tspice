import { describe, expect, it, vi } from "vitest";
import { createSpiceHandleRegistry } from "@rybosome/tspice-core";
import { createEphemerisApi } from "../src/domains/ephemeris.js";
import { getNativeAddon, type NativeAddon } from "../src/runtime/addon.js";
import { createKernelStager } from "../src/runtime/kernel-staging.js";
import { createVirtualOutputStager } from "../src/runtime/virtual-output-staging.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

const radius = [1, 0, 0, 0, 0, 0, 0, 1],
  state = [1, 0, 0, 0, 1, 0],
  eq = [1, 0, 0, 0, 0, 0, 0, 1, 0];
const cases = [
  { method: "conics", args: [radius, 0], pos: 0, count: 6 },
  {
    method: "eqncpv",
    args: [0, 0, eq, -Math.PI / 2, Math.PI / 2],
    pos: 2,
    count: 6,
  },
  { method: "oscelt", args: [state, 0, 1], pos: 0, count: 8 },
  { method: "oscltx", args: [state, 0, 1], pos: 0, count: 11 },
  { method: "prop2b", args: [1, state, 0], pos: 1, count: 6 },
] as const;

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

describe.each(cases)(
  "$method native boundary",
  ({ method, args, pos, count }) => {
    it("takes one snapshot, preserves scalar order and owns every returned word", () => {
      const words = Array.from({ length: count }, (_, i) =>
        i === count - 1 ? Infinity : i === count - 2 ? NaN : 1.25 * (i + 1),
      );
      const call = vi.fn(() => once(words)),
        api = mockApi(method, call);
      const rawArgs: unknown[] = [...args],
        vector = args[pos];
      if (!Array.isArray(vector)) throw new Error("Missing tuple fixture");
      rawArgs[pos] = once(vector);
      const result = Reflect.apply(api[method], undefined, rawArgs);
      expect(call).toHaveBeenCalledTimes(1);
      const captured = Reflect.get(call.mock.calls, 0);
      expect(captured).toEqual(args);
      expect(captured[pos] === rawArgs[pos]).toBe(false);
      expect(result).toEqual(words);
      expect(result === call.mock.results[0]!.value).toBe(false);
      words[0] = 99;
      expect(result[0]).toBe(1.25);
    });

    it("rejects lengths, holes, nonfinite entries and invalid scalar positions before native", () => {
      const call = vi.fn(),
        api = mockApi(method, call);
      for (const [i, sample] of args.entries()) {
        const bad = Array.isArray(sample)
          ? [
              sample.slice(1),
              [...sample, 0],
              Array(sample.length),
              sample.map((x, j) => (j ? x : NaN)),
              sample.map((x, j) => (j ? x : Infinity)),
              new Float64Array(sample),
            ]
          : [NaN, Infinity, "1", null];
        for (const value of bad) {
          const invalid: unknown[] = [...args];
          invalid[i] = value;
          expect(() =>
            Reflect.apply(api[method], undefined, invalid),
          ).toThrow();
        }
      }
      expect(call).not.toHaveBeenCalled();
    });

    it("rejects malformed native output and propagates genuine error identity", () => {
      for (const invalid of [
        Array(count),
        Array(count - 1).fill(0),
        Array(count + 1).fill(0),
        Array(count).fill(1n),
        null,
      ]) {
        const api = mockApi(method, () => invalid);
        expect(() => Reflect.apply(api[method], undefined, args)).toThrow();
      }
      const failure = Object.assign(new Error("toolkit error"), {
        spiceShort: "SPICE(EXAMPLE)",
      });
      const api = mockApi(method, () => {
        throw failure;
      });
      try {
        Reflect.apply(api[method], undefined, args);
        throw new Error("Missing toolkit error");
      } catch (error) {
        expect(error).toBe(failure);
      }
    });
  },
);

const nativeTest = it.runIf(nodeAddonAvailable());
nativeTest(
  "the compiled addon checks tuple and scalar representations before every scientific call",
  () => {
    const n = getNativeAddon();
    for (const { method, args, pos, count } of cases) {
      const words = args[pos];
      if (!Array.isArray(words)) throw new Error("Missing tuple fixture");
      for (const bad of [
        Array(words.length),
        words.slice(1),
        [...words, 0],
        words.map((v, j) => (j === 1 ? NaN : v)),
      ]) {
        const invalid: unknown[] = [...args];
        invalid[pos] = bad;
        expect(() => Reflect.apply(n[method], undefined, invalid)).toThrow();
      }
      for (let i = 0; i < args.length; i++)
        if (i !== pos) {
          const invalid: unknown[] = [...args];
          invalid[i] = Infinity;
          expect(() => Reflect.apply(n[method], undefined, invalid)).toThrow(
            /finite/,
          );
        }
      const result = Reflect.apply(n[method], undefined, args);
      expect(result).toHaveLength(count);
      expect(result.every(Number.isFinite)).toBe(true);
    }
  },
);

nativeTest(
  "retains the eleven defined OSCLTX fields and recovers from genuine physical-domain errors",
  () => {
    const n = getNativeAddon();
    expect(() => n.conics([1, -1, 0, 0, 0, 0, 0, 1], 0)).toThrow(
      /BADECCENTRICITY/,
    );
    expect(() => n.eqncpv(0, 0, [0, 0, 0, 0, 0, 0, 0, 1, 0], 0, 0)).toThrow(
      /BADSEMIAXIS/,
    );
    expect(() => n.oscelt(state, 0, 0)).toThrow(/NONPOSITIVEMASS/);
    expect(() => n.oscltx([1, 0, 0, 1, 0, 0], 0, 1)).toThrow(/DEGENERATECASE/);
    expect(() => n.prop2b(1, [1, 0, 0, 0, 0, 0], 1)).toThrow(/ZEROVELOCITY/);
    const result = n.oscltx(state, 0, 1);
    expect(result).toHaveLength(11);
    expect(result.slice(0, 8)).toEqual(n.oscelt(state, 0, 1));
    expect(result.slice(8)).toEqual([0, 1, 2 * Math.PI]);
    result[0] = 8;
    expect(n.oscltx(state, 0, 1)[0]).toBe(1);
  },
);
