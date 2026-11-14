import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const packageRoot = path.resolve(import.meta.dirname, "..");
// Low-closing a dirty DAS leaves process-global CSPICE buffers for the
// discarded write. Give each such reference observation its own process.
const python = `
import json, pathlib, sys, tempfile
import spiceypy as sp
with tempfile.TemporaryDirectory() as directory:
    path = str(pathlib.Path(directory) / "controls.dla")
    h = sp.dlaopn(path, "DSK", "DLA BUFFER", 0)
    before = sp.daslla(h)
    if sys.argv[1] == "flush":
        sp.daswbr(h)
    sp.dasllc(h)
    reader = sp.dasopr(path)
    try:
        print(json.dumps([before,sp.daslla(reader)]))
    finally:
        sp.dascls(reader)
`;
const javascript = `
import { spiceClients } from "@rybosome/tspice";
const [backend, mode] = process.argv.slice(1);
const client = await spiceClients.toSync({backend});
try {
  const raw = client.spice.raw;
  const name = "py-parity/scratch/controls.dla";
  const h = raw.dlaopn(name,"DSK","DLA BUFFER",0);
  const triple = h => {
    const {lastc,lastd,lasti} = raw.daslla(h);
    return [lastc,lastd,lasti];
  };
  const before = triple(h);
  if (mode === "flush") raw.daswbr(h);
  raw.dasllc(h);
  const reader = raw.dasopr(name);
  try { console.log(JSON.stringify([before,triple(reader)])); }
  finally {raw.dascls(reader);}
} finally { await client.dispose(); }
`;

for (const backend of ["node", "wasm"] as const) {
  const run = it.runIf(backend === "wasm" || nodeBackendAvailable);

  run(
    `${backend}: low-level close preserves only flushed DAS control words`,
    () => {
      for (const mode of ["dirty", "flush"]) {
        const options = { cwd: packageRoot, encoding: "utf8" } as const;
        const oracle = JSON.parse(
          execFileSync(
            "uv",
            [
              "run",
              "--locked",
              "--project",
              "sidecars/spiceypy",
              "python",
              "-c",
              python,
              mode,
            ],
            options,
          ),
        );
        const observed = JSON.parse(
          execFileSync(
            process.execPath,
            ["--input-type=module", "-e", javascript, backend, mode],
            options,
          ),
        );
        expect(observed).toEqual(oracle);
        expect(observed).toEqual([
          [0, 0, 3],
          [0, 0, mode === "flush" ? 3 : 0],
        ]);
      }
    },
  );

  run(
    `${backend}: virtual output header bytes preserve exact mixed case, leading blanks and reserved records`,
    async () => {
      const {
        spice: { raw, kit },
        dispose,
      } = await spiceClients.toSync({ backend });
      const output = {
        kind: "virtual-output",
        path: "owned/record.das",
      } as const;
      try {
        const h = raw.dasonw(output, "MiXeD", "  Header name", 3);
        const record = raw.dasrfr(h);
        expect(record).toEqual({
          idword: "DAS/MiXe",
          ifname: "  Header name",
          nresvr: 0,
          nresvc: 0,
          ncomr: 3,
          ncomc: 0,
        });
        expect(() => kit.readVirtualOutput(output)).toThrow();
        raw.dascls(h);
        const bytes = kit.readVirtualOutput(output);
        const decode = (start: number, length: number) =>
          new TextDecoder().decode(bytes.subarray(start, start + length));
        expect(decode(0, 8)).toBe(record.idword);
        expect(decode(8, 60)).toBe(record.ifname.padEnd(60, " "));
        const endian = decode(84, 8);
        expect(["LTL-IEEE", "BIG-IEEE"]).toContain(endian);
        const view = new DataView(
          bytes.buffer,
          bytes.byteOffset,
          bytes.byteLength,
        );
        expect(
          [68, 72, 76, 80].map((offset) =>
            view.getInt32(offset, endian === "LTL-IEEE"),
          ),
        ).toEqual([0, 0, 3, 0]);
        const reopened = raw.dasopw(output);
        expect(raw.dasrfr(reopened, 4, 7)).toEqual({
          ...record,
          idword: "DAS",
          ifname: "  Head",
        });
        raw.daswbr(reopened);
        raw.dasllc(reopened);
        expect(kit.readVirtualOutput(output)).toEqual(bytes);
      } finally {
        await dispose();
      }
    },
  );
}
