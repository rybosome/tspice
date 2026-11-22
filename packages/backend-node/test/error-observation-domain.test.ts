import { expect, it } from "vitest";
import { getNativeAddon } from "../src/runtime/addon.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

it.runIf(nodeAddonAvailable())(
  "checks the native error-domain arguments before dispatch",
  () => {
    const addon = getNativeAddon();
    addon.reset();
    try {
      addon.setmsg("original @");
      for (const invalid of [null, {}, "ab\0cd", "\udfff"]) {
        expect(() => addon.errch(invalid as never, "x")).toThrow();
        expect(() => addon.errch("@", invalid as never)).toThrow();
        expect(() => addon.errdp(invalid as never, 1)).toThrow();
        expect(() => addon.errint(invalid as never, 1)).toThrow();
      }
      for (const invalid of [-2147483649, 2147483648, 1.5, NaN]) {
        expect(() => addon.errint("@", invalid)).toThrow();
        expect(() => addon.qcktrc(invalid)).toThrow();
        expect(() => addon.trcnam(invalid, 33)).toThrow();
        expect(() => addon.trcnam(0, invalid)).toThrow();
      }
      expect(() => addon.errdp("@", Infinity)).toThrow();
      expect(addon.getmsg("LONG")).toBe("original @");
      addon.errint("@", -2147483648);
      expect(addon.getmsg("LONG")).toBe("original -2147483648");
      expect(addon.return()).toBe(false);
    } finally {
      addon.reset();
    }
  },
);
