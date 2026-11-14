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
const root = path.resolve(import.meta.dirname, "..");
const schema = [
  "DATATYPE=CHARACTER*(8),SIZE=VARIABLE,NULLS_OK=TRUE",
  "DATATYPE=TIME, SIZE=VARIABLE,NULLS_OK=TRUE",
  "DATATYPE=INTEGER, SIZE=2,NULLS_OK=TRUE",
  "DATATYPE=INTEGER,INDEXED=TRUE",
];
const vector = Array.from({ length: 137 }, (_, i) => (i - 37) / 8);
const expected = [
  { nvals: 2, isNull: false, values: [" café  ", "X\t      "] },
  { nvals: 137, isNull: false, values: vector },
  { nvals: 2, isNull: true, values: [] },
  { nvals: 1, isNull: false, values: [917] },
  { nvals: 1, isNull: true, values: [] },
  { nvals: 1, isNull: true, values: [] },
  { nvals: 2, isNull: false, values: [-2147483648, 2147483647] },
  { nvals: 1, isNull: false, values: [-3] },
];
function write(api: EkApi, file: string) {
  const h = api.ekopn(file, "ENTRY_INTEROP", 0);
  try {
    const s = api.ekbseg(h, "ENTRIES", ["TEXT", "T", "V", "KEY"], schema);
    api.ekappr(h, s);
    api.ekappr(h, s);
    for (const r of [0, 1]) {
      api.ekacec(h, s, r, "TEXT", ["initial"], false);
      api.ekaced(h, s, r, "T", [3.25], false);
      api.ekacei(h, s, r, "V", [8, 2], false);
      api.ekacei(h, s, r, "KEY", [20 + r], false);
    }
    api.ekucec(h, s, 0, "TEXT", [" café", "X\t"], false);
    api.ekuced(h, s, 0, "T", vector, false);
    api.ekucei(h, s, 0, "V", [7, 3], true);
    api.ekucei(h, s, 0, "KEY", [917], false);
    api.ekucec(h, s, 1, "TEXT", ["ignored"], true);
    api.ekuced(h, s, 1, "T", [99], true);
    api.ekucei(h, s, 1, "V", [-2147483648, 2147483647], false);
    api.ekucei(h, s, 1, "KEY", [-3], false);
  } finally {
    api.ekcls(h);
  }
}
function read(api: EkApi, file: string) {
  const h = api.ekopr(file);
  try {
    return [0, 1].flatMap((r) => [
      api.ekrcec(h, 0, r, "TEXT", 9),
      api.ekrced(h, 0, r, "T"),
      api.ekrcei(h, 0, r, "V"),
      api.ekrcei(h, 0, r, "KEY"),
    ]);
  } finally {
    api.ekcls(h);
  }
}
const py = `
import sys,json,spiceypy as sp
from py_parity_sidecar.ek_entry_oracle import entry
actual,reference=sys.argv[1:]
decls=json.load(sys.stdin)
h=sp.ekopn(reference,"SPICEYPY",0)
try:
 s=sp.ekbseg(h,"ENTRIES",["TEXT","T","V","KEY"],decls)
 for r in [0,1]:
  assert sp.ekappr(h,s)==r
  for k,c,v in [("c","TEXT",["a"]),("d","T",[-2.5]),("i","V",[3,5]),("i","KEY",[99+r])]:
   entry("ekace"+k,h,s,r,c,values=v)
 rows=[[[" café","X\\t"],[(i-37)/8 for i in range(137)],[7,3],[917]],[["unused"],[3],[-2147483648,2147483647],[-3]]]
 for r,values in enumerate(rows):
  for j,(k,c) in enumerate(zip("cdii",["TEXT","T","V","KEY"])):
   entry("ekuce"+k,h,s,r,c,values=values[j],is_null=(r,j) in ((0,2),(1,0),(1,1)))
finally:sp.ekcls(h)
def inspect(file):
 h=sp.ekopr(file)
 try:
  return [entry("ekrce"+k,h,0,r,c,width=9) for r in [0,1] for k,c in zip("cdii",["TEXT","T","V","KEY"])]
 finally:sp.ekcls(h)
a,b=inspect(actual),inspect(reference)
assert a==b
sp.furnsh(actual)
try:
 assert sp.ekfind("SELECT KEY FROM ENTRIES WHERE KEY=20")[0]==0
 assert sp.ekfind("SELECT KEY FROM ENTRIES WHERE KEY=917")[0]==1
finally:sp.kclear()
print(json.dumps(a))
`;
for (const backend of ["node", "wasm"] as const) {
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    backend +
      " persists every row field in both independent writer/reader directions",
    async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-entry-")),
        actual = path.join(dir, "actual.ek"),
        ref = path.join(dir, "spice.ek");
      try {
        if (backend === "node") {
          const c = await spiceClients.toSync({ backend });
          try {
            write(c.spice.raw, actual);
          } finally {
            await c.dispose();
          }
        } else {
          const assets = path.resolve(root, "../backend-wasm/emscripten"),
            url = pathToFileURL(
              path.join(assets, "tspice_backend_wasm.node.js"),
            ).href;
          const imp: unknown = await import(url);
          if (!imp || typeof imp !== "object") throw Error("Missing module");
          const factory: unknown = Reflect.get(imp, "default");
          if (typeof factory !== "function") throw Error("Missing factory");
          const m: unknown = await Reflect.apply(factory, undefined, [
            {
              wasmBinary: fs.readFileSync(
                path.join(assets, "tspice_backend_wasm.wasm"),
              ),
              locateFile: (f: string) => path.join(assets, f),
            },
          ]);
          assertEmscriptenModule(m);
          write(createEkApi(m, createSpiceHandleRegistry()), "entry.ek");
          fs.writeFileSync(
            actual,
            m.FS.readFile("/kernels/entry.ek", { encoding: "binary" }),
          );
        }
        const data = execFileSync(
          "uv",
          [
            "run",
            "--locked",
            "--project",
            "sidecars/spiceypy",
            "python",
            "-c",
            py,
            actual,
            ref,
          ],
          { cwd: root, input: JSON.stringify(schema), encoding: "utf8" },
        );
        expect(JSON.parse(data)).toEqual(expected);
        const c = await spiceClients.toSync({ backend });
        try {
          const raw = c.spice.raw;
          raw.furnsh({
            path: "oracle.ek",
            bytes: Uint8Array.from(fs.readFileSync(ref)),
          });
          expect(raw.ekfind("SELECT KEY FROM ENTRIES WHERE KEY = 917")).toEqual(
            { ok: true, nmrows: 1 },
          );
          raw.unload("oracle.ek");
          expect(read(raw, "oracle.ek")).toEqual(expected);
        } finally {
          await c.dispose();
        }
      } finally {
        fs.rmSync(dir, { force: true, recursive: true });
      }
    },
  );
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    backend +
      " retains read ownership, guards repeated add and recovers from real errors",
    async () => {
      const c = await spiceClients.toSync({ backend }),
        raw = c.spice.raw;
      try {
        const h = raw.ekops();
        try {
          const s = raw.ekbseg(
            h,
            "T",
            ["C", "V"],
            [
              "DATATYPE=CHARACTER*(4),SIZE=VARIABLE",
              "DATATYPE=INTEGER,SIZE=VARIABLE",
            ],
          );
          raw.ekappr(h, s);
          raw.ekacec(h, s, 0, "C", ["é", "B"], false);
          raw.ekacei(h, s, 0, "V", [9, 2], false);
          const first = raw.ekrcec(h, s, 0, "C", 5).values;
          expect(() => raw.ekrcec(h, s, 0, "C", 3)).toThrow(/STRINGTRUNCATED/);
          expect(() => raw.ekrced(h, s, 0, "V")).toThrow(/WRONGDATATYPE/);
          expect(() => raw.ekacei(h, s, 0, "V", [4], false)).toThrow(
            /uninitialized/,
          );
          raw.ekucec(h, s, 0, "C", ["A"], false);
          expect(first).toEqual(["é  ", "B   "]);
          expect(raw.ekrcei(h, s, 0, "V").values).toEqual([9, 2]);
          const restricted = raw.ekbseg(
            h,
            "REQUIRED",
            ["I", "D"],
            ["DATATYPE=INTEGER,INDEXED=TRUE", "DATATYPE=DOUBLE PRECISION"],
          );
          raw.ekappr(h, restricted);
          raw.ekacei(h, restricted, 0, "I", [19], false);
          raw.ekaced(h, restricted, 0, "D", [1.25], false);
          expect(() => raw.ekucei(h, restricted, 0, "I", [0], true)).toThrow(
            /non-nullable/,
          );
          expect(() => raw.ekuced(h, restricted, 0, "D", [0], true)).toThrow(
            /non-nullable/,
          );
          expect(raw.ekrcei(h, restricted, 0, "I").values).toEqual([19]);
          expect(raw.ekrced(h, restricted, 0, "D").values).toEqual([1.25]);
          const fixed = raw.ekbseg(
            h,
            "FIXED",
            ["V"],
            ["DATATYPE=INTEGER,SIZE=2"],
          );
          raw.ekappr(h, fixed);
          raw.ekacei(h, fixed, 0, "V", [41, 23], false);
          expect(() => raw.ekucei(h, fixed, 0, "V", [4], false)).toThrow(
            /INVALIDCOUNT/,
          );
          // N0067 removes the old vector before it validates the replacement.
          expect(() => raw.ekrcei(h, fixed, 0, "V")).toThrow(
            /UNINITIALIZEDVALUE/,
          );
          raw.ekucei(h, fixed, 0, "V", [-3, 8], false);
          expect(raw.ekrcei(h, fixed, 0, "V").values).toEqual([-3, 8]);
          expect(raw.failed()).toBe(false);
        } finally {
          raw.ekcls(h);
        }
      } finally {
        await c.dispose();
      }
    },
  );
}
