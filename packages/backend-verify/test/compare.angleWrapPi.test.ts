import { describe, expect, it } from "vitest";

import { compareValues } from "../src/compare/compare.js";

describe("compareValues angleWrapPi", () => {
  it("treats pi and -pi as equal when enabled", () => {
    const res = compareValues(Math.PI, -Math.PI, { angleWrapPi: true });
    expect(res).toEqual({ ok: true });
  });

  it("does not treat pi and -pi as equal by default", () => {
    const res = compareValues(Math.PI, -Math.PI);
    expect(res.ok).toBe(false);
  });
});
