import { expect, it } from "vitest";
import { getNativeAddon } from "../src/runtime/addon.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

for (const name of ["errdev", "errprt"] as const) {
  it.runIf(nodeAddonAvailable())(
    name + " validates its native buffers and keeps the initial policy",
    () => {
      const addon = getNativeAddon();
      const read = addon[name];
      const before = read("GET", "", 256);
      for (const bad of [null, "\0", "\udc00", {}]) {
        expect(() => read(bad as never, "", 8)).toThrow();
        expect(() => read("SET", bad as never, 8)).toThrow();
      }
      for (const bad of [NaN, 0.25, 2147483648, -2147483649]) {
        expect(() => read("GET", "", bad)).toThrow();
      }
      expect(() => read("unsupported", "", 8)).toThrow(/INVALIDOPERATION/);
      expect(() => read("GET", "", -2147483648)).toThrow(/STRINGTOOSHORT/);
      expect(read("GeT", "", 2147483647)).toBe(before);
      expect(addon.failed()).toBe(false);
    },
  );
}

it.runIf(nodeAddonAvailable())(
  "trcoff rejects extra native arguments before changing the process",
  () => {
    const native = getNativeAddon();
    expect(() => Reflect.apply(native.trcoff, null, [0])).toThrow();
    native.chkin("STILLENABLED");
    try {
      expect(native.qcktrc(80)).toBe("STILLENABLED");
    } finally {
      native.chkout("STILLENABLED");
    }
  },
);
