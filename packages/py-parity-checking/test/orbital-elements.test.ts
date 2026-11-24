import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

function near(
  actual: readonly number[],
  expected: readonly number[],
  tolerance = 2e-12,
): void {
  expect(actual.length).toBe(expected.length);
  actual.forEach((x, i) =>
    expect(Math.abs(x - expected[i]!)).toBeLessThanOrEqual(tolerance),
  );
}

const zeroRate = `
import json, math, spiceypy as sp
out = []
for peri, mean, node in [(0.,0.,0.), (.012,0.,-.023), (.012,.15,-.023)]:
    state = sp.eqncpv(5.375,5.25,[8.,.2,-.35,.28,-.18,.14,peri,mean,node],.37,-.42)
    assert not sp.failed()
    out.append(["NaN" if math.isnan(x) else x for x in state])
print(json.dumps(out,allow_nan=False))
`;

for (const backend of ["wasm", "node"] as const) {
  const test = it.runIf(backend === "wasm" || nodeBackendAvailable);
  test(`${backend}: preserves circular two-body energy and angular momentum, with distinct element conventions for unbound orbits`, async () => {
    const { spice, dispose } = await spiceClients.toSync({ backend });
    try {
      const { raw } = spice,
        initial = [1, 0, 0, 0, 1, 0] as const;
      const quarter = raw.prop2b(1, initial, Math.PI / 2);
      near(quarter, [0, 1, 0, -1, 0, 0]);
      near(raw.prop2b(1, quarter, -Math.PI / 2), initial);
      const [x, y, z, vx, vy, vz] = quarter;
      expect(
        (vx * vx + vy * vy + vz * vz) / 2 - 1 / Math.hypot(x, y, z),
      ).toBeCloseTo(-0.5, 13);
      near([y * vz - z * vy, z * vx - x * vz, x * vy - y * vx], [0, 0, 1]);
      for (const [state, elliptic] of [
        [initial, true],
        [[2, 0, 0, 0, 1, 0], false],
        [[2, 0, 0, 0, 1.25, 0], false],
        [[1.5, -0.25, 0.375, 0.125, 0.625, 0.25], true],
      ] as const) {
        const classical = raw.oscelt(state, 12.25, 1),
          extended = raw.oscltx(state, 12.25, 1);
        expect(extended).toHaveLength(11);
        near(extended.slice(0, 8), classical);
        near(raw.conics(classical, 12.25), state);
        near(raw.conics(classical, 12.625), raw.prop2b(1, state, 0.375));
        if (elliptic)
          expect(extended[10]).toBeCloseTo(
            2 * Math.PI * extended[9] ** 1.5,
            10,
          );
        else expect(extended[10]).toBe(0);
      }
      expect(raw.oscltx([2, 0, 0, 0, 1, 0], 0, 1).slice(9)).toEqual([0, 0]);
      expect(raw.oscltx([2, 0, 0, 0, 1.25, 0], 0, 1)[9]).toBeLessThan(0);
      expect(() => raw.oscltx(initial, 0, 0)).toThrow(/NONPOSITIVEMASS/);
      expect(raw.failed()).toBe(false);
      near(raw.oscelt(initial, 12.25, 1), [1, 0, 0, 0, 0, 0, 12.25, 1]);
    } finally {
      await dispose();
    }
  });
  test(`${backend}: compares all equinoctial components when the mean longitude rate is zero`, async () => {
    const sidecar = fileURLToPath(
      new URL("../sidecars/spiceypy/", import.meta.url),
    );
    const expected: unknown = JSON.parse(
      execFileSync(
        "uv",
        ["run", "--locked", "--project", sidecar, "python", "-c", zeroRate],
        { encoding: "utf8", timeout: 30_000 },
      ),
    );
    if (!Array.isArray(expected) || expected.length !== 3)
      throw new Error("Missing independent states");
    const { spice, dispose } = await spiceClients.toSync({ backend });
    try {
      const rates = [
        [0, 0, 0],
        [0.012, 0, -0.023],
        [0.012, 0.15, -0.023],
      ] as const;
      for (const [i, [peri, mean, node]] of rates.entries()) {
        const actual = spice.raw.eqncpv(
          5.375,
          5.25,
          [8, 0.2, -0.35, 0.28, -0.18, 0.14, peri, mean, node],
          0.37,
          -0.42,
        );
        const row: unknown = expected[i];
        if (!Array.isArray(row) || row.length !== 6)
          throw new Error("Invalid locked state");
        for (const [j, x] of actual.entries()) {
          const ref: unknown = row[j];
          if (i < 2 && j >= 3) {
            expect(ref).toBe("NaN");
            expect(Number.isNaN(x)).toBe(true);
          } else {
            if (typeof ref !== "number")
              throw new Error("Missing finite component");
            near([x], [ref]);
          }
        }
      }
      expect(spice.raw.failed()).toBe(false);
      near(
        spice.raw.eqncpv(
          0,
          0,
          [4, 0, 0, 0, 0, 0, 0, 0.25, 0],
          -Math.PI / 2,
          Math.PI / 2,
        ),
        [4, 0, 0, 0, 1, 0],
      );
    } finally {
      await dispose();
    }
  });
}
