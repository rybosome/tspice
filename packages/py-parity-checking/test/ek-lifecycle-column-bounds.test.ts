import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type { SpiceHandle } from "@rybosome/tspice-backend-contract";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
describe("EK column-count preflight and actual maximum-width segment", () => {
  for (const backend of ["wasm", "node"] as const)
    it.runIf(backend === "wasm" || nodeBackendAvailable)(backend, async () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-ek-columns-"));
      const setup = await spiceClients.toSync({ backend });
      const raw = setup.spice.raw;
      const output =
        backend === "node" ? path.join(root, "columns.ek") : "columns.ek";
      let h: SpiceHandle | undefined;
      try {
        h = raw.ekopn(output, "AUTHORED_COLUMNS", 0);
        const invalid = new Array<string>(101);
        Object.defineProperty(invalid, 0, {
          get() {
            throw new Error("Invalid count accessed string data");
          },
        });
        expect(() =>
          raw.ekifld(
            h!,
            "INVALID",
            1,
            invalid,
            new Array<string>(101).fill("DATATYPE=INTEGER"),
          ),
        ).toThrow(/100|columns/);
        const names = Array.from(
          { length: 100 },
          (_, i) => "C" + String(i).padStart(3, "0"),
        );
        const seg = raw.ekifld(
          h,
          "AUDIT_MAX",
          1,
          names,
          names.map(() => "DATATYPE=INTEGER"),
        );
        expect(seg.segno).toBe(0);
        expect(seg.rcptrs).toHaveLength(1);
        for (let i = 0; i < names.length; i++)
          raw.ekacli(
            h,
            seg.segno,
            names[i]!,
            [i * 7 - 3],
            [1],
            [false],
            seg.rcptrs,
          );
        raw.ekffld(h, seg.segno, seg.rcptrs);
        raw.ekcls(h);
        h = undefined;
        h = raw.ekopr(output);
        expect(raw.eknseg(h)).toBe(1);
        raw.ekcls(h);
        h = undefined;
        raw.furnsh(output);
        expect(raw.ekfind("SELECT C000,C099 FROM AUDIT_MAX")).toEqual({
          ok: true,
          nmrows: 1,
        });
        expect(raw.ekgi(0, 0, 0)).toEqual({
          found: true,
          isNull: false,
          value: -3,
        });
        expect(raw.ekgi(1, 0, 0)).toEqual({
          found: true,
          isNull: false,
          value: 690,
        });
      } finally {
        if (h !== undefined) raw.ekcls(h);
        await setup.dispose();
        fs.rmSync(root, { recursive: true, force: true });
      }
    });
});
