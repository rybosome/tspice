import { describe, expect, it, vi } from "vitest";
import { createFramesApi } from "../src/domains/frames.js";
import { getNativeAddon, type NativeAddon } from "../src/runtime/addon.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

const methods = [
  "bltfrm",
  "pxfrm2",
  "tipbod",
  "tisbod",
  "tkfram",
  "xfmsta",
] as const;
const good = {
  bltfrm: [1, 1],
  pxfrm2: ["J2000", "J2000", 0, 1],
  tipbod: ["J2000", 399, 0],
  tisbod: ["J2000", 399, 0],
  tkfram: [1],
  xfmsta: [[1, 2, 3, 4, 5, 6], "RECTANGULAR", "RECTANGULAR", " "],
};
const stager = { resolvePathForSpice: (path: string) => path };

describe.each(methods)("%s native frame boundary", (method) => {
  it.runIf(nodeAddonAvailable)(
    "enforces arity, scalar types and state dimensions",
    () => {
      const native = getNativeAddon(),
        valid = good[method];
      expect(() => Reflect.apply(native[method], native, [])).toThrow();
      for (const [i, v] of valid.entries()) {
        const invalid =
          typeof v === "string"
            ? [v + "\0x", 42]
            : typeof v === "number"
              ? [NaN, "1"]
              : [[1, 2], Array(6), [1, 2, 3, 4, 5, Infinity]];
        for (const x of invalid) {
          const args: unknown[] = [...valid];
          args[i] = x;
          expect(() => Reflect.apply(native[method], native, args)).toThrow();
        }
      }
    },
  );
});
it("preserves fixed state snapshots and result ownership", () => {
  const reads = new Set<string>(),
    raw = [1, 2, 3, 4, 5, 6],
    result = [-1, 2, Infinity, 4, 5, NaN];
  const call = vi.fn(() => result);
  const api = createFramesApi(
    { xfmsta: call } as Partial<NativeAddon> as NativeAddon,
    stager,
    new Set(),
  );
  const state = new Proxy(raw, {
    get(t, k, v) {
      if (typeof k === "string" && (k === "length" || /^\d+$/.test(k))) {
        expect(reads.has(k)).toBe(false);
        reads.add(k);
      }
      return Reflect.get(t, k, v);
    },
  });
  const actual = Reflect.apply(api.xfmsta, undefined, [
    state,
    "RECTANGULAR",
    "RECTANGULAR",
    " ",
  ]);
  expect(call.mock.calls).toEqual([[raw, "RECTANGULAR", "RECTANGULAR", " "]]);
  expect(actual).toEqual(result);
  expect(actual).not.toBe(result);
});
it("ignores undefined TK payloads on a false flag and rejects malformed found matrices", () => {
  const api = createFramesApi(
    {
      tkfram: () => ({
        found: false,
        get rot(): number[] {
          throw Error("undefined output");
        },
      }),
    } as Partial<NativeAddon> as NativeAddon,
    stager,
    new Set(),
  );
  expect(api.tkfram(123)).toEqual({ found: false });
  for (const rot of [[1, 2], Array(9), Array(9).fill("0")]) {
    const invalid = createFramesApi(
      {
        tkfram: () => ({ found: true, rot, frame: 1 }),
      } as Partial<NativeAddon> as NativeAddon,
      stager,
      new Set(),
    );
    expect(() => invalid.tkfram(1)).toThrow();
  }
});
