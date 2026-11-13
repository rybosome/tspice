import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type { FileIoApi, SpiceHandle } from "@rybosome/tspice-backend-contract";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
const vertices = [1, 2, 3, 4, 2, 3, 1, 6, 3, 1, 2, 8];
const plates = [1, 3, 2, 1, 2, 4, 2, 3, 4, 3, 1, 4];
function write(
  api: FileIoApi,
  h: SpiceHandle,
  sd: number[],
  si: number[],
): void {
  api.dskw02(
    h,
    399,
    71,
    2,
    "J2000",
    3,
    new Array<number>(10).fill(0),
    1,
    4,
    2,
    6,
    3,
    8,
    -25,
    75,
    4,
    vertices,
    4,
    plates,
    sd,
    si,
  );
}
describe("DSK active spatial-index bounds and same-writer recovery", () => {
  for (const backend of ["wasm", "node"] as const)
    for (const makvtl of [true, false])
      it.runIf(backend === "wasm" || nodeBackendAvailable)(
        `${backend}: vertex lists ${makvtl}`,
        async () => {
          const root = fs.mkdtempSync(
            path.join(os.tmpdir(), "tspice-dsk-bounds-"),
          );
          const setup = await spiceClients.toSync({ backend });
          const raw = setup.spice.raw;
          let h: SpiceHandle | undefined;
          try {
            const output =
              backend === "node" ? path.join(root, "bounds.bds") : "bounds.bds";
            h = raw.dskopn(output, "AUTHORED_BOUNDS", 0);
            const { spaixd, spaixi } = raw.dskmi2(
              4,
              vertices,
              4,
              plates,
              0.5,
              2,
              100000,
              5000,
              5000,
              makvtl,
              120000,
            );
            const required = 100007 + spaixi[4]! + spaixi[5]! + 4 + spaixi[6]!;
            expect(required).toBeGreaterThan(100007);
            expect(required).toBeLessThanOrEqual(spaixi.length);
            const negative = spaixi.slice();
            negative[4] = -1;
            const overflowing = spaixi.slice();
            overflowing[4] = 2147483647;
            for (const bad of [
              spaixi.slice(0, 100007),
              spaixi.slice(0, required - 1),
              negative,
              overflowing,
            ])
              expect(() => write(raw, h!, spaixd, bad)).toThrow(
                /index|spaixi|non-negative|negative/i,
              );
            for (const [nv, np] of [
              [100000000, 4],
              [4, 100000000],
            ])
              expect(() =>
                raw.dskw02(
                  h!,
                  399,
                  71,
                  2,
                  "J2000",
                  3,
                  new Array<number>(10).fill(0),
                  1,
                  4,
                  2,
                  6,
                  3,
                  8,
                  -25,
                  75,
                  nv!,
                  vertices,
                  np!,
                  plates,
                  spaixd,
                  spaixi,
                ),
              ).toThrow(/length/i);
            write(raw, h, spaixd, spaixi.slice(0, required));
            raw.dascls(h);
            h = undefined;
            h = raw.dasopr(output);
            const first = raw.dlabfs(h);
            expect(first.found).toBe(true);
            if (!first.found)
              throw new Error("Missing valid segment after failed writes");
            expect(raw.dlafns(h, first.descr)).toEqual({ found: false });
          } finally {
            if (h !== undefined) raw.dascls(h);
            await setup.dispose();
            fs.rmSync(root, { recursive: true, force: true });
          }
        },
      );
});
