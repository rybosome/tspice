import { expect, it, vi } from "vitest";
import { createFramesApi } from "../src/domains/frames.js";
import { getNativeAddon, type NativeAddon } from "../src/native.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";
const stager = { resolvePathForSpice: (path: string) => path };
const vec = [1, 0, 0],
  plane = [0, 1, 0],
  axis = [1, 0, 0, 0, 0.25, 0],
  state = [0, 1, 0, -0.25, 0, 0];
const mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1],
  mat6 = Array.from({ length: 36 }, (_, i) => (i % 7 === 0 ? 1 : 0));
const ieee3 = [NaN, -0, Infinity],
  ieeestate = [...ieee3, -Infinity, 1, 0],
  ieee9 = [...ieeestate, 1, 2, 3],
  ieee36 = [...ieee9, ...ieee9, ...ieee9, ...ieee9];
const specs = [
  { name: "frame", input: [vec], out: { x: ieee3, y: ieee3, z: ieee3 } },
  { name: "twovec", input: [vec, 1, plane, 2], out: ieee9 },
  { name: "twovxf", input: [axis, 1, state, 2], out: ieee36 },
  { name: "eul2xf", input: [axis, 3, 1, 3], out: ieee36 },
  {
    name: "xf2eul",
    input: [mat6, 3, 1, 3],
    out: { eulang: ieeestate, unique: false },
  },
  { name: "xf2rav", input: [mat6], out: { rot: ieee9, av: ieee3 } },
  { name: "rav2xf", input: [mat3, vec], out: ieee36 },
  { name: "invstm", input: [mat6], out: ieee36 },
  { name: "xpose6", input: [mat6], out: ieee36 },
] as const;
function once(value: unknown) {
  if (!Array.isArray(value)) return value;
  const keys = new Set<PropertyKey>();
  return new Proxy([...value], {
    get(t, k, r) {
      if (k === "length" || (typeof k === "string" && /^\d+$/.test(k))) {
        if (keys.has(k)) throw Error("Repeated read of " + String(k));
        keys.add(k);
      }
      return Reflect.get(t, k, r);
    },
  });
}
function apiFor(name: string, fn: (...args: unknown[]) => unknown) {
  // The adapter being exercised needs only its corresponding addon symbol.
  return createFramesApi({ [name]: fn } as NativeAddon, stager);
}
for (const spec of specs) {
  it(
    spec.name +
      " captures inputs once and publishes owned complete IEEE results",
    () => {
      const result = structuredClone(spec.out);
      const spy = vi.fn((..._args: unknown[]) => result),
        api = apiFor(spec.name, spy);
      const args = spec.input.map(once);
      const got = Reflect.apply(api[spec.name], api, args);
      expect(spy.mock.calls[0]).toEqual(spec.input);
      for (const [i, original] of args.entries())
        if (Array.isArray(original))
          expect(Object.is(spy.mock.calls[0]?.[i], original)).toBe(false);
      expect(got).toEqual(spec.out);
      if (Array.isArray(result)) result.fill(42);
      else
        for (const field of Object.values(result))
          if (Array.isArray(field)) field.fill(42);
      expect(got).toEqual(spec.out);
    },
  );
  it(
    spec.name +
      " rejects malformed widths, component types and signed32 overflow before dispatch",
    () => {
      const spy = vi.fn(),
        api = apiFor(spec.name, spy);
      for (const [i, v] of spec.input.entries()) {
        const invalid = Array.isArray(v)
          ? [v.slice(1), [...v, 0], v.map(() => NaN), v.map(() => null)]
          : [0.5, 2 ** 31, -(2 ** 31) - 1, NaN];
        for (const wrong of invalid)
          expect(() =>
            Reflect.apply(
              api[spec.name],
              api,
              spec.input.map((x, j) => (i === j ? wrong : x)),
            ),
          ).toThrow();
      }
      expect(spy).not.toHaveBeenCalled();
    },
  );
  it(
    spec.name +
      " rejects missing, nonnumeric or incorrectly sized native output",
    () => {
      const bad = Array.isArray(spec.out)
        ? [spec.out.slice(1), spec.out.map(() => "bad")]
        : [
            {},
            ...Object.keys(spec.out).map((k) => ({
              ...spec.out,
              [k]: k === "unique" ? 1 : [],
            })),
          ];
      for (const out of bad) {
        const api = apiFor(spec.name, () => out);
        expect(() => Reflect.apply(api[spec.name], api, spec.input)).toThrow();
      }
    },
  );
}
const actual = it.runIf(nodeAddonAvailable());
actual(
  "validates exact array widths, component types and signed integer axes in the linked addon",
  () => {
    const raw = getNativeAddon();
    for (const spec of specs) {
      expect(() => Reflect.apply(raw[spec.name], raw, [])).toThrow();
      for (const [i, value] of spec.input.entries()) {
        const wrong = Array.isArray(value) ? value.slice(1) : 2 ** 31;
        expect(() =>
          Reflect.apply(
            raw[spec.name],
            raw,
            spec.input.map((x, j) => (i === j ? wrong : x)),
          ),
        ).toThrow();
      }
    }
    expect(raw.xpose6(mat6)).toEqual(mat6);
  },
);
actual(
  "preserves the six-by-six row-major rotation blocks, angular velocity and both unique statuses",
  () => {
    const api = createFramesApi(getNativeAddon(), stager);
    const rot = api.twovec([1, 0, 0], 1, [0, 1, 0], 2);
    const transform = api.rav2xf(rot, [1, -2, 3]);
    expect(api.xf2rav(transform)).toEqual({ rot, av: [1, -2, 3] });
    expect(api.invstm(transform)).not.toEqual(api.xpose6(transform));
    expect(api.invstm(api.invstm(transform))).toEqual(transform);
    expect(api.xpose6(api.xpose6(transform))).toEqual(transform);
    const e = api.xf2eul(
      api.eul2xf([0.3, 0.5, 0.7, 1, 2, 3], 3, 1, 3),
      3,
      1,
      3,
    );
    expect(e.unique).toBe(true);
    expect(e.eulang[3]).toBeCloseTo(1, 12);
    const singular = api.xf2eul(
      api.eul2xf([0, 0, 0, 0, 0, 0], 3, 1, 3),
      3,
      1,
      3,
    );
    expect(singular.unique).toBe(false);
    expect(singular.eulang).toHaveLength(6);
  },
);
actual(
  "returns canonical diagnostics from guarded entry points and reuses the same native session",
  () => {
    const raw = getNativeAddon();
    expect(() => raw.twovxf(axis, 1, axis, 2)).toThrow(
      /DEPENDENTVECTORS[\s\S]*twovxf_c --> TWOVXF --> ZZTWOVXF/,
    );
    expect(() => raw.xf2eul(mat6, 3, 3, 1)).toThrow(
      /BADAXISNUMBERS[\s\S]*xf2eul_c --> XF2EUL --> M2EUL/,
    );
    expect(() => raw.eul2xf(axis, -2147483648, 1, 1)).toThrow(
      /BADAXISNUMBERS[\s\S]*eul2xf_c --> EUL2XF --> EUL2M/,
    );
    expect(raw.frame([0, 0, 0])).toEqual({
      x: [1, 0, 0],
      y: [0, 1, 0],
      z: [0, 0, 1],
    });
    expect(raw.twovxf(axis, 1, state, 2)).toHaveLength(36);
  },
);
