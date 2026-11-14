import { expect, it, vi } from "vitest";
import { createGeometryApi } from "../src/domains/geometry.js";
import { getNativeAddon, type NativeAddon } from "../src/native.js";
import { createNodeBackend } from "../src/index.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";
import type { SpicePlane } from "@rybosome/tspice-backend-contract";

function once<T extends number[]>(input: T): T {
  const seen = new Set<PropertyKey>();
  return new Proxy(input, {
    get(target, key, receiver) {
      if (key === "length" || (typeof key === "string" && /^\d+$/.test(key))) {
        if (seen.has(key)) throw new Error("Repeated access: " + String(key));
        seen.add(key);
      }
      return Reflect.get(target, key, receiver);
    },
  });
}
const xyz = [1, 2, 3],
  plane = [0, 0, 1, 2],
  vectorOut = [Infinity, NaN, -0],
  planeOut = [0, -0, NaN, Infinity];
const examples = [
  { method: "nvp2pl", inputs: [xyz, xyz], output: planeOut },
  {
    method: "pl2nvp",
    inputs: [plane],
    output: { normal: vectorOut, point: vectorOut },
  },
  {
    method: "pl2psv",
    inputs: [plane],
    output: { point: vectorOut, span1: vectorOut, span2: vectorOut },
  },
  { method: "psv2pl", inputs: [xyz, xyz, xyz], output: planeOut },
  {
    method: "inrypl",
    inputs: [xyz, xyz, plane],
    output: { nxpts: 1, xpt: vectorOut },
  },
  { method: "vprjp", inputs: [xyz, plane], output: vectorOut },
  {
    method: "vprjpi",
    inputs: [xyz, plane, plane],
    output: { found: true, vout: vectorOut },
  },
  {
    method: "nplnpt",
    inputs: [xyz, xyz, xyz],
    output: { pnear: vectorOut, dist: Infinity },
  },
] as const;
for (const { method, inputs, output } of examples) {
  it(
    method +
      " dispatches a single snapshot of each input and owns every numeric output",
    () => {
      const spy = vi.fn((...args: number[][]) => {
        void args;
        return output;
      });
      // Only the named entrypoint is invoked in this adapter fixture.
      const api = createGeometryApi({
        [method]: spy,
      } as unknown as NativeAddon);
      const originals = inputs.map((input) => once([...input]));
      const result: unknown = Reflect.apply(api[method], api, originals);
      expect(spy).toHaveBeenCalledTimes(1);
      const captured = spy.mock.calls[0]!;
      for (let i = 0; i < inputs.length; i++) {
        expect(Object.is(originals[i], captured[i])).toBe(false);
        expect(captured[i]).toEqual(inputs[i]);
      }
      expect(result).toEqual(output);
      expect(Object.is(result, output)).toBe(false);
      if (
        typeof result === "object" &&
        result !== null &&
        !Array.isArray(output)
      )
        for (const [key, field] of Object.entries(output))
          if (Array.isArray(field))
            expect(Object.is(Reflect.get(result, key), field)).toBe(false);
    },
  );
  it(
    method +
      " rejects wrong lengths, holes and nonfinite inputs before dispatch",
    () => {
      const spy = vi.fn();
      const api = createGeometryApi({
        [method]: spy,
      } as unknown as NativeAddon);
      for (let j = 0; j < inputs.length; j++) {
        const input = inputs[j]!;
        for (const bad of [
          [],
          [...input, 0],
          input.map(() => NaN),
          Array(input.length),
        ]) {
          const malformed = inputs.map((entry, i) => (i === j ? bad : entry));
          expect(() => Reflect.apply(api[method], api, malformed)).toThrow();
        }
      }
      expect(spy).not.toHaveBeenCalled();
    },
  );
}
it("a false VPRJPI result never reads the undefined output vector", () => {
  const api = createGeometryApi({
    vprjpi: () => ({
      found: false,
      get vout() {
        throw Error("Undefined vector read");
      },
    }),
  } as unknown as NativeAddon);
  expect(api.vprjpi([1, 2, 0], [0, 0, 1, 0], [1, 0, 0, 1])).toEqual({
    found: false,
  });
});
it("rejects unexpected INRYPL counts and VPRJPI flags before exposing output", () => {
  const api = createGeometryApi({
    inrypl: () => ({ nxpts: 2, xpt: [0, 0, 0] }),
    vprjpi: () => ({ found: 1 }),
  } as unknown as NativeAddon);
  expect(() => api.inrypl([0, 0, 0], [1, 0, 0], [0, 0, 1, 0])).toThrow(/count/);
  expect(() => api.vprjpi([0, 0, 0], [0, 0, 1, 0], [0, 0, 1, 0])).toThrow(
    /found/,
  );
});
const itNative = it.runIf(nodeAddonAvailable());
itNative("validates every actual addon finite tuple and recovers", () => {
  const addon = getNativeAddon();
  for (const { method, inputs } of examples) {
    expect(() => Reflect.apply(addon[method], addon, [])).toThrow(
      /argument count/,
    );
    for (let j = 0; j < inputs.length; j++) {
      const malformed = inputs.map((entry, i) =>
        i !== j ? entry : entry.map(() => Infinity),
      );
      expect(() => Reflect.apply(addon[method], addon, malformed)).toThrow(
        /finite/,
      );
    }
  }
  expect(addon.nvp2pl([0, 0, 1], [1, 2, 3])).toEqual([0, 0, 1, 3]);
});
itNative(
  "dispatches actual intersection cardinality, defined miss payloads and named errors",
  () => {
    const raw = createNodeBackend().raw;
    const xy: SpicePlane = [0, 0, 1, 0];
    expect(raw.inrypl([3, 4, 0], [0, 1, 0], xy)).toEqual({
      nxpts: -1,
      xpt: [3, 4, 0],
    });
    expect(raw.inrypl([3, 4, 1], [0, 1, 0], xy)).toEqual({
      nxpts: 0,
      xpt: [0, 0, 0],
    });
    expect(raw.inrypl([3, 4, 0], [0, 0, 1], xy)).toEqual({
      nxpts: 1,
      xpt: [3, 4, 0],
    });
    expect(raw.vprjpi([3, 4, 0], xy, [1, 0, 0, 7])).toEqual({ found: false });
    expect(() => raw.inrypl([0, 0, 0], [0, 0, 0], xy)).toThrow(/ZEROVECTOR/);
    expect(() => raw.psv2pl([0, 0, 0], [1, 0, 0], [2, 0, 0])).toThrow(
      /DEGENERATECASE/,
    );
    expect(() => raw.nplnpt([0, 0, 0], [0, 0, 0], [1, 2, 3])).toThrow(
      /ZEROVECTOR/,
    );
    expect(raw.failed()).toBe(false);
    expect(raw.vprjpi([3, 4, 0], xy, [0, 0, 1, 2])).toEqual({
      found: true,
      vout: [3, 4, 2],
    });
  },
);
