import { describe, expect, it, vi } from "vitest";
import { createCellsWindowsApi } from "../src/domains/cells-windows.js";
import { getNativeAddon, type NativeAddon } from "../src/runtime/addon.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

// Each mock supplies only the method invoked by its test.
function mockApi(
  method: keyof NativeAddon,
  call: (...args: never[]) => unknown,
) {
  return createCellsWindowsApi({ [method]: call } as NativeAddon);
}

const h = 2 ** 41;
const cases = [
  ["diff", [h, h + 1, h + 2], undefined],
  ["inter", [h, h + 1, h + 2], undefined],
  ["sdiff", [h, h + 1, h + 2], undefined],
  ["union", [h, h + 1, h + 2], undefined],
  ["set", [h, "<=", h + 1], false],
  ["removc", [" x\t", h], undefined],
  ["removd", [-Infinity, h], undefined],
  ["removi", [-2147483648, h], undefined],
  ["ordc", [" x\t", h], -1],
  ["ordd", [-Infinity, h], -1],
  ["ordi", [-2147483648, h], -1],
] as const;
it.each(cases)(
  "%s preserves native argument order, opaque tokens and results",
  (name, args, value) => {
    const f = vi.fn(() => value),
      api = mockApi(name, f);
    expect(Reflect.apply(api[name], undefined, args)).toBe(value);
    expect(f).toHaveBeenCalledWith(...args);
    const problem = new Error("native failure"),
      broken = mockApi(name, () => {
        throw problem;
      });
    expect(() => Reflect.apply(broken[name], undefined, args)).toThrow(problem);
  },
);
it.each(["ordc", "ordd", "ordi", "set"] as const)(
  "%s rejects malformed native results",
  (name) => {
    for (const bad of [undefined, 1.5, -2, 2 ** 33]) {
      const api = mockApi(name, () => bad);
      expect(() =>
        Reflect.apply(
          api[name],
          undefined,
          name === "set" ? [h, "=", h + 1] : [name === "ordc" ? "x" : 0, h],
        ),
      ).toThrow();
    }
  },
);

describe.runIf(nodeAddonAvailable())("compiled set algebra addon", () => {
  it("keeps ordinary registry type errors, result alias guards and expired handles distinct", () => {
    const n = getNativeAddon(),
      a = n.newIntCell(4),
      b = n.newIntCell(4),
      r = n.newIntCell(4),
      d = n.newDoubleCell(4),
      w = n.newWindow(1),
      expired = n.newIntCell(1);
    n.freeCell(expired);
    try {
      n.appndi(1, a);
      n.appndi(2, b);
      for (const op of ["diff", "inter", "sdiff", "union"] as const) {
        for (const dup of [a, b])
          expect(() => n[op](a, b, dup)).toThrow(/distinct/);
        for (const bad of [expired, w, 0, h])
          expect(() => n[op](a, b, bad)).toThrow();
        expect(() => n[op](a, b, d)).toThrow(/TYPEMISMATCH/);
        expect(() => n[op](a, d, r)).toThrow(/TYPEMISMATCH/);
        n[op](a, b, r);
      }
      expect(n.ordi(2, r)).toBe(1);
      expect(n.set(r, ">", a)).toBe(true);
      expect(() => n.set(a, "=", d)).toThrow(/TYPEMISMATCH/);
      for (const op of ["ordc", "removc"] as const)
        expect(() => n[op]("z", a)).toThrow(/TYPEMISMATCH/);
      for (const op of ["ordd", "removd"] as const)
        expect(() => n[op](1, a)).toThrow(/TYPEMISMATCH/);
      for (const op of ["ordi", "removi"] as const)
        expect(() => n[op](1, d)).toThrow(/TYPEMISMATCH/);
    } finally {
      n.freeWindow(w);
      for (const cell of [a, b, r, d]) n.freeCell(cell);
    }
  });
  it("validates text and scalar inputs before mutation in the addon and its adapter", () => {
    const n = getNativeAddon(),
      api = createCellsWindowsApi(n),
      c = n.newCharCell(2, 8),
      i = n.newIntCell(2),
      d = n.newDoubleCell(2);
    try {
      for (const layer of [n, api]) {
        for (const name of ["ordc", "removc"] as const)
          for (const bad of ["x\0z", "\ud800", 2])
            expect(() =>
              Reflect.apply(layer[name], undefined, [bad, c]),
            ).toThrow();
        for (const name of ["ordi", "removi"] as const)
          for (const bad of [2 ** 31, -(2 ** 31) - 1, 1.5, NaN, "1"])
            expect(() =>
              Reflect.apply(layer[name], undefined, [bad, i]),
            ).toThrow();
        for (const name of ["ordd", "removd"] as const)
          for (const bad of [NaN, "0", null])
            expect(() =>
              Reflect.apply(layer[name], undefined, [bad, d]),
            ).toThrow();
        for (const bad of ["\0", "\udfff", 4])
          expect(() =>
            Reflect.apply(layer.set, undefined, [i, bad, i]),
          ).toThrow();
      }
      n.appndc("B\t", c);
      n.appndd(Infinity, d);
      n.appndi(2147483647, i);
      expect(n.ordc("B", c)).toBe(-1);
      expect(n.ordc("B\t", c)).toBe(0);
      n.removc("B\t", c);
      n.removd(Infinity, d);
      n.removi(2147483647, i);
      expect([n.card(c), n.card(d), n.card(i)]).toEqual([0, 0, 0]);
    } finally {
      for (const cell of [c, d, i]) n.freeCell(cell);
    }
  });
});
