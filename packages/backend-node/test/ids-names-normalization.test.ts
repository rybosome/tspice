import { describe, expect, it, vi } from "vitest";

import type { NativeAddon } from "../src/runtime/addon.js";
import { createIdsNamesApi } from "../src/domains/ids-names.js";

describe("node backend ids/names item normalization", () => {
  it("normalizes bodfnd/bodvar items with trim + uppercase", () => {
    const bodfnd = vi.fn().mockReturnValue(true);
    const bodvar = vi.fn().mockReturnValue([1, 2, 3]);

    const native = { bodfnd, bodvar } as unknown as NativeAddon;
    const api = createIdsNamesApi(native);

    expect(api.bodfnd(399, "  radii  ")).toBe(true);
    expect(bodfnd).toHaveBeenCalledWith(399, "RADII");

    expect(api.bodvar(399, "  radii  ")).toEqual([1, 2, 3]);
    expect(bodvar).toHaveBeenCalledWith(399, "RADII");
  });
});
