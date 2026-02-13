import { describe, expect, it } from "vitest";

import { Mat3 } from "../src/kit/math/mat3.js";
import { decodeRpcValue, encodeRpcValue } from "../src/transport/rpc/valueCodec.js";

describe("rpc valueCodec", () => {
  it("round-trips Mat3 via tagged encoding", () => {
    const m = Mat3.identity();
    const encoded = encodeRpcValue(m);

    expect(encoded).toEqual({
      __tspiceRpcTag: "Mat3",
      layout: "rowMajor",
      data: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    });

    const decoded = decodeRpcValue(encoded);
    expect(decoded).toBeInstanceOf(Mat3);
    expect((decoded as Mat3).rowMajor).toEqual(m.rowMajor);
  });

  it("passes TypedArrays through unchanged", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    expect(encodeRpcValue(bytes)).toBe(bytes);
    expect(decodeRpcValue(bytes)).toBe(bytes);
  });

  it("throws on non-plain objects (e.g. Date)", () => {
    expect(() => encodeRpcValue(new Date())).toThrow(/unsupported non-plain object/i);
  });

  it("recursively encodes/decodes arrays and plain objects", () => {
    const value = {
      a: [1, 2, Mat3.identity()],
      b: { ok: true },
    };

    const encoded = encodeRpcValue(value);
    const decoded = decodeRpcValue(encoded);

    expect(decoded).toMatchObject({
      a: [1, 2, expect.any(Mat3)],
      b: { ok: true },
    });
  });
});
