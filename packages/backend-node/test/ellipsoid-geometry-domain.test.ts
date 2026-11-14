import { describe, expect, it, vi } from "vitest";
import { createGeometryApi } from "../src/domains/geometry.js";
import { getNativeAddon, type NativeAddon } from "../src/native.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

const v = [1, 2, 3] as const;
const output = [-0, Infinity, -Infinity];
const limb = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const specs = [
  {
    name: "nearpt",
    input: [v, 3, 2, 1],
    result: { npoint: output, alt: -3 },
    decoded: { npoint: output, alt: -3 },
  },
  {
    name: "npedln",
    input: [3, 2, 1, v, v],
    result: { pnear: output, dist: Infinity },
    decoded: { pnear: output, dist: Infinity },
  },
  {
    name: "edlimb",
    input: [3, 2, 1, v],
    result: limb,
    decoded: { center: [1, 2, 3], semiMajor: [4, 5, 6], semiMinor: [7, 8, 9] },
  },
  { name: "ednmpt", input: [3, 2, 1, v], result: output, decoded: output },
  { name: "edpnt", input: [v, 3, 2, 1], result: output, decoded: output },
  { name: "surfnm", input: [3, 2, 1, v], result: output, decoded: output },
  {
    name: "surfpt",
    input: [v, v, 3, 2, 1],
    result: { found: true, point: output },
    decoded: { found: true, point: output },
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
  return createGeometryApi({ [name]: fn } as NativeAddon);
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
  it(
    spec.name + " rejects every malformed argument before native dispatch",
    () => {
      const spy = vi.fn(),
        api = apiFor(spec.name, spy);
      for (let i = 0; i < spec.input.length; i++) {
        const source: unknown = spec.input[i];
        const invalid: unknown[] = Array.isArray(source)
          ? [[], [...source, 0], source.map(() => NaN)]
          : [Infinity, null, "1"];
        for (const bad of invalid)
          expect(() =>
            Reflect.apply(
              api[spec.name],
              api,
              spec.input.map((x, j) => (i === j ? bad : x)),
            ),
          ).toThrow();
      }
      expect(spy).not.toHaveBeenCalled();
    },
  );
}
it("omits unread miss coordinates and rejects an invalid native found flag", () => {
  for (const found of [false, 0, null]) {
    const out = {
      found,
      get point() {
        throw new Error("Undefined point read");
      },
    };
    const invoke = () =>
      apiFor("surfpt", () => out).surfpt([5, 0, 0], [1, 0, 0], 3, 2, 1);
    if (found === false) expect(invoke()).toEqual({ found: false });
    else expect(invoke).toThrow(/found flag/);
  }
});
describe.skipIf(!nodeAddonAvailable())("actual ellipsoid addon", () => {
  it("checks malformed native arguments and recovers from real ray and nearest-line errors", () => {
    const addon = getNativeAddon();
    for (const row of specs) {
      expect(() => Reflect.apply(addon[row.name], addon, [])).toThrow();
      expect(() =>
        Reflect.apply(
          addon[row.name],
          addon,
          row.input.map((x) => (Array.isArray(x) ? [1, 2] : x)),
        ),
      ).toThrow();
    }
    expect(() => addon.surfpt([5, 0, 0], [0, 0, 0], 0, 2, 1)).toThrow(
      /ZEROVECTOR/,
    );
    expect(() =>
      addon.npedln(3, 2, 1, [0, 4, 0], [Number.MAX_VALUE, Number.MAX_VALUE, 0]),
    ).toThrow(/ZEROVECTOR/);
    expect(addon.surfpt([5, 0, 0], [-1, 0, 0], 3, 2, 1)).toEqual({
      found: true,
      point: [3, 0, 0],
    });
  });
});
