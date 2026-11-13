import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type { SpiceHandle } from "@rybosome/tspice-backend-contract";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
describe("EK lifecycle runtime input types", () => {
  for (const backend of ["wasm", "node"] as const)
    for (const shape of [
      "numeric internal name",
      "string column array",
      "array-like declaration object",
    ] as const)
      it.runIf(backend === "wasm" || nodeBackendAvailable)(
        `${backend}: ${shape}`,
        async () => {
          const root = fs.mkdtempSync(
            path.join(os.tmpdir(), "tspice-ek-types-"),
          );
          const output =
            backend === "node" ? path.join(root, "types.ek") : "types.ek";
          const setup = await spiceClients.toSync({ backend });
          const raw = setup.spice.raw;
          let h: SpiceHandle | undefined;
          let segment: { segno: number; rcptrs: number[] } | undefined;
          try {
            if (shape === "numeric internal name") {
              expect(() => {
                h = raw.ekopn(output, 19 as never, 0);
              }).toThrow(TypeError);
            } else {
              h = raw.ekopn(output, "AUTHORED_TYPES", 0);
              const decls = {
                length: 1,
                *[Symbol.iterator]() {
                  yield "DATATYPE=INTEGER";
                },
              };
              expect(() => {
                segment = raw.ekifld(
                  h!,
                  "AUDIT_TYPES",
                  1,
                  shape === "string column array" ? ("A" as never) : ["A"],
                  shape === "array-like declaration object"
                    ? (decls as never)
                    : ["DATATYPE=INTEGER"],
                );
              }).toThrow(TypeError);
            }
          } finally {
            // Keep an unexpectedly accepted fast-write valid even in failing-before runs.
            if (h !== undefined) {
              if (segment) {
                raw.ekacli(
                  h,
                  segment.segno,
                  "A",
                  [7],
                  [1],
                  [false],
                  segment.rcptrs,
                );
                raw.ekffld(h, segment.segno, segment.rcptrs);
              }
              raw.ekcls(h);
            }
            await setup.dispose();
            fs.rmSync(root, { recursive: true, force: true });
          }
        },
      );
});
