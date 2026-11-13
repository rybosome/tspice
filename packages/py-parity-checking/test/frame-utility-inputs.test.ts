import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
for (const backend of ["node", "wasm"] as const)
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    `${backend}: frame integer/string/epoch inputs reject coercion`,
    async () => {
      const setup = await spiceClients.toSync({ backend });
      const raw = setup.spice.raw;
      try {
        for (const invalid of [1.25, 4294967297, NaN, Infinity]) {
          for (const method of [raw.frmnam, raw.cidfrm, raw.frinfo])
            expect(() => Reflect.apply(method, raw, [invalid])).toThrow();
          expect(() => raw.ccifrm(invalid, 1)).toThrow();
          expect(() => raw.ccifrm(1, invalid)).toThrow();
        }
        for (const invalid of [NaN, Infinity, -Infinity]) {
          expect(() => raw.pxform("J2000", "ECLIPJ2000", invalid)).toThrow();
          expect(() => raw.sxform("J2000", "ECLIPJ2000", invalid)).toThrow();
        }
        expect(() => Reflect.apply(raw.namfrm, raw, [1])).toThrow(TypeError);
        expect(() => Reflect.apply(raw.cnmfrm, raw, [399])).toThrow(TypeError);
        expect(() => Reflect.apply(raw.pxform, raw, [1, "J2000", 0])).toThrow(
          TypeError,
        );
        expect(() => Reflect.apply(raw.sxform, raw, ["J2000", 1, 0])).toThrow(
          TypeError,
        );
        expect(raw.namfrm("j2000")).toEqual({ found: true, code: 1 });
        expect(raw.frmnam(1)).toEqual({ found: true, name: "J2000" });
      } finally {
        await setup.dispose();
      }
    },
  );
