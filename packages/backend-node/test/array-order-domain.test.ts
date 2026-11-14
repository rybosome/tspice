import { describe, expect, it, vi } from "vitest";
import { createCoordsVectorsApi } from "../src/domains/coords-vectors.js";
import { getNativeAddon, type NativeAddon } from "../src/runtime/addon.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";
const methods = [
  "isordv",
  "orderc",
  "orderd",
  "orderi",
  "reordc",
  "reordd",
  "reordi",
  "reordl",
  "shellc",
  "shelld",
  "shelli",
] as const;
const once = <T>(data: readonly T[]) => {
  const reads = new Set<string>();
  return new Proxy([...data], {
    get(target, key, receiver) {
      if (typeof key === "string" && (key === "length" || /^\d+$/.test(key))) {
        if (reads.has(key)) throw new Error("Repeated caller read");
        reads.add(key);
      }
      return Reflect.get(target, key, receiver);
    },
  });
};
for (const name of methods) {
  const values = name.endsWith("c")
    ? ["a ", "b\t"]
    : name.endsWith("l")
      ? [false, true]
      : [1, 0];
  const reorder = name.startsWith("reord");
  const nativeValue =
    name === "isordv"
      ? true
      : name.startsWith("order")
        ? Int32Array.of(1, 0)
        : name.endsWith("c")
          ? new Uint8Array([98, 9, 0, 97, 32, 0])
          : name.endsWith("d")
            ? Float64Array.of(0, 1)
            : Int32Array.of(0, 1);
  it(`${name} dispatches owned, single-read input buffers and returns an owned result`, () => {
    const mock = vi.fn(() => nativeValue);
    const api = createCoordsVectorsApi({
      [name]: mock,
    } as Partial<NativeAddon> as NativeAddon);
    const args = reorder
      ? [once([1, 0]), once<unknown>(values)]
      : [once<unknown>(values)];
    const result: unknown = Reflect.apply(api[name], api, args);
    expect(mock).toHaveBeenCalledOnce();
    const passed: readonly unknown[] = mock.mock.calls[0]!;
    expect(passed.at(-1)).toBeInstanceOf(
      name.endsWith("c")
        ? Uint8Array
        : name.endsWith("d")
          ? Float64Array
          : Int32Array,
    );
    if (reorder) expect(passed[0]).toEqual(Int32Array.of(1, 0));
    if (name.endsWith("c")) {
      expect(passed.at(-2)).toBe(3);
      expect(passed.at(-1)).toEqual(Uint8Array.of(97, 32, 0, 98, 9, 0));
    }
    if (typeof result === "boolean") expect(result).toBe(true);
    else {
      expect(Array.isArray(result)).toBe(true);
      expect(Object.is(result, nativeValue)).toBe(false);
    }
  });
  it(`${name} validates all input elements before dispatch and checks native result representation`, () => {
    const mock = vi.fn(() => null);
    const api = createCoordsVectorsApi({
      [name]: mock,
    } as Partial<NativeAddon> as NativeAddon);
    const invoke = (v: unknown, p: unknown = [1, 0]) =>
      Reflect.apply(api[name], api, reorder ? [p, v] : [v]);
    const bad = name.endsWith("c")
      ? ["x\0", "\ud800", 1]
      : name.endsWith("l")
        ? [1, 0, "false"]
        : name.endsWith("d")
          ? ["1", null, {}]
          : [1.25, 2 ** 31, NaN];
    for (const x of bad) expect(() => invoke([values[0], x])).toThrow();
    if (reorder)
      for (const p of [[0, 0], [1, 2], [-1, 0], [0.5, 0], []])
        expect(() => invoke(values, p)).toThrow();
    expect(mock).not.toHaveBeenCalled();
    expect(() => invoke(values)).toThrow();
    expect(mock).toHaveBeenCalledOnce();
  });
}

describe.skipIf(!nodeAddonAvailable())("direct compiled order adapters", () => {
  it("validates packed character buffers before CSPICE and preserves caller storage through copies", () => {
    const native = getNativeAddon(),
      bytes = Uint8Array.of(98, 32, 0, 97, 9, 0),
      p = Int32Array.of(1, 0);
    for (const invoke of [
      (w: number, buf: Uint8Array) => native.orderc(w, buf),
      (w: number, buf: Uint8Array) => native.reordc(p, w, buf),
      (w: number, buf: Uint8Array) => native.shellc(w, buf),
    ]) {
      expect(() => invoke(1, bytes)).toThrow();
      expect(() => invoke(4, bytes)).toThrow();
      expect(() => invoke(3, Uint8Array.of(98, 32, 1, 97, 9, 0))).toThrow();
    }
    expect(native.reordc(p, 3, bytes)).toEqual(
      Uint8Array.of(97, 9, 0, 98, 32, 0),
    );
    expect(bytes).toEqual(Uint8Array.of(98, 32, 0, 97, 9, 0));
  });
  it("rejects malformed permutations at the shared C boundary and restores ordinary calls", () => {
    const native = getNativeAddon(),
      d = Float64Array.of(-0, NaN),
      i = Int32Array.of(0, 1),
      c = Uint8Array.of(65, 0, 66, 0);
    for (const ord of [
      Int32Array.of(0, 0),
      Int32Array.of(0, 2147483647),
      Int32Array.of(1),
    ]) {
      for (const invoke of [
        () => native.reordd(ord, d),
        () => native.reordi(ord, i),
        () => native.reordl(ord, i),
        () => native.reordc(ord, 2, c),
      ])
        expect(invoke).toThrow();
    }
    const perm = Int32Array.of(1, 0);
    expect(native.reordd(perm, d)).toEqual(Float64Array.of(NaN, -0));
    expect(native.reordl(perm, i)).toEqual(Int32Array.of(1, 0));
    const candidate = Int32Array.of(2147483647);
    expect(native.isordv(candidate)).toBe(false);
    expect(candidate[0]).toBe(2147483647);
  });
});
