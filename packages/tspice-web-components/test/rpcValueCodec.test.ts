import { Mat3 } from "@rybosome/tspice";
import { describe, expect, it } from "vitest";

import { decodeRpcValue, encodeRpcValue } from "../src/worker/rpcValueCodec.js";

describe("rpcValueCodec", () => {
  it("encodes Mat3 as a tagged, structured-clone-safe object", () => {
    const m = Mat3.fromRowMajor([1, 2, 3, 4, 5, 6, 7, 8, 9] as any);

    const encoded = encodeRpcValue(m);
    expect(encoded).toEqual({
      __tspiceRpcTag: "Mat3",
      layout: "rowMajor",
      data: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    });

    // Ensure we didn't accidentally keep a Mat3 instance / prototype.
    expect(encoded).not.toBeInstanceOf(Mat3);
    expect(Object.getPrototypeOf(encoded)).toBe(Object.prototype);
  });

  it("round-trips nested structures", () => {
    const value = {
      a: 1,
      m: Mat3.identity(),
      nested: ["x", Mat3.fromRowMajor([9, 8, 7, 6, 5, 4, 3, 2, 1] as any)],
    };

    const encoded = encodeRpcValue(value);
    const decoded = decodeRpcValue(encoded) as any;

    expect(decoded.a).toBe(1);
    expect(decoded.m).toBeInstanceOf(Mat3);
    expect(Array.from(decoded.m.rowMajor)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);

    expect(decoded.nested[0]).toBe("x");
    expect(decoded.nested[1]).toBeInstanceOf(Mat3);
    expect(Array.from(decoded.nested[1].rowMajor)).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1]);
  });

  it("preserves non-plain objects (e.g. TypedArrays)", () => {
    const bytes = new Uint8Array([1, 2, 3]);

    const encoded = encodeRpcValue(bytes);
    const decoded = decodeRpcValue(encoded);

    expect(encoded).toBe(bytes);
    expect(decoded).toBe(bytes);
    expect(decoded).toBeInstanceOf(Uint8Array);
    expect(Array.from(decoded as Uint8Array)).toEqual([1, 2, 3]);
  });

});
