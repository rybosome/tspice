import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type { SpiceHandle } from "@rybosome/tspice-backend-contract";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
const fixtures = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures/kernels",
);

describe("file handle owner identity", () => {
  for (const backend of ["wasm", "node"] as const) {
    for (const kind of ["DAF", "DAS"] as const)
      it.runIf(backend === "wasm" || nodeBackendAvailable)(
        `${backend}: rejects foreign ${kind} handles before operating on a local file`,
        async () => {
          const a = await spiceClients.toSync({ backend });
          const b = await spiceClients.toSync({ backend });
          const name =
            kind === "DAF"
              ? "frames-minimal/earthstns_itrf93_201023.bsp"
              : "dsk-minimal/apophis_g_25000mm_rad_obj_0000n00000_v001.bds";
          const virtual = kind === "DAF" ? "owner.bsp" : "owner.bds";
          let ha: SpiceHandle | undefined;
          let hb: SpiceHandle | undefined;
          try {
            const bytes = fs.readFileSync(path.join(fixtures, name));
            a.spice.raw.furnsh({ path: virtual, bytes });
            b.spice.raw.furnsh({ path: virtual, bytes });
            ha =
              kind === "DAF"
                ? a.spice.raw.dafopr(virtual)
                : a.spice.raw.dasopr(virtual);
            hb =
              kind === "DAF"
                ? b.spice.raw.dafopr(virtual)
                : b.spice.raw.dasopr(virtual);
            const cell = b.spice.kit.newIntCell(1);
            try {
              expect(() => b.spice.raw.card(hb as never)).toThrow();
              expect(() => b.spice.raw.dafbfs(cell as never)).toThrow();
            } finally {
              b.spice.kit.freeCell(cell);
            }
            if (kind === "DAF") {
              for (const use of [
                b.spice.raw.dafbfs,
                b.spice.raw.daffna,
                b.spice.raw.dafcls,
              ])
                expect(() => use(ha!)).toThrow(/invalid|foreign|closed/);
              b.spice.raw.dafbfs(hb);
              expect(b.spice.raw.daffna(hb)).toBe(true);
            } else {
              for (const use of [
                b.spice.raw.dlabfs,
                b.spice.raw.dascls,
                b.spice.raw.dlacls,
              ])
                expect(() => use(ha!)).toThrow(/invalid|foreign|closed/);
              expect(b.spice.raw.dlabfs(hb).found).toBe(true);
            }
          } finally {
            if (ha !== undefined) {
              if (kind === "DAF") a.spice.raw.dafcls(ha);
              else a.spice.raw.dascls(ha);
            }
            if (hb !== undefined) {
              if (kind === "DAF") b.spice.raw.dafcls(hb);
              else b.spice.raw.dascls(hb);
            }
            await b.dispose();
            await a.dispose();
          }
        },
      );
  }
});
