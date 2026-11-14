import { expect, it } from "vitest";
import { getNativeAddon } from "../src/runtime/addon.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

it.runIf(nodeAddonAvailable())(
  "validates signal and progress arguments before changing native state",
  () => {
    const n = getNativeAddon();
    n.gfclrh();
    expect(() => Reflect.apply(n.gfinth, n, [2, "yes"])).toThrow();
    expect(() => n.gfinth(Infinity, true)).toThrow();
    expect(() => n.gfinth(2.25, true)).toThrow();
    expect(() => Reflect.apply(n.gfbail, n, [0])).toThrow();
    expect(() => Reflect.apply(n.gfclrh, n, [1])).toThrow();
    expect(() => Reflect.apply(n.gfrepu, n, [1, 2, "3"])).toThrow();
    expect(() => n.gfrepu(Infinity, 2, 1)).toThrow(/finite/);
    expect(() => n.gfinth(0, true)).toThrow(/INVALIDSIGNAL/);
    expect(n.gfbail()).toBe(false);
  },
);
