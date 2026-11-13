import fs from "node:fs";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
const fixture = (name: string) =>
  fs.readFileSync(new URL(`../fixtures/kernels/${name}`, import.meta.url));
for (const backend of ["node", "wasm"] as const) {
  const run = it.runIf(backend === "wasm" || nodeBackendAvailable);
  run(
    `${backend}: full CK matrix and velocity preserve coordinate rotation and clock units`,
    async () => {
      const setup = await spiceClients.toSync({ backend }),
        raw = setup.spice.raw;
      try {
        const ck =
          backend === "node"
            ? new URL("../fixtures/kernels/audit-pointing.bc", import.meta.url)
                .pathname
            : "audit-pointing.bc";
        if (backend === "wasm") {
          raw.furnsh({ path: ck, bytes: fixture("audit-pointing.bc") });
          raw.unload(ck);
        }
        const a = raw.cklpf(ck);
        const out = raw.ckgpav(-123000, 1005, 0, "J2000");
        if (!out.found) throw Error("missing authored interpolation");
        const unit = [1, 2, 3].map((x) => x / Math.sqrt(14)),
          angle = 0.31,
          c = Math.cos(angle),
          s = Math.sin(angle);
        // Independently evaluate the authored scalar-first quaternion with Rodrigues.
        const skew = [
          [0, -unit[2]!, unit[1]!],
          [unit[2]!, 0, -unit[0]!],
          [-unit[1]!, unit[0]!, 0],
        ];
        for (let i = 0; i < 3; i++) {
          expect(Math.abs(out.av[i]! + 0.002 * unit[i]!)).toBeLessThan(1e-12);
          for (let j = 0; j < 3; j++) {
            const expected =
              (i === j ? c : 0) +
              (1 - c) * unit[i]! * unit[j]! +
              s * skew[i]![j]!;
            expect(Math.abs(out.cmat[3 * i + j]! - expected)).toBeLessThan(
              1e-12,
            );
          }
        }
        expect(out.clkout).toBe(1005);
        expect(raw.ckgp(-123000, 1012, 0, "J2000")).toEqual({ found: false });
        const tolerant = raw.ckgp(-123000, 1012, 3, "J2000");
        expect(tolerant.found && tolerant.clkout).toBe(1010);
        expect(raw.ckgp(-123000, 1005, -1, "J2000")).toEqual({ found: false });
        expect(raw.ckgp(-123001, 1005, 0, "J2000").found).toBe(true);
        expect(raw.ckgpav(-123001, 1005, 0, "J2000")).toEqual({ found: false });
        raw.ckupf(a);
        raw.ckupf(a);
        raw.ckupf(2147483647);
        expect(() => raw.ckgp(-123000, 1005, 0, "J2000")).toThrow(
          /NOLOADEDFILES/,
        );
      } finally {
        await setup.dispose();
      }
    },
  );
  run(
    `${backend}: CK rejects integer truncation and nonfinite values before FFI, with recovery`,
    async () => {
      const setup = await spiceClients.toSync({ backend }),
        { raw, kit } = setup.spice;
      const cover = kit.newWindow(4),
        ids = kit.newIntCell(4);
      try {
        for (const bad of [1.25, 4294967297, NaN, Infinity]) {
          for (const fn of [raw.ckgp, raw.ckgpav])
            expect(() => fn(bad, 1005, 0, "J2000")).toThrow();
          expect(() =>
            raw.ckcov("unused.bc", bad, false, "INTERVAL", 0, "SCLK", cover),
          ).toThrow();
        }
        for (const bad of [NaN, Infinity, -Infinity])
          for (const fn of [raw.ckgp, raw.ckgpav]) {
            expect(() => fn(-123000, bad, 0, "J2000")).toThrow();
            expect(() => fn(-123000, 1005, bad, "J2000")).toThrow();
          }
        for (const fn of [raw.ckgp, raw.ckgpav])
          expect(() => Reflect.apply(fn, raw, [-123000, 1005, 0, 17])).toThrow(
            TypeError,
          );
        kit.freeWindow(cover);
        kit.freeCell(ids);
        expect(() =>
          raw.ckcov("unused.bc", -123000, false, "INTERVAL", 0, "SCLK", cover),
        ).toThrow();
        expect(() => raw.ckobj("unused.bc", ids)).toThrow();
        expect(raw.namfrm("J2000")).toEqual({ found: true, code: 1 });
      } finally {
        await setup.dispose();
      }
    },
  );
}
