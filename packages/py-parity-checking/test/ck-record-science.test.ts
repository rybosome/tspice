import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

function fixture(name: string) {
  return {
    path: name,
    bytes: fs.readFileSync(
      new URL(`../fixtures/kernels/${name}`, import.meta.url),
    ),
  };
}

for (const backend of ["node", "wasm"] as const) {
  const test = it.runIf(backend === "wasm" || nodeBackendAvailable);
  test(`${backend}: extreme finite CK angular velocity preserves all independently computed state-matrix entries`, async () => {
    const clock = fixture("audit-ck-clock.tsc"),
      limit = fixture("audit-ck-record-limit.bc");
    const program = `import sys,json,math,spiceypy as sp
sp.furnsh(sys.argv[1]);sp.furnsh(sys.argv[2])
matrix,ref=sp.ckfxfm(-123009,0)
print(json.dumps([x if math.isfinite(x) else str(x) for x in matrix.ravel()],allow_nan=False))`;
    const reference: unknown = JSON.parse(
      execFileSync(
        "uv",
        [
          "run",
          "--locked",
          "--project",
          fileURLToPath(new URL("../sidecars/spiceypy", import.meta.url)),
          "python",
          "-c",
          program,
          ...[clock, limit].map((f) =>
            fileURLToPath(
              new URL(`../fixtures/kernels/${f.path}`, import.meta.url),
            ),
          ),
        ],
        { encoding: "utf8" },
      ),
    );
    if (!Array.isArray(reference) || reference.length !== 36)
      throw new Error("Incomplete CKFXFM oracle result");
    const client = await spiceClients.toSync({ backend }),
      raw = client.spice.raw;
    try {
      raw.furnsh(clock);
      raw.furnsh(limit);
      const actual = raw.ckfxfm(-123009, 0);
      if (!actual.found) throw new Error("Missing endpoint");
      expect(actual.ref).toBe(1);
      expect(reference[30]).toBe("-inf");
      for (let k = 0; k < 36; k++) {
        const x = actual.xform[k]!,
          y: unknown = reference[k];
        if (y === "-inf") {
          expect(x).toBe(-Infinity);
          continue;
        }
        if (typeof y !== "number") throw new Error("Unexpected oracle entry");
        // Two products near 1e308 cancel at [5,1]. Toolchain contraction
        // affects the residual, bounded in units of the input scale.
        if (k === 31) expect(Math.abs(x - y) / 1.65e308).toBeLessThan(5e-16);
        else if (y === 0) expect(x).toBe(0);
        else expect(x / y).toBeCloseTo(1, 13);
      }
    } finally {
      raw.kclear();
      await client.dispose();
    }
  });
  test(`${backend}: CK frame matrices use ET, the inverse pointing direction and the physical rotation derivative`, async () => {
    const client = await spiceClients.toSync({ backend });
    const raw = client.spice.raw;
    try {
      raw.furnsh(fixture("audit-pointing.bc"));
      raw.furnsh(fixture("audit-ck-clock.tsc"));
      const inst = -123000,
        et = 5,
        delta = 0.001;
      const rotation = raw.ckfrot(inst, et),
        state = raw.ckfxfm(inst, et),
        plus = raw.ckfrot(inst, et + delta),
        minus = raw.ckfrot(inst, et - delta);
      const pointing = raw.ckgp(inst, 1005, 0, "J2000");
      if (
        !rotation.found ||
        !state.found ||
        !plus.found ||
        !minus.found ||
        !pointing.found
      )
        throw new Error("Missing authored CK sample");
      expect(rotation.ref).toBe(1);
      expect(state.ref).toBe(1);
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) {
          const k = 3 * i + j;
          expect(rotation.rotate[k]).toBeCloseTo(pointing.cmat[3 * j + i]!, 14);
          expect(state.xform[6 * i + j]).toBeCloseTo(rotation.rotate[k]!, 14);
          expect(state.xform[6 * i + j + 3]).toBe(0);
          expect(state.xform[6 * (i + 3) + j + 3]).toBeCloseTo(
            rotation.rotate[k]!,
            14,
          );
          expect(state.xform[6 * (i + 3) + j]).toBeCloseTo(
            (plus.rotate[k]! - minus.rotate[k]!) / (2 * delta),
            9,
          );
        }
      expect(raw.ckfxfm(-123001, et)).toEqual({ found: false });
      expect(raw.ckfrot(-123001, et).found).toBe(true);
      expect(raw.ckfrot(inst, 1005)).toEqual({ found: false });
    } finally {
      raw.kclear();
      await client.dispose();
    }
  });
  test(`${backend}: type 2 and type 3 records retain units, packed descriptor ownership, returned array ownership and cursor position`, async () => {
    const client = await spiceClients.toSync({ backend }),
      raw = client.spice.raw;
    try {
      raw.furnsh(fixture("audit-ck-records.bc"));
      raw.furnsh(fixture("audit-pointing.bc"));
      const t = raw.dafopr("audit-ck-records.bc"),
        h = raw.dafopr("audit-pointing.bc");
      try {
        raw.dafbfs(t);
        expect(raw.daffna(t)).toBe(true);
        const td = raw.dafgs(t);
        const two = raw.ckgr02(t, td, 2);
        expect([two.start, two.stop, two.rate]).toEqual([1010, 1020, 0.75]);
        expect(two.av).toEqual([-0.008, 0.005, 0.004]);
        expect(two.quaternion[0]).toBeCloseTo(Math.cos(0.3), 14);
        for (let i = 1; i <= 3; i++)
          expect(two.quaternion[i]).toBeCloseTo(
            (i * Math.sin(-0.3)) / Math.sqrt(14),
            14,
          );
        raw.dafbfs(h);
        expect(raw.daffna(h)).toBe(true);
        const d = raw.dafgs(h);
        expect(raw.cknr03(h, d)).toBe(4);
        expect(raw.daffna(h)).toBe(true);
        expect(raw.daffna(h)).toBe(true);
        const noAv = raw.dafgs(h);
        const third = raw.ckgr03(h, noAv, 2);
        expect(third.sclkdp).toBe(1040);
        expect(third.av).toBeNull();
        const saved = raw.ckgr03(h, d, 2);
        expect(saved.sclkdp).toBe(1010);
        expect(saved.av).not.toBeNull();
        for (let i = 0; i < 3; i++)
          expect(saved.av![i]).toBeCloseTo(
            (-0.002 * (i + 1)) / Math.sqrt(14),
            14,
          );
        saved.quaternion[0] = 999;
        expect(raw.ckgr03(h, d, 2).quaternion[0]).toBeLessThan(1);
        expect(raw.dafgs(h)).toEqual(noAv);
        expect(() => raw.cknr02(h, td)).toThrow(/does not belong/);
        expect(() => raw.cknr02(h, d)).toThrow(/CKWRONGDATATYPE/);
        expect(() => raw.ckgr03(h, d, 0)).toThrow(/CKNONEXISTREC/);
        expect(raw.failed()).toBe(false);
        expect(raw.cknr02(t, td)).toBe(3);
      } finally {
        raw.dafcls(h);
        raw.dafcls(t);
      }
    } finally {
      raw.kclear();
      await client.dispose();
    }
  });
  test(`${backend}: CK lookup preflights an unrepresentable clock negation and preserves toolkit errors and recovery`, async () => {
    const client = await spiceClients.toSync({ backend }),
      raw = client.spice.raw;
    try {
      raw.furnsh(fixture("audit-ck-clock.tsc"));
      raw.furnsh(fixture("audit-pointing.bc"));
      raw.pipool("CK_-123000_SCLK", [-2147483648]);
      expect(raw.ckmeta(-123000, "SCLK")).toBe(-2147483648);
      expect(() => raw.ckfrot(-123000, 0)).toThrow(/negated/);
      expect(() => raw.ckfxfm(-123000, 0)).toThrow(/negated/);
      raw.pipool("CK_-123000_SCLK", [-123]);
      expect(raw.ckfxfm(-123000, 5).found).toBe(true);
      expect(() => raw.ckmeta(-123000, "OBJECT")).toThrow(/UNKNOWNCKMETA/);
      expect(raw.ckmeta(-123000, "SPK")).toBe(-123);
    } finally {
      raw.kclear();
      await client.dispose();
    }
  });
}
