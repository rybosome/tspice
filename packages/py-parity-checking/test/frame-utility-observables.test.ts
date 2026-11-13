import fs from "node:fs";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
const bytes = fs.readFileSync(
  new URL("../fixtures/kernels/audit-frames.tf", import.meta.url),
);
const fixed = "AUDIT_FIXED_12345678901234";
for (const backend of ["node", "wasm"] as const) {
  const run = it.runIf(backend === "wasm" || nodeBackendAvailable);
  run(`${backend}: literal frame metadata and load/unload states`, async () => {
    const setup = await spiceClients.toSync({ backend });
    const raw = setup.spice.raw;
    try {
      expect(raw.namfrm(fixed)).toEqual({ found: false });
      raw.furnsh({ path: "audit-frames.tf", bytes });
      expect(raw.namfrm(fixed.toLowerCase())).toEqual({
        found: true,
        code: -1800102,
      });
      expect(raw.frmnam(-1800102)).toEqual({ found: true, name: fixed });
      expect(raw.cidfrm(1234567)).toEqual({
        found: true,
        frcode: -1800102,
        frname: fixed,
      });
      expect(raw.cnmfrm("AUDIT_WORLD")).toEqual({
        found: true,
        frcode: -1800102,
        frname: fixed,
      });
      expect(raw.frinfo(-1800102)).toEqual({
        found: true,
        center: 1234567,
        frameClass: 4,
        classId: -1800999,
      });
      expect(raw.ccifrm(4, -1800999)).toEqual({
        found: true,
        frcode: -1800102,
        frname: fixed,
        center: 1234567,
      });
      raw.unload("audit-frames.tf");
      expect(raw.namfrm(fixed)).toEqual({ found: false });
      expect(raw.frinfo(-1800102)).toEqual({ found: false });
      expect(raw.cidfrm(1234567)).toEqual({ found: false });
      expect(raw.namfrm("J2000")).toEqual({ found: true, code: 1 });
    } finally {
      await setup.dispose();
    }
  });
  run(
    `${backend}: full dynamic state blocks agree with position derivatives and inverse transforms`,
    async () => {
      const setup = await spiceClients.toSync({ backend });
      const raw = setup.spice.raw;
      try {
        raw.furnsh({ path: "audit-frames.tf", bytes });
        for (const et of [-12345.5, 0, 6789.25]) {
          const rotation = raw.pxform("AUDIT_SPIN", "J2000", et);
          const state = raw.sxform("AUDIT_SPIN", "J2000", et);
          const inverse = raw.sxform("J2000", "AUDIT_SPIN", et);
          const h = 0.01,
            plus = raw.pxform("AUDIT_SPIN", "J2000", et + h),
            minus = raw.pxform("AUDIT_SPIN", "J2000", et - h);
          expect(rotation).toHaveLength(9);
          expect(state).toHaveLength(36);
          let maxDerivative = 0;
          for (let row = 0; row < 3; row++)
            for (let column = 0; column < 3; column++) {
              const i = row * 3 + column;
              expect(
                Math.abs(state[row * 6 + column]! - rotation[i]!),
              ).toBeLessThan(1e-12);
              expect(
                Math.abs(state[(row + 3) * 6 + column + 3]! - rotation[i]!),
              ).toBeLessThan(1e-12);
              expect(Math.abs(state[row * 6 + column + 3]!)).toBe(0);
              const derivative = (plus[i]! - minus[i]!) / (2 * h);
              // Central-difference truncation/roundoff is separate from live parity's
              // unchanged1e-12 comparator; rates~1e-3 and h=.01 bound this error.
              expect(
                Math.abs(state[(row + 3) * 6 + column]! - derivative),
              ).toBeLessThan(5e-11);
              maxDerivative = Math.max(
                maxDerivative,
                Math.abs(state[(row + 3) * 6 + column]!),
              );
            }
          expect(maxDerivative).toBeGreaterThan(1e-4);
          for (let row = 0; row < 6; row++)
            for (let column = 0; column < 6; column++) {
              let value = 0;
              for (let k = 0; k < 6; k++)
                value += inverse[row * 6 + k]! * state[k * 6 + column]!;
              expect(Math.abs(value - (row === column ? 1 : 0))).toBeLessThan(
                1e-12,
              );
            }
        }
      } finally {
        await setup.dispose();
      }
    },
  );
}
