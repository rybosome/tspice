import { describe, expect, it, vi } from "vitest";
import { createDskApi } from "../src/domains/dsk.js";
import { getNativeAddon, type NativeAddon } from "../src/native.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

import { createSpiceHandleRegistry } from "@rybosome/tspice-core";

const v = [0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 4],
  p = [1, 3, 2, 1, 2, 4, 1, 4, 3, 2, 3, 4],
  z = [0, 0, 0],
  x = [2, 0, 0],
  y = [0, 3, 0];
const specs = [
  { name: "pltar", input: [v, p], result: [Infinity], decoded: Infinity },
  { name: "pltvol", input: [v, p], result: [-Infinity], decoded: -Infinity },
  {
    name: "pltexp",
    input: [v.slice(0, 9), 0.5],
    result: [0, 1, 2, 3, 4, 5, 6, 7, -0],
    decoded: [0, 1, 2, 3, 4, 5, 6, 7, -0],
  },
  {
    name: "pltnp",
    input: [z, z, x, y],
    result: [0, -0, 2, Infinity],
    decoded: { pnear: [0, -0, 2], dist: Infinity },
  },
  {
    name: "pltnrm",
    input: [z, x, y],
    result: [-0, Infinity, NaN],
    decoded: [-0, Infinity, NaN],
  },
  {
    name: "dskrb2",
    input: [v, p, 4, [2, 0.25]],
    result: [-Infinity, Infinity],
    decoded: { mncor3: -Infinity, mxcor3: Infinity },
  },
] as const;
function once<T extends object>(source: T): T {
  const seen = new Set<PropertyKey>();
  return new Proxy(source, {
    get(object, key, receiver) {
      if (
        typeof key === "string" &&
        (Array.isArray(object)
          ? key === "length" || /^\d+$/.test(key)
          : ["center", "semiMajor", "semiMinor"].includes(key))
      ) {
        if (seen.has(key)) throw new Error("Duplicate property read: " + key);
        seen.add(key);
      }
      return Reflect.get(object, key, receiver);
    },
  });
}
function snapshot(x: unknown): unknown {
  return Array.isArray(x) ? once([...x]) : x;
}
function apiFor(name: string, fn: (...args: unknown[]) => unknown) {
  // These boundary tests invoke only the one named addon method.
  return createDskApi(
    { [name]: fn } as NativeAddon,
    createSpiceHandleRegistry(),
    { resolvePathForSpice: (p) => p },
  );
}
for (const spec of specs) {
  it(
    spec.name +
      " owns finite inputs and published vectors including the native IEEE fields",
    () => {
      const result = structuredClone(spec.result),
        spy = vi.fn((..._args: unknown[]) => result);
      const api = apiFor(spec.name, spy);
      const args = spec.input.map(snapshot);
      const observed = Reflect.apply(api[spec.name], api, args);
      expect(spy.mock.calls[0]).toEqual(spec.input);
      expect(observed).toEqual(spec.decoded);
      function corrupt(obj: unknown) {
        if (Array.isArray(obj)) {
          obj.fill(123);
          return;
        }
        if (obj && typeof obj === "object")
          for (const field of Object.values(obj))
            if (Array.isArray(field)) field.fill(123);
      }
      corrupt(result);
      expect(observed).toEqual(spec.decoded);
    },
  );
  it(spec.name + " rejects malformed or nonnumeric backend results", () => {
    for (const result of [[], ["7"], [undefined, null]]) {
      const api = apiFor(spec.name, () => result);
      expect(() => Reflect.apply(api[spec.name], api, spec.input)).toThrow();
    }
  });
}
it("validates mesh shape, scalar and signed index bounds before native dispatch", () => {
  const spy = vi.fn();
  const mesh = apiFor("pltar", spy),
    bound = apiFor("dskrb2", spy);
  const sparse = new Array<number>(3);
  sparse[0] = 1;
  sparse[2] = 3;
  for (const invalid of [[1, 2], [1, 2, Infinity], sparse])
    expect(() => Reflect.apply(mesh.pltar, mesh, [invalid, p])).toThrow();
  for (const indices of [
    [0.5, 2, 3],
    [1, 2147483648, 3],
  ])
    expect(() => mesh.pltar(v, indices)).toThrow();
  expect(() => bound.dskrb2(v, p, 4, [2])).toThrow();
  expect(() => bound.dskrb2(v, p, 2.5, [])).toThrow();
  expect(() => apiFor("pltexp", spy).pltexp(v.slice(0, 9), NaN)).toThrow();
  expect(spy).not.toHaveBeenCalled();
});
describe.skipIf(!nodeAddonAvailable())("actual plate addon", () => {
  it("validates physical dimensions before C and preserves toolkit diagnostics and subsequent calls", () => {
    const addon = getNativeAddon();
    for (const { name } of specs)
      expect(() => Reflect.apply(addon[name], addon, [])).toThrow();
    expect(() => addon.pltexp([1, 2], 0)).toThrow(/length/);
    expect(() => addon.pltar([1, 2], [1, 1, 1])).toThrow(/length/);
    expect(() => addon.dskrb2(v, [1, 2, 5], 1, [])).toThrow(/one-based/);
    expect(() => addon.dskrb2(v, p, 4, [2])).toThrow(/shape/);
    expect(() => addon.pltvol(v, [...p.slice(0, -1), 0])).toThrow(
      /INDEXOUTOFRANGE/,
    );
    expect(addon.pltvol(v, p)).toEqual([4]);
    expect(addon.dskrb2([], [], 3, [])).toEqual([
      Number.MAX_VALUE,
      -Number.MAX_VALUE,
    ]);
  });
});
