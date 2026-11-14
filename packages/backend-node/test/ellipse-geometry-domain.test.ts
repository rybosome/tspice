import { expect, it, vi } from "vitest";
import { createGeometryApi } from "../src/domains/geometry.js";
import { getNativeAddon, type NativeAddon } from "../src/native.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

const center = [1, 2, 3],
  major = [4, 0, 0],
  minor = [0, 2, 0],
  plane = [0, 0, 1, 3];
const ellipse = { center, semiMajor: major, semiMinor: minor };
const flat = [...center, ...major, ...minor];
const vec = [-0, NaN, Infinity],
  packed = [...vec, 0, -Infinity, 9, 8, 7, 6];
const outputEllipse = {
  center: vec,
  semiMajor: [0, -Infinity, 9],
  semiMinor: [8, 7, 6],
};
const specs = [
  {
    name: "cgv2el",
    input: [center, major, minor],
    native: [center, major, minor],
    result: packed,
    decoded: outputEllipse,
  },
  {
    name: "el2cgv",
    input: [ellipse],
    native: [flat],
    result: { center: vec, smajor: vec, sminor: vec },
    decoded: { center: vec, smajor: vec, sminor: vec },
  },
  {
    name: "saelgv",
    input: [major, minor],
    native: [major, minor],
    result: { smajor: vec, sminor: vec },
    decoded: { smajor: vec, sminor: vec },
  },
  {
    name: "pjelpl",
    input: [ellipse, plane],
    native: [flat, plane],
    result: packed,
    decoded: outputEllipse,
  },
  {
    name: "inedpl",
    input: [4, 3, 2, plane],
    native: [4, 3, 2, plane],
    result: { found: true, ellipse: packed },
    decoded: { found: true, ellipse: outputEllipse },
  },
  {
    name: "inelpl",
    input: [ellipse, plane],
    native: [flat, plane],
    result: { nxpts: 1, xpt1: vec, xpt2: [8, 7, 6] },
    decoded: { nxpts: 1, xpt1: vec, xpt2: [8, 7, 6] },
  },
  {
    name: "npelpt",
    input: [center, ellipse],
    native: [center, flat],
    result: { pnear: vec, dist: Infinity },
    decoded: { pnear: vec, dist: Infinity },
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
function snapshot(value: unknown): unknown {
  if (Array.isArray(value)) return once([...value]);
  if (value === ellipse)
    return once({
      center: once([...center]),
      semiMajor: once([...major]),
      semiMinor: once([...minor]),
    });
  return value;
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
      expect(spy.mock.calls[0]).toEqual(spec.native);
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
        const invalid: unknown[] =
          source === ellipse
            ? [
                [],
                {},
                { ...ellipse, semiMajor: [0, null, 0] },
                { ...ellipse, center: [1, 2, Infinity] },
              ]
            : Array.isArray(source)
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
it("reads conditional payloads only after checking the exact status", () => {
  for (const nxpts of [-1, 0, 3, null]) {
    const out = {
      nxpts,
      get xpt1() {
        throw new Error("Read undefined point");
      },
      get xpt2() {
        throw new Error("Read undefined point");
      },
    };
    const api = apiFor("inelpl", () => out),
      call = () => Reflect.apply(api.inelpl, api, [ellipse, plane]);
    if (nxpts === -1 || nxpts === 0) expect(call()).toEqual({ nxpts });
    else expect(call).toThrow(/count/);
  }
  for (const found of [false, 0, null]) {
    const api = apiFor("inedpl", () => ({
      found,
      get ellipse() {
        throw new Error("Read undefined ellipse");
      },
    }));
    const call = () => api.inedpl(1, 2, 3, [0, 0, 1, 4]);
    if (found === false) expect(call()).toEqual({ found: false });
    else expect(call).toThrow(/found/);
  }
});
it("rejects malformed promised output vectors, ellipse shape and distance", () => {
  const bad: unknown[] = [1, 2, 3, 4, 5, 6, 7, 8, "nine"];
  for (const spec of specs) {
    const result =
      spec.name === "inedpl"
        ? { found: true, ellipse: bad }
        : spec.name === "inelpl"
          ? { nxpts: 1, xpt1: [1, 2, 3], xpt2: [3, 4] }
          : spec.name === "npelpt"
            ? { pnear: [0, 0, 0], dist: false }
            : bad;
    const api = apiFor(spec.name, () => result);
    expect(() => Reflect.apply(api[spec.name], api, spec.input)).toThrow();
  }
});
const actual = it.runIf(nodeAddonAvailable());
actual(
  "checks actual native packing widths and scalar boundaries on each entry",
  () => {
    const raw = getNativeAddon();
    for (const spec of specs) {
      expect(() => Reflect.apply(raw[spec.name], raw, [])).toThrow(/count/);
      for (let i = 0; i < spec.native.length; i++) {
        const value: unknown = spec.native[i];
        const bad = Array.isArray(value) ? value.slice(1) : Infinity;
        expect(() =>
          Reflect.apply(
            raw[spec.name],
            raw,
            spec.native.map((x, j) => (i === j ? bad : x)),
          ),
        ).toThrow();
      }
    }
    expect(raw.el2cgv(flat)).toEqual({ center, smajor: major, sminor: minor });
  },
);
actual(
  "preserves all intersection classifications and leaves undefined vectors absent",
  () => {
    const api = createGeometryApi(getNativeAddon()),
      e = api.cgv2el([1, 2, 3], [4, 0, 0], [0, 2, 0]);
    expect(e).toEqual(ellipse);
    expect(api.inelpl(e, [0, 0, 1, 3])).toEqual({ nxpts: -1 });
    expect(api.inelpl(e, [0, 0, 1, 5])).toEqual({ nxpts: 0 });
    const one = api.inelpl(e, [1, 0, 0, 5]);
    expect(one.nxpts).toBe(1);
    if (one.nxpts === 1) {
      expect(one.xpt1).toEqual([5, 2, 3]);
      expect(one.xpt2).toEqual([5, 2, 3]);
      expect(one.xpt1).not.toBe(one.xpt2);
    }
    const two = api.inelpl(e, [1, 0, 0, 1]);
    expect(two.nxpts).toBe(2);
    expect(api.inedpl(4, 3, 2, [0, 0, 1, 4])).toEqual({ found: false });
    const tangent = api.inedpl(4, 3, 2, [0, 0, 1, 2]);
    expect(tangent.found).toBe(true);
    if (tangent.found) expect(tangent.ellipse.center).toEqual([0, 0, 2]);
  },
);
actual(
  "captures the distorted-plane error in initialized native storage and preserves caller recovery",
  () => {
    const raw = getNativeAddon(),
      normal = Math.sqrt(1 / 3);
    expect(() =>
      raw.inedpl(1e300, 1e-300, 1e300, [normal, normal, normal, 0]),
    ).toThrow(/Spanning vectors are parallel\.[\s\S]*inedpl_c --> psv2pl_c/);
    expect(raw.inedpl(4, 3, 2, [0, 0, 1, 4])).toEqual({ found: false });
    expect(() => raw.npelpt([1, 2, 3], [...center, ...major, 0, 0, 0])).toThrow(
      /DEGENERATECASE/,
    );
    expect(raw.npelpt([9, 2, 3], flat)).toEqual({ pnear: [5, 2, 3], dist: 4 });
  },
);
