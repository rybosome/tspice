import { describe, expect, it } from "vitest";

import { spiceShortSymbol } from "../src/errors/spiceShort.js";

describe("spiceShortSymbol", () => {
  it("extracts a symbol from SPICE(...) tokens", () => {
    expect(spiceShortSymbol("SPICE(FOO)")).toBe("FOO");
    expect(spiceShortSymbol("SPICE ( foo_bar1 )")).toBe("FOO_BAR1");
    expect(spiceShortSymbol("... SPICE(FOO) ...")).toBe("FOO");
  });

  it("accepts bare symbols", () => {
    expect(spiceShortSymbol("spkinsuffdata")).toBe("SPKINSUFFDATA");
  });

  it("returns null when no symbol can be extracted", () => {
    expect(spiceShortSymbol("something went wrong")).toBeNull();
    expect(spiceShortSymbol("")).toBeNull();
  });
});
