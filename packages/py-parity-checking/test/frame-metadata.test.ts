import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const fixtures = path.resolve(import.meta.dirname, "../fixtures/kernels"),
  sidecar = path.resolve(import.meta.dirname, "../sidecars/spiceypy");
describe("public frame metadata", () => {
  for (const backend of ["node", "wasm"] as const) {
    const test = it.runIf(backend !== "node" || nodeBackendAvailable);
    test(
      backend + " rejects another backend instance's live integer cell",
      async () => {
        const first = await spiceClients.toSync({ backend }),
          second = await spiceClients.toSync({ backend });
        const ids = first.spice.kit.newIntCell(145);
        try {
          expect(() => second.spice.raw.bltfrm(1, ids)).toThrow(
            /owned|expired/i,
          );
          first.spice.raw.bltfrm(1, ids);
          expect(first.spice.raw.card(ids)).toBe(21);
        } finally {
          first.spice.kit.freeCell(ids);
          await second.dispose();
          await first.dispose();
        }
      },
    );
    test(
      backend +
        " preserves exact cell replacement, failure recovery and handle lifetime",
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend }),
          { raw, kit } = spice;
        const ids = kit.newIntCell(145);
        try {
          raw.insrti(-999, ids);
          raw.bltfrm(1, ids);
          expect(raw.card(ids)).toBe(21);
          expect(kit.cellGeti(ids, 0)).toBe(1);
          expect(() => raw.bltfrm(0, ids)).toThrow(/BADFRAMECLASS/);
          raw.scard(0, ids);
          raw.bltfrm(6, ids);
          expect(raw.card(ids)).toBe(0);
          raw.bltfrm(-1, ids);
          expect(raw.card(ids)).toBe(145);
        } finally {
          kit.freeCell(ids);
          try {
            expect(() => raw.bltfrm(1, ids)).toThrow();
          } finally {
            await dispose();
          }
        }
      },
    );
    test(
      backend +
        " preserves derivative blocks, independent epochs and fixed-frame direction",
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend }),
          raw = spice.raw;
        try {
          for (const file of ["pck00010.tpc", "audit-frames.tf"])
            raw.furnsh({
              path: file,
              bytes: readFileSync(path.join(fixtures, file)),
            });
          const R = raw.tipbod("J2000", 399, 0),
            S = raw.tisbod("J2000", 399, 0),
            h = 0.125;
          const before = raw.tipbod("J2000", 399, -h),
            after = raw.tipbod("J2000", 399, h);
          for (let i = 0; i < 3; i++)
            for (let j = 0; j < 3; j++) {
              const k = 3 * i + j;
              expect(S[i * 6 + j]).toBe(R[k]);
              expect(S[(i + 3) * 6 + j + 3]).toBe(R[k]);
              expect(S[i * 6 + j + 3]).toBe(0);
              expect(
                Math.abs(
                  S[(i + 3) * 6 + j]! - (after[k]! - before[k]!) / (2 * h),
                ),
              ).toBeLessThan(2e-12);
            }
          const tk = raw.tkfram(-1800999);
          expect(tk.found).toBe(true);
          if (tk.found) {
            expect(tk.frame).toBe(1);
            expect(tk.rot).toEqual(
              raw.pxform("AUDIT_FIXED_12345678901234", "J2000", 10),
            );
          }
          const forward = raw.pxfrm2("AUDIT_SPIN", "IAU_EARTH", -124, 59),
            reverse = raw.pxfrm2("IAU_EARTH", "AUDIT_SPIN", 59, -124);
          for (let i = 0; i < 3; i++)
            for (let j = 0; j < 3; j++)
              expect(
                Math.abs(forward[i * 3 + j]! - reverse[j * 3 + i]!),
              ).toBeLessThan(1e-12);
          raw.kclear();
          expect(() => raw.pxfrm2("IAU_EARTH", "J2000", 0, 1)).toThrow(
            /FRAMEDATANOTFOUND/,
          );
          expect(raw.pxfrm2("J2000", "J2000", 0, 0)).toEqual([
            1, 0, 0, 0, 1, 0, 0, 0, 1,
          ]);
        } finally {
          raw.kclear();
          await dispose();
        }
      },
    );
    test(
      backend +
        " retains kernel-driven IEEE orientation results and rejects unsafe lookup IDs before dispatch",
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend }),
          raw = spice.raw;
        const expected = JSON.parse(
          execFileSync(
            "uv",
            [
              "run",
              "--locked",
              "--project",
              sidecar,
              "python",
              "-c",
              `
import json,math,spiceypy as sp
for key,vals in [("POLE_RA",[0,0,0]),("POLE_DEC",[90,0,0]),("PM",[0,0,1e308])]:sp.pdpool("BODY1234567_"+key,vals)
def tag(x):return "nan" if math.isnan(x) else "+inf" if x==math.inf else "-inf" if x==-math.inf else x
print(json.dumps([[tag(float(x)) for x in sp.tipbod("J2000",1234567,864000).flat],[tag(float(x)) for x in sp.tisbod("J2000",1234567,864000).flat]]))
`,
            ],
            { encoding: "utf8" },
          ),
        );
        try {
          raw.pdpool("BODY1234567_POLE_RA", [0, 0, 0]);
          raw.pdpool("BODY1234567_POLE_DEC", [90, 0, 0]);
          raw.pdpool("BODY1234567_PM", [0, 0, 1e308]);
          const tag = (x: number) =>
            Number.isNaN(x)
              ? "nan"
              : x === Infinity
                ? "+inf"
                : x === -Infinity
                  ? "-inf"
                  : x;
          const tagged = [
            raw.tipbod("J2000", 1234567, 864000).map(tag),
            raw.tisbod("J2000", 1234567, 864000).map(tag),
          ];
          expect(tagged).toEqual(expected);
          expect(tagged.flat()).toContain("nan");
          for (const method of ["tipbod", "tisbod"] as const)
            expect(() => raw[method]("J2000", -2147483648, 0)).toThrow(
              /hash range/,
            );
          expect(() => raw.tkfram(-2147483648)).toThrow(/hash range/);
          expect(
            raw.xfmsta([1, 2, 3, 4, 5, 6], "GEODETIC", "GEODETIC", "unknown"),
          ).toEqual([1, 2, 3, 4, 5, 6]);
        } finally {
          raw.kclear();
          await dispose();
        }
      },
    );
  }
});
