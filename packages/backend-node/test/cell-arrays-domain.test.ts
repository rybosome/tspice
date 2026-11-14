import { describe, expect, it, vi } from "vitest";
import {
  createCellsWindowsApi,
  createCellsWindowsKitApi,
} from "../src/domains/cells-windows.js";
import { getNativeAddon, type NativeAddon } from "../src/runtime/addon.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

// Each mock supplies only the method invoked by its test.
function mockApi(
  method: keyof NativeAddon,
  call: (...args: never[]) => unknown,
) {
  return createCellsWindowsApi({ [method]: call } as NativeAddon);
}

const specs = [
  ["appndc", " é "],
  ["appndd", Infinity],
  ["appndi", -2147483648],
  ["elemc", ""],
  ["elemd", -Infinity],
  ["elemi", 2147483647],
  ["copy", 2 ** 40 + 2],
] as const;

describe.each(specs)("%s cell adapter", (method, item) => {
  it("forwards full opaque numbers in order and preserves returned membership", () => {
    const predicate = method.startsWith("elem");
    const call = vi.fn(() => (predicate ? false : undefined));
    const api = mockApi(method, call);
    const handle = 2 ** 41 + 1;
    expect(Reflect.apply(api[method], undefined, [item, handle])).toBe(
      predicate ? false : undefined,
    );
    expect(call).toHaveBeenCalledWith(item, handle);
  });

  it("propagates the scientific error object", () => {
    const error = Object.assign(new Error("scientific error"), {
      spiceShort: "SPICE(EXAMPLE)",
    });
    const api = mockApi(method, () => {
      throw error;
    });
    try {
      Reflect.apply(api[method], undefined, [item, 123]);
      throw new Error("Expected the native error");
    } catch (caught) {
      expect(caught).toBe(error);
    }
  });
});

it.each(["elemc", "elemd", "elemi"] as const)(
  "%s rejects malformed native predicate output",
  (method) => {
    const api = mockApi(method, () => 1);
    expect(() =>
      Reflect.apply(api[method], undefined, [method === "elemc" ? "" : 0, 1]),
    ).toThrow(/boolean/);
  },
);

