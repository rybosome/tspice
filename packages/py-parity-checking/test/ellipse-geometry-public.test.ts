import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

function near(
  actual: readonly number[],
  expected: readonly number[],
  tolerance = 1e-12,
) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((v, i) =>
    expect(Math.abs(v - expected[i]!)).toBeLessThanOrEqual(tolerance),
  );
}

for (const backend of ["wasm", "node"] as const) {
  const test = it.runIf(backend === "wasm" || nodeBackendAvailable);
  test(`${backend}: observes every defined intersection field for points, segments and proper ellipses`, async () => {
    const { spice, dispose } = await spiceClients.toSync({ backend });
    try {
      const { raw } = spice,
        ellipse = raw.cgv2el([0, 0, 0], [3, 0, 0], [0, 2, 0]);
      const cut = raw.inelpl(ellipse, [1, 0, 0, 1]);
      if (cut.nxpts !== 2) throw new Error("Expected two intersection points");
      for (const p of [cut.xpt1, cut.xpt2]) {
        expect(p[0]).toBeCloseTo(1, 13);
        expect(p[2]).toBe(0);
        expect((p[0] / 3) ** 2 + (p[1] / 2) ** 2).toBeCloseTo(1, 13);
      }
      expect(cut.xpt1[1] * cut.xpt2[1]).toBeLessThan(0);
      const tangent = raw.inelpl(ellipse, [1, 0, 0, 3]);
      if (tangent.nxpts !== 1) throw new Error("Expected one tangent point");
      near(tangent.xpt1, [3, 0, 0]);
      near(tangent.xpt2, [3, 0, 0]);
      expect(raw.inelpl(ellipse, [1, 0, 0, 4])).toEqual({ nxpts: 0 });
      expect(raw.inelpl(ellipse, [0, 0, 1, 0])).toEqual({ nxpts: -1 });
      const point = raw.inedpl(3, 2, 1, [0, 0, 1, 1]);
      if (!point.found) throw new Error("Expected a tangent section");
      near(point.ellipse.center, [0, 0, 1]);
      near(point.ellipse.semiMajor, [0, 0, 0]);
      near(point.ellipse.semiMinor, [0, 0, 0]);
      expect(raw.inedpl(3, 2, 1, [0, 0, 1, 2])).toEqual({ found: false });
      const crossing = raw.inelpl(point.ellipse, [0, 0, 1, 1]);
      if (crossing.nxpts !== 1) throw new Error("Expected point ellipse");
      near(crossing.xpt1, point.ellipse.center);
      near(crossing.xpt2, point.ellipse.center);
      const edge = raw.pjelpl(ellipse, [0, 1, 0, 0]);
      near(edge.semiMinor, [0, 0, 0]);
      expect(() => raw.npelpt([1, 2, 3], edge)).toThrow(/DEGENERATECASE/);
      expect(raw.failed()).toBe(false);
      const nearest = raw.npelpt([3, 0, 4], ellipse);
      near(nearest.pnear, [3, 0, 0]);
      expect(nearest.dist).toBeCloseTo(4, 13);
    } finally {
      await dispose();
    }
  });
  test(`${backend}: stored and generating axes have distinct roles and very small geometry remains observable`, async () => {
    const { spice, dispose } = await spiceClients.toSync({ backend });
    try {
      const { raw } = spice,
        center = [2, -1, 3] as const,
        a = [4, 1, 2] as const,
        b = [-1, 3, 2] as const;
      const ellipse = raw.cgv2el(center, a, b),
        fields = raw.el2cgv(ellipse),
        axes = raw.saelgv(a, b);
      near(fields.center, center);
      near(fields.smajor, axes.smajor);
      near(fields.sminor, axes.sminor);
      const dot = (x: readonly number[], y: readonly number[]) =>
        x.reduce((sum, v, i) => sum + v * y[i]!, 0);
      expect(dot(ellipse.semiMajor, ellipse.semiMinor)).toBeCloseTo(0, 12);
      expect(
        dot(axes.smajor, axes.smajor) + dot(axes.sminor, axes.sminor),
      ).toBeCloseTo(dot(a, a) + dot(b, b), 12);
      // Compare normalized components: the ordinary absolute tolerance
      // alone would accept a zero vector at these small coordinate scales.
      const scale = 2 ** -400;
      const small = raw.saelgv(
        [4 * scale, scale, 2 * scale],
        [-scale, 3 * scale, 2 * scale],
      );
      near(
        small.smajor.map((x) => x / scale),
        axes.smajor,
      );
      near(
        small.sminor.map((x) => x / scale),
        axes.sminor,
      );
      fields.center[0] = -80;
      expect(ellipse.center[0]).toBe(2);
      fields.smajor[1] = 45;
      near(raw.el2cgv(ellipse).smajor, axes.smajor);
    } finally {
      await dispose();
    }
  });
}
