import { brandMat3RowMajor } from "@rybosome/tspice-core";
import { spiceClients } from "@rybosome/tspice";
import { describe, expect, it } from "vitest";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const identity = brandMat3RowMajor([1, 0, 0, 0, 1, 0, 0, 0, 1]);
const turned = brandMat3RowMajor([0, 1, 0, -1, 0, 0, 0, 0, 1]);
function sameComponents(
  actual: readonly number[],
  expected: readonly number[],
) {
  expect(actual.length).toBe(expected.length);
  for (const [i, value] of expected.entries())
    expect(actual[i]).toBeCloseTo(value, 12);
}

describe("public frame and state transformations", () => {
  for (const backend of ["node", "wasm"] as const) {
    const test = backend === "node" ? it.runIf(nodeBackendAvailable) : it;
    test(`${backend} preserves source-frame velocity, Euler rates and nonunique outputs`, async () => {
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        const raw = spice.raw;
        const rate = 2 ** -43;
        const tiny = raw.rav2xf(identity, [0, 0, rate]);
        expect(tiny[19] / rate).toBe(1);
        expect(tiny[24] / rate).toBe(-1);
        const moving = raw.rav2xf(turned, [0.25, -0.5, 1.5]);
        const { rot, av } = raw.xf2rav(moving);
        sameComponents(rot, turned);
        sameComponents(av, [0.25, -0.5, 1.5]);
        const inverse = raw.invstm(moving);
        for (let i = 0; i < 6; i++)
          for (let j = 0; j < 6; j++) {
            let value = 0;
            for (let k = 0; k < 6; k++)
              value += moving[6 * i + k]! * inverse[6 * k + j]!;
            expect(value).toBeCloseTo(i === j ? 1 : 0, 12);
          }
        const angles = [0.3, -0.5, 0.7, 0.15, -0.23, 0.45] as const;
        const transform = raw.eul2xf(angles, 3, 2, 1);
        const decomposition = raw.xf2eul(transform, 3, 2, 1);
        expect(decomposition.unique).toBe(true);
        sameComponents(decomposition.eulang, angles);
        const singular = raw.xf2eul(raw.rav2xf(identity, [0, 0, 0]), 3, 1, 3);
        expect(singular.unique).toBe(false);
        sameComponents(
          raw.eul2xf(singular.eulang, 3, 1, 3),
          raw.rav2xf(identity, [0, 0, 0]),
        );
      } finally {
        await dispose();
      }
    });
    test(`${backend} preserves defining axes, transposition and owned outputs`, async () => {
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        const raw = spice.raw;
        const input = Object.freeze([2, -3, 6] as const);
        const triad = raw.frame(input);
        sameComponents(triad.x, [2 / 7, -3 / 7, 6 / 7]);
        sameComponents(raw.vcrss(triad.x, triad.y), triad.z);
        triad.x[0] = 99;
        expect(raw.frame(input).x[0]).toBeCloseTo(2 / 7, 12);
        const m = raw.twovec(input, 3, [-3, 5, 2], 1);
        const xf = raw.twovxf([2, -3, 6, 0, 0, 0], 3, [-3, 5, 2, 0, 0, 0], 1);
        for (let i = 0; i < 3; i++)
          for (let j = 0; j < 3; j++) {
            expect(xf[6 * i + j]).toBeCloseTo(m[3 * i + j]!, 12);
            expect(xf[6 * (i + 3) + j]).toBeCloseTo(0, 12);
          }
        xf[1] = -0;
        xf[6] = Number.MIN_VALUE;
        const transposed = raw.xpose6(xf);
        expect(Object.is(transposed[6], -0)).toBe(true);
        expect(transposed[1]).toBe(Number.MIN_VALUE);
        transposed[1] = 99;
        expect(xf[6]).toBe(Number.MIN_VALUE);
        expect(() =>
          raw.twovxf([1, 0, 0, 0, 0, 0], 1, [1, 0, 0, 0, 0, 0], 2),
        ).toThrow(/DEPENDENTVECTORS/);
        expect(raw.failed()).toBe(false);
        sameComponents(raw.frame([0, 0, 0]).x, [1, 0, 0]);
      } finally {
        await dispose();
      }
    });
  }
});
