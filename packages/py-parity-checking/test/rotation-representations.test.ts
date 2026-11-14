import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, it } from "vitest";
import { spiceClients, type SpiceQuaternion } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const project = path.resolve(import.meta.dirname, "../sidecars/spiceypy");
function oracleDiagnostics(): unknown {
  const script = `
import json, spiceypy as sp
from py_parity_sidecar.rotation_oracle import traced_eul2m
from spiceypy.utils.exceptions import SpiceyError
angles=(0.3, -0.4, 0.7)
axes=(2, 3, 1)
assert traced_eul2m(angles, axes) == sp.eul2m(*angles, *axes).tolist()
sp.chkin("ROTATION_TEST")
try:
    try:
        traced_eul2m(angles, (2, 0, 1))
    except SpiceyError as err:
        output=[err.short,err.long,err.traceback]
    else:
        raise AssertionError("Missing toolkit diagnostic")
    assert not sp.failed() and sp.qcktrc(512)=="ROTATION_TEST"
    print(json.dumps(output))
finally:
    sp.chkout("ROTATION_TEST")
`;
  return JSON.parse(
    execFileSync(
      "uv",
      ["run", "--locked", "--project", project, "python", "-c", script],
      { encoding: "utf8", timeout: 15000 },
    ),
  );
}
function nearArray(a: readonly number[], b: readonly number[]) {
  expect(a.length).toBe(b.length);
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 12));
}
for (const backend of ["wasm", "node"] as const) {
  const test = it.runIf(backend === "wasm" || nodeBackendAvailable);
  test(
    backend +
      ": reconstructs the same rotations from Euler, quaternion, and axis representations",
    async () => {
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        const raw = spice.raw;
        for (const axes of [
          [3, 2, 1],
          [3, 1, 3],
          [1, 2, 3],
          [2, 3, 2],
        ] as const) {
          for (const middle of [0.62, 0, Math.PI / 2]) {
            const matrix = raw.eul2m(
              0.37,
              middle,
              -0.83,
              axes[0],
              axes[1],
              axes[2],
            );
            const { angle3, angle2, angle1 } = raw.m2eul(
              matrix,
              axes[0],
              axes[1],
              axes[2],
            );
            nearArray(
              raw.eul2m(angle3, angle2, angle1, axes[0], axes[1], axes[2]),
              matrix,
            );
            const q = raw.m2q(matrix);
            expect(q[0]).toBeGreaterThanOrEqual(0);
            expect(Math.hypot(...q)).toBeCloseTo(1, 12);
            nearArray(raw.q2m(q), matrix);
            const { axis, angle } = raw.raxisa(matrix);
            nearArray(raw.axisar(axis, angle), matrix);
          }
        }
        expect(raw.m2eul(raw.ident(), 3, 1, 3).angle3).toEqual(0);
        const a: SpiceQuaternion = [1, 2, 0, -1],
          b: SpiceQuaternion = [2, -1, 3, 4];
        nearArray(raw.q2m(raw.qxq(a, b)), raw.mxm(raw.q2m(a), raw.q2m(b)));
        expect(raw.qxq(a, b)).not.toEqual(raw.qxq(b, a));
        nearArray(raw.qdq2av([2, 0, 0, 0], [0, 1, 2, 3]), [-2, -4, -6]);
      } finally {
        await dispose();
      }
    },
  );
  test(
    backend +
      ": preserves the toolkit's exact Euler diagnostics, outer caller and recovery",
    async () => {
      const reference = oracleDiagnostics();
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        const raw = spice.raw;
        raw.chkin("ROTATION_TEST");
        try {
          let observed: unknown;
          try {
            raw.eul2m(0.3, -0.4, 0.7, 2, 0, 1);
          } catch (error) {
            if (!(error instanceof Error)) throw error;
            observed = ["spiceShort", "spiceLong", "spiceTrace"].map((k) =>
              Reflect.get(error, k),
            );
          }
          expect(observed).toEqual(reference);
          expect(raw.failed()).toBe(false);
          nearArray(raw.eul2m(0, 0, 0, 2, 3, 1), raw.ident());
        } finally {
          raw.chkout("ROTATION_TEST");
        }
      } finally {
        await dispose();
      }
    },
  );
}
