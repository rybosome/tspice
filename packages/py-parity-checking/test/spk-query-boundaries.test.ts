import { expect, it } from "vitest";
import fs from "node:fs";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
const methods = [
  "spkez",
  "spkezp",
  "spkezr",
  "spkpos",
  "spkgeo",
  "spkgps",
  "spkssb",
  "spksfs",
] as const;
for (const backend of ["node", "wasm"] as const)
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    `${backend}: finite query epochs and strict string inputs before CSPICE`,
    async () => {
      const setup = await spiceClients.toSync({ backend }),
        { raw } = setup.spice;
      const bytes = fs.readFileSync(
        new URL("../fixtures/kernels/audit-ephemeris.bsp", import.meta.url),
      );
      try {
        raw.furnsh({ path: "query-boundaries.bsp", bytes });
        for (const method of methods) {
          const fn = Reflect.get(raw, method);
          if (typeof fn !== "function") throw Error("Missing actual raw query");
          const args: unknown[] =
            method === "spksfs"
              ? [100001, 125.25]
              : method === "spkssb"
                ? [100001, 125.25, "J2000"]
                : ["spkezr", "spkpos"].includes(method)
                  ? ["100001", 125.25, "J2000", "NONE", "100002"]
                  : ["spkez", "spkezp"].includes(method)
                    ? [100001, 125.25, "J2000", "NONE", 100002]
                    : [100001, 125.25, "J2000", 100002];
          for (const bad of [NaN, Infinity, -Infinity]) {
            const input = [...args];
            input[1] = bad;
            expect(
              () => Reflect.apply(fn, raw, input),
              `${method}: ${bad}`,
            ).toThrow(/finite/);
          }
          if (!["spkezr", "spkpos"].includes(method)) {
            for (const bad of [1.25, 4294967297, NaN, Infinity]) {
              const input = [...args];
              input[0] = bad;
              expect(
                () => Reflect.apply(fn, raw, input),
                `${method}: signed ID`,
              ).toThrow();
            }
          }
          for (const index of ["spkezr", "spkpos"].includes(method)
            ? [0, 3, 4]
            : ["spkez", "spkezp"].includes(method)
              ? [3]
              : []) {
            const input = [...args];
            input[index] = 123;
            expect(
              () => Reflect.apply(fn, raw, input),
              `${method}: string input ${index}`,
            ).toThrow(TypeError);
          }
          if (method !== "spksfs") {
            const input = [...args];
            input[2] = 123;
            expect(
              () => Reflect.apply(fn, raw, input),
              `${method}: numeric frame`,
            ).toThrow(TypeError);
          }
        }
        expect(
          raw.spkez(100001, 125.25, "J2000", "NONE", 100002).state[0],
        ).toBeCloseTo(50000, 8);
        expect(raw.spksfs(100001, 125.25).found).toBe(true);
      } finally {
        await setup.dispose();
      }
    },
  );
