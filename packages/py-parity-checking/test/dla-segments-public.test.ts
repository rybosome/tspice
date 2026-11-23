import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const root = path.resolve(import.meta.dirname, "..");
const project = path.join(root, "sidecars/spiceypy");
const independent = `
import json, pathlib, sys
import spiceypy as sp
from py_parity_sidecar.das_data_oracle import dasadc, dasrdc, physical_word
p=sys.argv[2]
fields=("bwdptr","fwdptr","ibase","isize","dbase","dsize","cbase","csize")
def unpack(d):return {k:int(getattr(d,k)) for k in fields}
def parts(h,d):
    c=dasrdc(h,d.cbase+1,d.cbase+d.csize,0,d.csize-1,d.csize,[0]*d.csize) if d.csize else []
    f=sp.dasrdd(h,d.dbase+1,d.dbase+d.dsize).tolist() if d.dsize else []
    i=sp.dasrdi(h,d.ibase+1,d.ibase+d.isize).tolist() if d.isize else []
    return [unpack(d),i,f,c]
if sys.argv[1]=="write":
    h=sp.dlaopn(p,"DATA","INDEPENDENT SEGMENTS",0)
    try:
        for ints,reals,chars in [([11,-7],[1.25,-0.5],[0,255,9]),([],[],[]),([-88],[32.5],[128,3])]:
            sp.dlabns(h)
            if ints: sp.dasadi(h,len(ints),ints)
            if reals: sp.dasadd(h,len(reals),reals)
            if chars: dasadc(h,len(chars),0,len(chars)-1,len(chars),chars)
            sp.dlaens(h)
    finally: sp.dascls(h)
h=sp.dasopr(p)
try:
    with sp.no_found_check():
        back=[]
        d,ok=sp.dlabbs(h)
        while ok:
            back.append(parts(h,d))
            d,ok=sp.dlafps(h,d)
        forward=[]
        d,ok=sp.dlabfs(h)
        while ok:
            forward.append(parts(h,d))
            d,ok=sp.dlafns(h,d)
    assert back==list(reversed(forward))
    head=sp.dasrdi(h,1,3).tolist()
    result={"header":head,"segments":forward}
    if sys.argv[1]=="padding":
        high=sp.daslla(h)[2]
        rec,w=physical_word(h,3,high)
        tail=pathlib.Path(p).read_bytes()[(rec-1)*1024+w*4:rec*1024]
        result={"header":head,"last":high,"unused":len(tail),"zero":tail==bytes(len(tail))}
    print(json.dumps(result))
finally: sp.dascls(h)
`;
function oracle(mode: "read" | "write" | "padding", file: string): unknown {
  return JSON.parse(
    execFileSync(
      "uv",
      [
        "run",
        "--locked",
        "--project",
        project,
        "python",
        "-c",
        independent,
        mode,
        file,
      ],
      { encoding: "utf8", timeout: 20000 },
    ),
  );
}
const rows = [
  [
    [11, -7],
    [1.25, -0.5],
    [0, 255, 9],
  ],
  [[], [], []],
  [[-88], [32.5], [128, 3]],
] as const;
const fields = [
  "bwdptr",
  "fwdptr",
  "ibase",
  "isize",
  "dbase",
  "dsize",
  "cbase",
  "csize",
] as const;
const descriptors = [
  [-1, 14, 11, 2, 0, 2, 0, 3],
  [4, 22, 21, 0, 2, 0, 3, 0],
  [14, -1, 29, 1, 2, 1, 3, 2],
];
const expected = {
  header: [1000000, 4, 22],
  segments: descriptors.map((d, i) => [
    Object.fromEntries(fields.map((k, j) => [k, d[j]])),
    ...rows[i]!,
  ]),
};
for (const backend of ["node", "wasm"] as const) {
  const test = it.runIf(backend === "wasm" || nodeBackendAvailable);
  test(
    backend +
      " writes linked character, integer and double segments independently reopened by SpiceyPy",
    async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-dla-write-"));
      try {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        try {
          const raw = spice.raw,
            out = { kind: "virtual-output", path: "written.dla" } as const;
          // DLAOPN initializes exactly these three integer controls. DASONW's
          // VirtualOutput permits both public backends to export the whole file.
          const w = raw.dasonw(out, "DATA", "C07 segments", 0);
          try {
            raw.dasadi(w, 3, [1000000, -1, -1]);
            for (const [i, d, c] of rows) {
              raw.dlabns(w);
              if (i.length) raw.dasadi(w, i.length, i);
              if (d.length) raw.dasadd(w, d.length, d);
              if (c.length)
                raw.dasadc(
                  w,
                  c.length,
                  0,
                  c.length - 1,
                  c.length,
                  Uint8Array.from(c),
                );
              raw.dlaens(w);
            }
            expect(raw.dasrdi(w, 1, 3)).toEqual(expected.header);
          } finally {
            raw.dascls(w);
          }
          const file = path.join(dir, "final.dla");
          fs.writeFileSync(file, spice.kit.readVirtualOutput(out));
          expect(oracle("read", file)).toEqual(expected);
        } finally {
          await dispose();
        }
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  );
  test(
    backend +
      " reads all components in both directions from an independently authored generic DLA",
    async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-dla-read-"));
      try {
        const file = path.join(dir, "independent.dla");
        expect(oracle("write", file)).toEqual(expected);
        const { spice, dispose } = await spiceClients.toSync({ backend });
        try {
          const raw = spice.raw;
          // Generic DATA is a DAS subtype rather than a KEEPER kernel. The byte
          // stager retains the file; KEEPER reports its normal architecture/type error.
          expect(() =>
            raw.furnsh({
              path: "independent.dla",
              bytes: fs.readFileSync(file),
            }),
          ).toThrowError(
            expect.objectContaining({ spiceShort: "SPICE(UNKNOWNKERNELTYPE)" }),
          );
          const h = raw.dasopr(backend === "node" ? file : "independent.dla");
          try {
            expect(raw.dasrdi(h, 1, 3)).toEqual(expected.header);
            for (const reverse of [false, true]) {
              let next = reverse ? raw.dlabbs(h) : raw.dlabfs(h);
              const seen = [];
              while (next.found) {
                const x = next.descr;
                const i = x.isize
                  ? raw.dasrdi(h, x.ibase + 1, x.ibase + x.isize)
                  : [];
                const d = x.dsize
                  ? raw.dasrdd(h, x.dbase + 1, x.dbase + x.dsize)
                  : [];
                const c = x.csize
                  ? Array.from(
                      raw.dasrdc(
                        h,
                        x.cbase + 1,
                        x.cbase + x.csize,
                        0,
                        x.csize - 1,
                        x.csize,
                        new Uint8Array(x.csize),
                      ),
                    )
                  : [];
                seen.push([x, i, d, c]);
                next = reverse ? raw.dlafps(h, x) : raw.dlafns(h, x);
              }
              expect(next).toEqual({ found: false });
              expect(seen).toEqual(
                reverse ? [...expected.segments].reverse() : expected.segments,
              );
            }
            expect(() => raw.dlabns(h)).toThrowError(
              expect.objectContaining({
                spiceShort: "SPICE(DASINVALIDACCESS)",
                spiceTrace: "dlabns_c --> DLABNS --> DASSIH",
              }),
            );
            expect(() => raw.dlaens(h)).toThrowError(
              expect.objectContaining({
                spiceShort: "SPICE(DASINVALIDACCESS)",
                spiceTrace:
                  "dlaens_c --> DLAENS --> DASUDI --> DASURI --> DASSIH",
              }),
            );
            expect(raw.dlabbs(h)).toMatchObject({
              found: true,
              descr: { bwdptr: 14 },
            });
            expect(raw.failed()).toBe(false);
          } finally {
            raw.dascls(h);
          }
        } finally {
          try {
            spice.raw.kclear();
          } finally {
            await dispose();
          }
        }
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  );
  test(
    backend +
      " clears only unused integer record padding when the last segment descriptor opens a physical record",
    async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-dla-padding-"));
      try {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        try {
          const raw = spice.raw,
            out = { kind: "virtual-output", path: "cross-record.dla" } as const;
          const h = raw.dasonw(out, "DLA", "record boundary", 0);
          try {
            raw.dasadi(h, 3, [1000000, -1, -1]);
            raw.dlabns(h);
            raw.dasadi(
              h,
              245,
              Array.from({ length: 245 }, (_, i) => i - 250),
            );
            raw.dlaens(h);
            raw.dlabns(h);
            raw.dlaens(h);
            expect(raw.dasrdi(h, 253, 257)).toEqual([-9, -8, -7, -6, 4]);
          } finally {
            raw.dascls(h);
          }
          const f = path.join(dir, "segment.dla");
          fs.writeFileSync(f, spice.kit.readVirtualOutput(out));
          expect(oracle("padding", f)).toEqual({
            header: [1000000, 4, 257],
            last: 264,
            unused: 992,
            zero: true,
          });
        } finally {
          await dispose();
        }
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  );
}
