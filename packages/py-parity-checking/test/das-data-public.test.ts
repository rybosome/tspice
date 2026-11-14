import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const root = path.resolve(import.meta.dirname, "..");
const independent = `
import base64,json,pathlib,shutil,sys,tempfile,math,struct
import spiceypy as sp
from py_parity_sidecar import das_data_oracle as o
mode=sys.argv[1]
with tempfile.TemporaryDirectory() as d:
    p=pathlib.Path(d)/"transfer.das"
    if mode=="author":
        # The repository's authored valid DSK permits ordinary FURNSH staging;
        # the existing DLA segments do not reference the appended DAS addresses.
        shutil.copyfile("fixtures/kernels/audit-geometry.bds",p)
        h=sp.dasopw(str(p))
        try:
            hi=sp.daslla(h)
            o.dasadc(h,4,1,2,4,[1,0,255,2,3,9,32,4])
            sp.dasadd(h,4,[-0.,float("inf"),-float("inf"),float("nan")])
            sp.dasadi(h,4,[-2**31,-5,7,2**31-1])
            o.dasudc(h,hi[0]+2,hi[0]+3,0,1,2,[32,127])
            sp.dasudd(h,hi[1]+2,hi[1]+2,[0.125])
            sp.dasudi(h,hi[2]+2,hi[2]+2,[-733])
        finally:
            sp.dascls(h)
        print(json.dumps({"file":base64.b64encode(p.read_bytes()).decode(),"base":list(hi)}))
    else:
        p.write_bytes(base64.b64decode(sys.stdin.buffer.read(),validate=True))
        h=sp.dasopr(str(p))
        try:
            hi=sp.daslla(h)
            chars=o.dasrdc(h,1,hi[0],0,hi[0]-1,hi[0],[0]*hi[0])
            doubles=[struct.pack(">d",v).hex() if not math.isnan(v) else "nan" for v in sp.dasrdd(h,1,hi[1])]
            ints=sp.dasrdi(h,1,hi[2]).tolist()
            # Verify the adapter's physical padding policy only in corrected,
            # newly authored output. Use independent toolkit record addressing.
            tails=[]
            for typ,width in enumerate([1,8,4],1):
                rec,word=o.physical_word(h,typ,hi[typ-1])
                start=(rec-1)*1024 + word*width
                tail=p.read_bytes()[start:rec*1024]
                tails.append([len(tail),all(x==0 for x in tail)])
            print(json.dumps({"bytes":chars,"doubles":doubles,"ints":ints,"tails":tails}))
        finally:
            sp.dascls(h)
`;
function oracle(mode: "author" | "read", input?: Uint8Array): unknown {
  return JSON.parse(
    execFileSync(
      "uv",
      [
        "run",
        "--locked",
        "--project",
        "sidecars/spiceypy",
        "python",
        "-c",
        independent,
        mode,
      ],
      {
        cwd: root,
        encoding: "utf8",
        input: input ? Buffer.from(input).toString("base64") : "",
      },
    ),
  );
}

for (const backend of ["node", "wasm"] as const) {
  const test = it.runIf(backend === "wasm" || nodeBackendAvailable);
  test(
    backend +
      " reads an independently authored and updated DAS through ordinary DSK byte staging",
    async () => {
      const result = oracle("author");
      if (
        !result ||
        typeof result !== "object" ||
        !("file" in result) ||
        typeof result.file !== "string" ||
        !("base" in result) ||
        !Array.isArray(result.base)
      )
        throw new Error("Malformed independent DAS file result");
      const [c, d, i] = result.base;
      const {
        spice: { raw },
        dispose,
      } = await spiceClients.toSync({ backend });
      try {
        const name = "py-parity/independent-data.bds";
        raw.furnsh({
          path: name,
          bytes: Uint8Array.from(Buffer.from(result.file, "base64")),
        });
        raw.unload(name);
        const a = raw.dasopr(name),
          b = raw.dasopr(name);
        try {
          expect(raw.daslla(a)).toEqual({
            lastc: c + 4,
            lastd: d + 4,
            lasti: i + 4,
          });
          const initial = Uint8Array.of(51, 52, 53, 54, 55, 56, 57, 58, 59, 60);
          const chars = raw.dasrdc(a, c + 1, c + 4, 1, 2, 4, initial);
          expect([...chars]).toEqual([51, 0, 32, 54, 55, 127, 32, 58, 59, 60]);
          expect([...initial]).toEqual([
            51, 52, 53, 54, 55, 56, 57, 58, 59, 60,
          ]);
          expect(raw.dasrdd(b, d + 1, d + 4)).toEqual([
            -0,
            0.125,
            -Infinity,
            NaN,
          ]);
          expect(raw.dasrdi(b, i + 1, i + 4)).toEqual([
            -2147483648, -733, 7, 2147483647,
          ]);
          expect(() => raw.dasrdi(b, i + 4, i + 5)).toThrow(/DASNOSUCHADDRESS/);
          expect(raw.dasrdi(b, i + 4, i + 4)).toEqual([2147483647]);
        } finally {
          try {
            raw.dascls(a);
          } finally {
            raw.dascls(b);
          }
        }
      } finally {
        await dispose();
      }
    },
  );
  test(
    backend +
      " produces distinct logical streams and zero unused physical words for independent readback",
    async () => {
      const {
        spice: { raw, kit },
        dispose,
      } = await spiceClients.toSync({ backend });
      try {
        // Exercise appends of whole typed records in a separate owned file before
        // creating partial records. Only logical values of this file are written.
        const scratch = raw.dasops();
        try {
          raw.dasadc(
            scratch,
            1024,
            0,
            1023,
            1024,
            new Uint8Array(1024).fill(61),
          );
          raw.dasadd(scratch, 128, Array<number>(128).fill(61));
          raw.dasadi(scratch, 256, Array<number>(256).fill(61));
        } finally {
          raw.dascls(scratch);
        }
        const out = {
          kind: "virtual-output",
          path: "py-parity/transfer.das",
        } as const;
        const h = raw.dasonw(out, "DATA", "DAS_TRANSFER", 0);
        try {
          raw.dasadc(h, 4, 1, 2, 4, Uint8Array.of(1, 0, 255, 2, 3, 9, 32, 4));
          raw.dasadd(h, 4, [-0, Infinity, -Infinity, NaN]);
          raw.dasadi(h, 4, [-2147483648, -5, 7, 2147483647]);
          raw.dasudc(h, 2, 3, 0, 1, 2, Uint8Array.of(32, 127));
          raw.dasudd(h, 2, 2, [0.125]);
          raw.dasudi(h, 2, 2, [-733]);
          raw.daswbr(h);
        } finally {
          raw.dascls(h);
        }
        expect(oracle("read", kit.readVirtualOutput(out))).toEqual({
          bytes: [0, 32, 127, 32],
          doubles: [
            "8000000000000000",
            "3fc0000000000000",
            "fff0000000000000",
            "nan",
          ],
          ints: [-2147483648, -733, 7, 2147483647],
          tails: [
            [1020, true],
            [992, true],
            [1008, true],
          ],
        });
      } finally {
        await dispose();
      }
    },
  );
}
