import { describe, expect, it } from "vitest";
import {
  assertMat3ArrayLike9,
  brandMat3ColMajor,
  brandMat3RowMajor,
  brandMat3RowMajorResult,
  isBrandedMat3RowMajor,
  isMat3ArrayLike9,
} from "../src/spice-runtime/shared/mat3.js";

describe("row-major backend matrix results", () => {
  it("preserves nonfinite numeric components and signed zero in an owned branded copy", () => {
    const input = [NaN, Infinity, -Infinity, -0, 4, 5, 6, 7, 8];
    const result = brandMat3RowMajorResult(input, { freeze: "never" });
    expect(isBrandedMat3RowMajor(result)).toBe(true);
    expect(result).toEqual(input);
    expect(Object.is(result[3], -0)).toBe(true);
    input.fill(99);
    expect(result).toEqual([NaN, Infinity, -Infinity, -0, 4, 5, 6, 7, 8]);
  });

  it("copies numeric TypedArray results without retaining their storage", () => {
    const input = new Float64Array([1, 2, 3, 4, NaN, 6, Infinity, 8, -0]);
    const result = brandMat3RowMajorResult(input);
    input.fill(99);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([1, 2, 3, 4, NaN, 6, Infinity, 8, -0]);
  });

  it("rejects wrong lengths, sparse arrays, BigInt storage and unsupported views", () => {
    for (const value of [
      null,
      undefined,
      {},
      "123456789",
      [],
      new Array(8).fill(0),
      new Array(10).fill(0),
      Object.assign(new Array<number>(9), { 0: 1, 8: 9 }),
      new DataView(new ArrayBuffer(72)),
      new BigInt64Array(9),
      { length: 9, 0: 1, 8: 9 },
    ]) {
      expect(() => brandMat3RowMajorResult(value)).toThrow(TypeError);
    }
  });

  it("checks every component without coercing nonnumbers", () => {
    for (let index = 0; index < 9; index++) {
      for (const invalid of [
        "1",
        1n,
        false,
        null,
        undefined,
        {},
        Symbol("number"),
      ]) {
        const input: unknown[] = new Array(9).fill(1);
        input[index] = invalid;
        expect(() =>
          brandMat3RowMajorResult(input, { label: "test output" }),
        ).toThrow(`test output: component ${index} must be a number`);
      }
    }
  });

  it("honors freezing and allows an unfrozen owned result when requested", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const frozen = brandMat3RowMajorResult(input, { freeze: "always" });
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Reflect.set(frozen, 0, 99)).toBe(false);
    const unfrozen = brandMat3RowMajorResult(input, { freeze: "never" });
    expect(Object.isFrozen(unfrozen)).toBe(false);
    expect(Reflect.set(unfrozen, 0, 99)).toBe(true);
    expect(input[0]).toBe(1);
    expect(frozen[0]).toBe(1);
  });

  it("does not relax the existing finite-only input validation or constructors", () => {
    for (const nonfinite of [NaN, Infinity, -Infinity]) {
      const result = brandMat3RowMajorResult([
        1,
        0,
        0,
        0,
        nonfinite,
        0,
        0,
        0,
        1,
      ]);
      expect(isBrandedMat3RowMajor(result)).toBe(true);
      expect(isMat3ArrayLike9(result)).toBe(false);
      expect(() => assertMat3ArrayLike9(result)).toThrow();
      expect(() => brandMat3RowMajor(result)).toThrow();
      expect(() => brandMat3ColMajor(result)).toThrow();
    }
    expect(() =>
      assertMat3ArrayLike9(
        brandMat3RowMajorResult([1, 0, 0, 0, 1, 0, 0, 0, 1]),
      ),
    ).not.toThrow();
  });
});
