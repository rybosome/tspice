import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type { EkApi } from "@rybosome/tspice-backend-contract";
import { createEkApi } from "../../backend-wasm/dist/domains/ek.js";
import { createSpiceHandleRegistry } from "../../backend-wasm/dist/runtime/spice-handles.js";
import { assertEmscriptenModule } from "../../backend-wasm/dist/lowlevel/exports.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
const packageRoot = path.resolve(import.meta.dirname, "..");
const names = ["LABEL", "EPOCH", "NUMBERS"];
const decls = [
  "DATATYPE=CHARACTER*(13), NULLS_OK=TRUE",
  "DATATYPE=TIME, INDEXED=TRUE",
  "DATATYPE=INTEGER,SIZE=VARIABLE,NULLS_OK=TRUE",
];
const reference = `
import json,pathlib,sys,spiceypy as sp
from py_parity_sidecar.ek_record_oracle import column_names
actual,reference=map(pathlib.Path,sys.argv[1:3])
names,decls=json.load(sys.stdin)
h=sp.ekopw(str(reference))
try:
    s=sp.ekbseg(h,"EXTRA_RECORDS",names,decls)
    sp.ekinsr(h,s,0)
    assert sp.ekappr(h,s)==1
    sp.ekdelr(h,s,0);sp.ekdelr(h,s,0)
    sp.ekinsr(h,0,1)
    sp.ekdelr(h,0,2) # remove original second populated row
    sp.ekdelr(h,0,1) # remove the still-empty inserted row
finally:
    sp.ekcls(h)
def observe(file):
    h=sp.ekopr(str(file))
    try:
        result=[]
        for k in range(sp.eknseg(h)):
            summary=sp.ekssum(h,k)
            attrs=[[a.cclass,a.dtype,a.strlen,a.size,a.indexd,a.nullok] for a in summary.cdescrs[:summary.ncols]]
            result.append([summary.tabnam,summary.nrows,column_names(summary),attrs])
    finally:sp.ekcls(h)
    sp.furnsh(str(file))
    try:
        with sp.no_found_check():
            q=sp.ekfind("SELECT KEY, CV, DV, IV FROM AUDIT_QUERY ORDER BY KEY")
            assert not q[1],q
            rows=[]
            for i in range(q[0]):
                c=sp.ekgc(1,i,0,2048)
                d=sp.ekgd(2,i,0);v=sp.ekgi(3,i,0)
                rows.append([sp.ekgi(0,i,0)[0],c,d,v])
            assert [r[0] for r in rows]==[20,30]
            assert sp.ekfind("SELECT KEY FROM AUDIT_QUERY WHERE KEY=10")[0]==0
            assert sp.ekfind("SELECT KEY FROM AUDIT_QUERY WHERE KEY=30")[0]==1
    finally:sp.kclear()
    return result,rows
a=observe(actual);b=observe(reference)
assert a==b,(a,b)
assert [s[1] for s in a[0]]==[2,0]
assert a[0][1][0]=="EXTRA_RECORDS" and a[0][1][2]==names
assert a[0][1][3]==[[3,0,13,1,False,True],[2,3,1,1,True,False],[4,2,1,-1,False,True]],a[0][1][3]
print(json.dumps([len(a[0]),len(a[1]),len(a[0][1][3])]))
`;
function edit(raw: EkApi, file: string) {
  const h = raw.ekopw(file);
  try {
    const s = raw.ekbseg(h, "EXTRA_RECORDS", names, decls);
    expect(s).toBe(1);
    raw.ekinsr(h, s, 0);
    expect(raw.ekappr(h, s)).toBe(1);
    raw.ekdelr(h, s, 0);
    raw.ekdelr(h, s, 0);
    raw.ekinsr(h, 0, 1);
    raw.ekdelr(h, 0, 2);
    raw.ekdelr(h, 0, 1);
  } finally {
    raw.ekcls(h);
  }
}
for (const backend of ["node", "wasm"] as const) {
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    backend +
      " preserves schema, surviving row data, null flags and index lookups in a file read by the independent toolkit",
    async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-ek-records-"));
      const actual = path.join(tmp, "actual.ek"),
        expected = path.join(tmp, "reference.ek"),
        fixture = path.join(packageRoot, "fixtures/kernels/audit-query.ek");
      try {
        fs.copyFileSync(fixture, expected);
        if (backend === "node") {
          fs.copyFileSync(fixture, actual);
          const { spice, dispose } = await spiceClients.toSync({ backend });
          try {
            edit(spice.raw, actual);
          } finally {
            await dispose();
          }
        } else {
          // Export the finished virtual file to a different process for independent readback.
          const assets = path.resolve(
            packageRoot,
            "../backend-wasm/emscripten",
          );
          const imported: unknown = await import(
            pathToFileURL(path.join(assets, "tspice_backend_wasm.node.js")).href
          );
          if (!imported || typeof imported !== "object")
            throw new TypeError("Missing module exports");
          const factory: unknown = Reflect.get(imported, "default");
          if (typeof factory !== "function")
            throw new TypeError("Missing module factory");
          const m: unknown = await Reflect.apply(factory, undefined, [
            {
              wasmBinary: fs.readFileSync(
                path.join(assets, "tspice_backend_wasm.wasm"),
              ),
              locateFile: (s: string) => path.join(assets, s),
            },
          ]);
          assertEmscriptenModule(m);
          m.FS.mkdirTree("/kernels");
          m.FS.writeFile("/kernels/edit.ek", fs.readFileSync(fixture));
          edit(createEkApi(m, createSpiceHandleRegistry()), "edit.ek");
          fs.writeFileSync(
            actual,
            m.FS.readFile("/kernels/edit.ek", { encoding: "binary" }),
          );
        }
        const result = execFileSync(
          "uv",
          [
            "run",
            "--locked",
            "--project",
            "sidecars/spiceypy",
            "python",
            "-c",
            reference,
            actual,
            expected,
          ],
          {
            cwd: packageRoot,
            input: JSON.stringify([names, decls]),
            encoding: "utf8",
          },
        );
        expect(JSON.parse(result)).toEqual([2, 2, 3]);
        const back = await spiceClients.toSync({ backend });
        try {
          const raw = back.spice.raw,
            alias = "independent-record-writer.ek";
          raw.furnsh({
            path: alias,
            bytes: Uint8Array.from(fs.readFileSync(expected)),
          });
          expect(
            raw.ekfind("SELECT KEY FROM AUDIT_QUERY ORDER BY KEY"),
          ).toEqual({ ok: true, nmrows: 2 });
          expect(raw.ekgi(0, 0, 0)).toEqual({
            found: true,
            isNull: false,
            value: 20,
          });
          expect(raw.ekgi(0, 1, 0)).toEqual({
            found: true,
            isNull: false,
            value: 30,
          });
          raw.unload(alias);
          const reader = raw.ekopr(alias);
          try {
            expect(raw.eknseg(reader)).toBe(2);
          } finally {
            raw.ekcls(reader);
          }
        } finally {
          await back.dispose();
        }
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    },
  );
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    backend +
      " retains scratch ownership, guards fixed-count and in-progress fast segments, and recovers",
    async () => {
      const client = await spiceClients.toSync({ backend }),
        other = await spiceClients.toSync({ backend }),
        raw = client.spice.raw;
      try {
        const h = raw.ekops();
        try {
          expect(() => other.spice.raw.ekappr(h, 0)).toThrow(/invalid|closed/);
          const f = raw.ekbseg(
            h,
            "FIXED",
            ["I"],
            ["DATATYPE=INTEGER,FIXED_COUNT=TRUE"],
          );
          for (const edit of [
            () => raw.ekappr(h, f),
            () => raw.ekinsr(h, f, 0),
            () => raw.ekdelr(h, f, 0),
          ])
            expect(edit).toThrow(/variable-count/);
          const start = raw.ekifld(h, "FAST", 2, ["I"], ["DATATYPE=INTEGER"]);
          for (const forbidden of [
            () => raw.ekops(),
            () => raw.ekbseg(h, "EARLY", ["I"], ["DATATYPE=INTEGER"]),
            () => raw.ekappr(h, start.segno),
            () => raw.ekinsr(h, start.segno, 0),
            () => raw.ekdelr(h, start.segno, 0),
          ])
            expect(forbidden).toThrow(/fast write/);
          raw.ekacli(
            h,
            start.segno,
            "I",
            [17, 19],
            [1, 1],
            [false, false],
            start.rcptrs,
          );
          raw.ekffld(h, start.segno, start.rcptrs);
          raw.ekdelr(h, start.segno, 0);
          expect(raw.ekappr(h, start.segno)).toBe(1);
          raw.ekdelr(h, start.segno, 1);
        } finally {
          raw.ekcls(h);
        }
        expect(() => raw.ekappr(h, 0)).toThrow(/invalid|closed/);
      } finally {
        try {
          await other.dispose();
        } finally {
          await client.dispose();
        }
      }
    },
  );
}
