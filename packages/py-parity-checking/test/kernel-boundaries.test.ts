import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const malformed = path.join(
  packageRoot,
  "fixtures/kernels/audit-partial-error.tpc",
);

describe("kernel boundaries and post-error state", () => {
  for (const backend of ["wasm", "node"] as const) {
    const test = it.runIf(backend === "wasm" || nodeBackendAvailable);
    test(`${backend}: rejects coercing indices/strings and recovers on the same instance`, async () => {
      const setup = await spiceClients.toSync({ backend });
      const s = setup.spice.raw;
      try {
        for (const which of [0.5, NaN, Infinity, 2 ** 32, -(2 ** 32)])
          expect(() => s.kdata(which)).toThrow(/signed 32-bit/);
        for (const terms of ["END", [3], null])
          expect(() =>
            s.kxtrct("KEY", terms as never, "KEY value END"),
          ).toThrow();
        expect(() => s.kxtrct(3 as never, [], "KEY value")).toThrow();
        expect(() => s.kxtrct("KEY", [], 3 as never)).toThrow();
        expect(() => s.kxtrct("KEY", [], "x".repeat(1 << 20))).toThrow(
          /too large/,
        );
        // The byte bound also applies to multibyte characters, not just JS length.
        expect(() => s.kxtrct("KEY", [], "木".repeat(350000))).toThrow(
          /too large/,
        );
        expect(s.kxtrct("KEY", [], "KEY value\t")).toEqual({
          found: true,
          wordsq: "",
          substr: "value\t",
        });
        expect(s.kdata(-1)).toEqual({ found: false });
        expect(s.kinfo("")).toEqual({ found: false });
        expect(s.failed()).toBe(false);
      } finally {
        s.kclear();
        await setup.dispose();
      }
    });
    test(`${backend}: failed furnsh retains actual CSPICE partial pool state until kclear`, async () => {
      const oracle = JSON.parse(
        execFileSync(
          "uv",
          [
            "run",
            "--locked",
            "--project",
            path.join(packageRoot, "sidecars/spiceypy"),
            "python",
            "-c",
            `
import json, sys, spiceypy as s
s.kclear()
try:
    try:
        s.furnsh(sys.argv[1])
        raise AssertionError("fixture must fail")
    except s.utils.exceptions.SpiceNUMBEREXPECTED:
        pass
    print(json.dumps({"values": s.gdpool("AUDIT_PARTIAL_VALUE", 0, 4).tolist(), "total": s.ktotal("ALL")}))
finally:
    s.kclear()
`,
            malformed,
          ],
          { encoding: "utf8" },
        ),
      );
      const setup = await spiceClients.toSync({ backend });
      const s = setup.spice.raw;
      try {
        s.kclear();
        for (let repeat = 0; repeat < 2; repeat++) {
          expect(() =>
            s.furnsh({
              path: "partial.tpc",
              bytes: fs.readFileSync(malformed),
            }),
          ).toThrow(/NUMBEREXPECTED/);
          const result = s.gdpool("AUDIT_PARTIAL_VALUE", 0, 4);
          expect(result.found).toBe(true);
          expect({
            values: result.found ? result.values : [],
            total: s.ktotal("ALL"),
          }).toEqual(oracle);
          expect(s.failed()).toBe(false);
        }
        s.kclear();
        expect(s.dtpool("AUDIT_PARTIAL_VALUE")).toEqual({ found: false });
        s.furnsh({
          path: "valid.tpc",
          bytes: new TextEncoder().encode(
            "KPL/PCK\n\\begindata\nAUDIT_RECOVERY = ( 31 )\n\\begintext\n",
          ),
        });
        expect(s.gdpool("AUDIT_RECOVERY", 0, 1)).toEqual({
          found: true,
          values: [31],
        });
      } finally {
        s.kclear();
        await setup.dispose();
      }
    }, 20000);
  }
});