describe.runIf(nodeAddonAvailable())("compiled ordinary cells", () => {
  it("checks scalar representations at the JS and direct N-API entry points", () => {
    const native = getNativeAddon(),
      api = createCellsWindowsApi(native);
    const c = native.newCharCell(2, 8),
      d = native.newDoubleCell(2),
      i = native.newIntCell(2);
    try {
      for (const layer of [api, native]) {
        for (const name of ["appndi", "elemi"] as const)
          for (const bad of [2147483648, -2147483649, 1.5, NaN, "1", null])
            expect(() =>
              Reflect.apply(layer[name], undefined, [bad, i]),
            ).toThrow();
        for (const name of ["appndd", "elemd"] as const)
          for (const bad of [NaN, "1", null])
            expect(() =>
              Reflect.apply(layer[name], undefined, [bad, d]),
            ).toThrow();
        for (const name of ["appndc", "elemc"] as const)
          for (const bad of ["a\0b", "\ud800", "\udc00", 12])
            expect(() =>
              Reflect.apply(layer[name], undefined, [bad, c]),
            ).toThrow();
      }
      expect([native.card(c), native.card(d), native.card(i)]).toEqual([
        0, 0, 0,
      ]);
      native.appndd(-Infinity, d);
      native.appndd(Infinity, d);
      expect(native.elemd(Infinity, d)).toBe(true);
      native.appndi(-2147483648, i);
      native.appndi(2147483647, i);
      expect(native.elemi(-2147483648, i)).toBe(true);
    } finally {
      for (const handle of [c, d, i]) native.freeCell(handle);
    }
  });

  it("separates live ordinary cells, same-type runtime checks, expired tokens and windows", () => {
    const native = getNativeAddon(),
      d = native.newDoubleCell(2),
      i = native.newIntCell(2),
      w = native.newWindow(1);
    const expired = native.newDoubleCell(2);
    native.freeCell(expired);
    try {
      for (const [method, item] of specs) {
        for (const token of [0, -1, 2 ** 32 + d, NaN, 1.5, "2", expired, w])
          expect(() =>
            Reflect.apply(native[method], undefined, [
              method === "copy" ? d : item,
              token,
            ]),
          ).toThrow();
      }
      for (const badSource of [w, expired, 2 ** 32 + i])
        expect(() => native.copy(badSource, i)).toThrow();
      expect(() => native.copy(d, i)).toThrow(/TYPEMISMATCH/);
      expect(() => native.appndd(12, i)).toThrow(/TYPEMISMATCH/);
      expect(() => native.elemi(12, d)).toThrow(/TYPEMISMATCH/);
      expect(native.card(d)).toBe(0);
      expect(native.card(i)).toBe(0);
    } finally {
      native.freeWindow(w);
      native.freeCell(d);
      native.freeCell(i);
    }
  });

  it("preserves the precise character row, full-key comparison and capacity-error precedence", () => {
    const native = getNativeAddon(),
      api = createCellsWindowsApi(native),
      kit = createCellsWindowsKitApi(native);
    const rows = kit.newCharCell(2, 3),
      split = kit.newCharCell(1, 3);
    try {
      api.appndc("A\t", rows);
      expect(kit.cellGetc(rows, 0)).toBe("A");
      expect(api.elemc("A\t", rows)).toBe(true);
      expect(api.elemc("A", rows)).toBe(false);
      api.appndc("A\tx", rows);
      expect(api.card(rows)).toBe(2);
      expect(api.elemc("A\tx", rows)).toBe(false);
      expect(api.elemc("A\t", rows)).toBe(true);
      expect(() => api.appndc("xé", split)).toThrow(/splits a UTF-8/);
      expect(api.card(split)).toBe(0);
      api.appndc("éX", split);
      expect(api.elemc("é", split)).toBe(true);
      expect(() => api.appndc("xé", split)).toThrow(/CELLTOOSMALL/);
    } finally {
      kit.freeCell(rows);
      kit.freeCell(split);
    }
  });

  it("preserves numeric descriptor and control-area observations after an undersized copy", () => {
    const n = getNativeAddon(),
      src = n.newIntCell(3),
      dst = n.newIntCell(2),
      again = n.newIntCell(2);
    try {
      for (const value of [9, 5, 5]) n.appndi(value, src);
      n.appndi(100, dst);
      expect(() => n.copy(src, dst)).toThrow(/CELLTOOSMALL/);
      expect(n.card(dst)).toBe(1);
      expect(n.cellGeti(dst, 0)).toBe(9);
      n.copy(dst, again);
      expect(n.card(again)).toBe(2);
      expect([n.cellGeti(again, 0), n.cellGeti(again, 1)]).toEqual([9, 5]);
      n.scard(0, dst);
      n.appndi(-3, dst);
      n.copy(dst, dst);
      expect(n.elemi(-3, dst)).toBe(true);
      expect(n.card(src)).toBe(3);
    } finally {
      for (const handle of [src, dst, again]) n.freeCell(handle);
    }
  });

  it("does not copy the source set flag and preserves a rejected character copy's destination", () => {
    const n = getNativeAddon(),
      source = n.newCharCell(2, 12),
      dest = n.newCharCell(2, 6);
    try {
      n.appndc("X  ", source);
      n.appndc("y", dest);
      n.appndc("A", dest);
      n.copy(source, dest);
      expect(n.cellGetc(dest, 0)).toBe("X");
      expect(() => n.elemc("X", dest)).toThrow(/NOTASET/);
      n.valid(2, 1, dest);
      expect(n.elemc("X", dest)).toBe(true);
      n.appndc("Zlong!", source);
      expect(() => n.copy(source, dest)).toThrow(/ELEMENTSTOOSHORT/);
      expect(n.card(dest)).toBe(1);
      expect(n.elemc("X", dest)).toBe(true);
      n.copy(source, source);
      expect(n.cellGetc(source, 0)).toBe("X");
    } finally {
      n.freeCell(dest);
      n.freeCell(source);
    }
  });
});
