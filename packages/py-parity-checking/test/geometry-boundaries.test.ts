import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
const queries = {
  subpnt: [
    "Near point: Ellipsoid",
    "100101",
    0,
    "AUDIT_GEOMETRY_FIXED",
    "NONE",
    "100102",
  ],
  subslr: [
    "Near point: Ellipsoid",
    "100101",
    0,
    "AUDIT_GEOMETRY_FIXED",
    "NONE",
    "100102",
  ],
  sincpt: [
    "ELLIPSOID",
    "100101",
    0,
    "AUDIT_GEOMETRY_FIXED",
    "NONE",
    "100102",
    "J2000",
    [-10, -4, -3],
  ],
  ilumin: [
    "ELLIPSOID",
    "100101",
    0,
    "AUDIT_GEOMETRY_FIXED",
    "NONE",
    "100102",
    [3, 0, 0],
  ],
  illumg: [
    "ELLIPSOID",
    "100101",
    "SUN",
    0,
    "AUDIT_GEOMETRY_FIXED",
    "NONE",
    "100102",
    [3, 0, 0],
  ],
  illumf: [
    "ELLIPSOID",
    "100101",
    "SUN",
    0,
    "AUDIT_GEOMETRY_FIXED",
    "NONE",
    "100102",
    [3, 0, 0],
  ],
  occult: [
    "100101",
    "ELLIPSOID",
    "AUDIT_GEOMETRY_FIXED",
    "100103",
    "ELLIPSOID",
    "AUDIT_OCCULT_SMALL",
    "NONE",
    "100104",
    0,
  ],
} satisfies Record<string, unknown[]>;
for (const backend of ["node", "wasm"] as const)
  for (const check of ["epoch", "vector", "string"] as const)
    it.runIf(backend === "wasm" || nodeBackendAvailable)(
      `${backend}: geometry ${check} boundary before toolkit execution`,
      async () => {
        const setup = await spiceClients.toSync({ backend }),
          { raw } = setup.spice;
        try {
          for (const [method, args] of Object.entries(queries)) {
            const fn = Reflect.get(raw, method);
            if (typeof fn !== "function")
              throw Error("Missing actual geometry routine");
            if (check === "epoch")
              for (const bad of [NaN, Infinity, -Infinity]) {
                const input = [...args];
                input[
                  method === "occult"
                    ? 8
                    : ["illumg", "illumf"].includes(method)
                      ? 3
                      : 2
                ] = bad;
                expect(() => Reflect.apply(fn, raw, input), method).toThrow(
                  /finite/,
                );
              }
            if (
              check === "vector" &&
              ["sincpt", "ilumin", "illumg", "illumf"].includes(method)
            )
              for (const bad of [
                [1, 2],
                [1, NaN, 3],
              ]) {
                const input = [...args];
                input[input.length - 1] = bad;
                expect(() => Reflect.apply(fn, raw, input), method).toThrow(
                  /length|finite/,
                );
              }
            if (check === "string") {
              const input = [...args];
              input[0] = 123;
              expect(() => Reflect.apply(fn, raw, input), method).toThrow(
                TypeError,
              );
            }
          }
          expect(raw.nvc2pl([0, 0, 2], 4)).toEqual([0, 0, 1, 2]);
        } finally {
          await setup.dispose();
        }
      },
    );
