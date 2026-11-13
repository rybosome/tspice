import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
for (const backend of ["node", "wasm"] as const)
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    `${backend}: GF workspace arithmetic, CSPICE errors and typed inputs`,
    async () => {
      const setup = await spiceClients.toSync({ backend }),
        { raw, kit } = setup.spice,
        cnfine = kit.newWindow(2),
        result = kit.newWindow(2);
      try {
        raw.wninsd(0, 1, cnfine);
        for (const method of ["gfsep", "gfdist"] as const) {
          const fn = Reflect.get(raw, method);
          if (typeof fn !== "function") throw Error("Missing actual search");
          const args: unknown[] =
            method === "gfsep"
              ? [
                  "100101",
                  "POINT",
                  "J2000",
                  "100103",
                  "POINT",
                  "J2000",
                  "NONE",
                  "100104",
                  "<",
                  0.1,
                  0,
                  10,
                  100,
                  cnfine,
                  result,
                ]
              : [
                  "100101",
                  "NONE",
                  "100102",
                  "<",
                  10,
                  0,
                  10,
                  100,
                  cnfine,
                  result,
                ];
          const index = method === "gfsep" ? 12 : 7;
          for (const bad of [1.25, 4294967297, NaN, Infinity]) {
            const input = [...args];
            input[index] = bad;
            expect(() => Reflect.apply(fn, raw, input)).toThrow();
          }
          for (const bad of [0, -1]) {
            const input = [...args];
            input[index] = bad;
            expect(() => Reflect.apply(fn, raw, input)).toThrow(
              /VALUEOUTOFRANGE/,
            );
          }
          // Empty first target is checked by CSPICE before its workspace malloc.
          // This proves admission at the exact budget boundary without allocating it.
          const boundary = [...args];
          boundary[0] = "";
          boundary[index] = 3355440;
          expect(() => Reflect.apply(fn, raw, boundary)).toThrow(/EMPTYSTRING/);
          for (const n of [3355441, 2147483647]) {
            boundary[index] = n;
            expect(() => Reflect.apply(fn, raw, boundary)).toThrow(/256 MiB/);
          }
          const wrong = [...args];
          wrong[0] = 123;
          expect(() => Reflect.apply(fn, raw, wrong)).toThrow(TypeError);
        }
        for (const bad of [0, 1, "false", null])
          expect(() =>
            Reflect.apply(raw.gfrefn, raw, [0, 2, bad, false]),
          ).toThrow(TypeError);
        expect(raw.gfrefn(-5, 9, true, false)).toBe(2);
      } finally {
        kit.freeWindow(cnfine);
        kit.freeWindow(result);
        await setup.dispose();
      }
    },
  );
