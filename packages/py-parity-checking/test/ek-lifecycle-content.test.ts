import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type { EkApi } from "@rybosome/tspice-backend-contract";
import { createEkApi } from "../../backend-wasm/dist/domains/ek.js";
import { createSpiceHandleRegistry } from "../../backend-wasm/dist/runtime/spice-handles.js";
import { assertEmscriptenModule } from "../../backend-wasm/dist/lowlevel/exports.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const segments = [
  { table: "AUDIT_SHARED", rows: [-7, 11] },
  { table: "AUDIT_OTHER", rows: [99] },
];
function writeEk(api: EkApi, output: string): void {
  let h = api.ekopn(output, "A".repeat(80), 2050);
  try {
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]!;
      if (i > 0) h = api.ekopw(output);
      const initialized = api.ekifld(
        h,
        segment.table,
        segment.rows.length,
        ["ID"],
        ["DATATYPE=INTEGER"],
      );
      expect(initialized.segno).toBe(i);
      expect(initialized.rcptrs).toHaveLength(segment.rows.length);
      api.ekacli(
        h,
        initialized.segno,
        "ID",
        segment.rows,
        segment.rows.map(() => 1),
        segment.rows.map(() => false),
        initialized.rcptrs,
      );
      api.ekffld(h, initialized.segno, initialized.rcptrs);
      api.ekcls(h);
    }
  } catch (error) {
    // Actual close is still attempted if a writer operation fails.
    try {
      api.ekcls(h);
    } catch {
      // Best-effort cleanup preserves the original test failure.
    }
    throw error;
  }
  h = api.ekopr(output);
  try {
    expect(api.eknseg(h)).toBe(2);
  } finally {
    api.ekcls(h);
  }
}

describe("actual EK lifecycle header and complete file content against SpiceyPy", () => {
  for (const backend of ["wasm", "node"] as const)
    it.runIf(backend === "wasm" || nodeBackendAvailable)(
      backend,
      async () => {
        const root = fs.mkdtempSync(
          path.join(os.tmpdir(), "tspice-ek-content-"),
        );
        const output = path.join(root, "actual.ek");
        try {
          if (backend === "node") {
            const setup = await spiceClients.toSync({ backend });
            try {
              writeEk(setup.spice.raw, output);
            } finally {
              await setup.dispose();
            }
          } else {
            // Supplemental component binding exposes the actual module's file bytes
            // for an independent scientific reader. Registered parity cases still
            // exercise production public package exports for both required backends.
            const assets = path.resolve(
              packageRoot,
              "../backend-wasm/emscripten",
            );
            const loaded: unknown = await import(
              pathToFileURL(path.join(assets, "tspice_backend_wasm.node.js"))
                .href
            );
            if (typeof loaded !== "object" || loaded === null)
              throw new TypeError("Missing module factory");
            const factory: unknown = Reflect.get(loaded, "default");
            if (typeof factory !== "function")
              throw new TypeError("Missing module factory function");
            const pending: unknown = Reflect.apply(factory, undefined, [
              {
                wasmBinary: fs.readFileSync(
                  path.join(assets, "tspice_backend_wasm.wasm"),
                ),
                locateFile: (name: string) => path.join(assets, name),
              },
            ]);
            const module = await pending;
            assertEmscriptenModule(module);
            const api = createEkApi(module, createSpiceHandleRegistry());
            writeEk(api, "content.ek");
            fs.writeFileSync(
              output,
              module.FS.readFile("/kernels/content.ek", {
                encoding: "binary",
              }),
            );
          }
          const stdout = execFileSync(
            "uv",
            [
              "run",
              "--locked",
              "--project",
              path.join(packageRoot, "sidecars/spiceypy"),
              "python",
              "-c",
              `
import json, sys, pathlib, spiceypy as sp
segments=json.load(sys.stdin)
reference=pathlib.Path(sys.argv[1])/'reference.ek'
h=sp.ekopn(str(reference),'A'*80,2050)
for i,segment in enumerate(segments):
    if i:h=sp.ekopw(str(reference))
    seg,ptrs=sp.ekifld(h,segment['table'],1,len(segment['rows']),3,['ID'],17,['DATATYPE=INTEGER'])
    sp.ekacli(h,seg,'ID',segment['rows'],[1]*len(segment['rows']),[False]*len(segment['rows']),ptrs,[0]*len(segment['rows']))
    sp.ekffld(h,seg,ptrs);sp.ekcls(h)
def inspect(filename):
    h=sp.ekopr(str(filename))
    try:
        result={'header':list(sp.dasrfr(h)),'segments':[]}
        for i in range(sp.eknseg(h)):
            summary=sp.ekssum(h,i)
            columns=[]
            for attr in summary.cdescrs[:summary.ncols]:
                columns.append({key:getattr(getattr(attr,key),'value',getattr(attr,key)) for key,_ in attr._fields_})
            result['segments'].append({'table':summary.tabnam,'nrows':summary.nrows,'ncols':summary.ncols,'names':list(summary.cnames),'attributes':columns})
    finally:sp.ekcls(h)
    sp.furnsh(str(filename))
    try:
        result['tables']={}
        for segment in segments:
            count,error,message=sp.ekfind('SELECT ID FROM '+segment['table']+' ORDER BY ID')
            assert not error,message
            values=[sp.ekgi(0,row,0)[0] for row in range(count)]
            assert values==sorted(segment['rows']), (values,segment)
            result['tables'][segment['table']]=values
    finally:sp.kclear()
    return result
actual=inspect(sys.argv[2]);expected=inspect(reference)
assert actual==expected, json.dumps({'actual':actual,'expected':expected},sort_keys=True)
assert actual['header'][0]=='DAS/EK' and actual['header'][1]=='A'*60
assert actual['header'][4]==3
assert [s['nrows'] for s in actual['segments']]==[2,1]
assert all(s['ncols']==1 and s['names']==['ID'] for s in actual['segments'])
print(json.dumps({'header':True,'segments':2,'rows':3,'allValues':True}))
`,
              root,
              output,
            ],
            { encoding: "utf8", input: JSON.stringify(segments) },
          );
          expect(JSON.parse(stdout)).toEqual({
            header: true,
            segments: 2,
            rows: 3,
            allValues: true,
          });
        } finally {
          fs.rmSync(root, { recursive: true, force: true });
        }
      },
      20000,
    );
});
