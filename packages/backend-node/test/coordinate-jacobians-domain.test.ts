import { expect, it } from "vitest";
import { createNodeBackend } from "@rybosome/tspice-backend-node";
import { isBrandedMat3RowMajor } from "@rybosome/tspice-core";
import { getNativeAddon } from "../src/runtime/addon.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";
const test = it.runIf(nodeAddonAvailable);
const calls = [
  ["dazldr", [3, 4, -2, true, false]],
  ["dcyldr", [3, 4, -2]],
  ["dgeodr", [3, 4, -2, 3, 0.125]],
  ["dlatdr", [3, 4, -2]],
  ["dpgrdr", ["Earth", 3, 4, -2, 3, 0.125]],
  ["drdazl", [5, 0.7, -0.4, true, false]],
  ["drdcyl", [5, 0.7, -2]],
  ["drdgeo", [0.7, -0.4, 2, 3, 0.125]],
  ["drdlat", [5, 0.7, -0.4]],
  ["drdpgr", ["Earth", 0.7, -0.4, 2, 3, 0.125]],
  ["drdsph", [5, 1.1, 0.7]],
  ["dsphdr", [3, 4, -2]],
] as const;
for (const [name, args] of calls) {
  test(`${name} validates every scalar at the JS and direct addon boundaries and returns owned matrix storage`, () => {
    const api = createNodeBackend().raw;
    const addon = getNativeAddon();
    const a: unknown = Reflect.apply(api[name], api, [...args]);
    const b: unknown = Reflect.apply(api[name], api, [...args]);
    expect(isBrandedMat3RowMajor(a)).toBe(true);
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
    expect(a).toHaveLength(9);
    for (let index = 0; index < args.length; index++) {
      const bad: unknown[] = [...args];
      const value = args[index];
      for (const invalid of typeof value === "string"
        ? [null, "EARTH\0MOON"]
        : typeof value === "boolean"
          ? [1, null]
          : [NaN, Infinity, "1"]) {
        bad[index] = invalid;
        expect(() => Reflect.apply(api[name], api, bad)).toThrow();
        expect(() => Reflect.apply(addon[name], addon, bad)).toThrow();
      }
    }
    expect(() => Reflect.apply(addon[name], addon, [])).toThrow();
  });
}
