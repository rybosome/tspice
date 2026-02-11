import { describe, expect, it, vi } from "vitest";

import type { NativeAddon } from "../src/runtime/addon.js";
import { createIdsNamesApi } from "../src/domains/ids-names.js";

describe("node backend ids/names item normalization", () => {
  it("passes bodfnd/bodvar items through (native addon normalizes)", () => {
    const bodfnd = vi.fn().mockReturnValue(true);
    const bodvar = vi.fn().mockReturnValue([1, 2, 3]);

    const native = { bodfnd, bodvar } as unknown as NativeAddon;
    const api = createIdsNamesApi(native);

    expect(api.bodfnd(399, "  radii  ")).toBe(true);
    expect(bodfnd).toHaveBeenNthCalledWith(1, 399, "  radii  ");

    expect(api.bodvar(399, "  radii  ")).toEqual([1, 2, 3]);
    expect(bodvar).toHaveBeenNthCalledWith(1, 399, "  radii  ");

    expect(api.bodfnd(399, "  ß  ")).toBe(true);
    expect(bodfnd).toHaveBeenNthCalledWith(2, 399, "  ß  ");

    expect(api.bodvar(399, "  ß  ")).toEqual([1, 2, 3]);
    expect(bodvar).toHaveBeenNthCalledWith(2, 399, "  ß  ");
  });
});
