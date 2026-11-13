import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type { FileIoApi } from "@rybosome/tspice-backend-contract";
import { createFileIoApi } from "../../backend-wasm/dist/domains/file-io.js";
import { createSpiceHandleRegistry } from "../../backend-wasm/dist/runtime/spice-handles.js";
import { assertEmscriptenModule } from "../../backend-wasm/dist/lowlevel/exports.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const base = [1, 2, 3, 4, 2, 3, 1, 6, 3, 1, 2, 8];
const plates = [1, 3, 2, 1, 2, 4, 2, 3, 4, 3, 1, 4];
const segments = [
  {
    center: 399,
    surfid: 71,
    first: -25,
    last: 75,
    vertices: base,
    bounds: [1, 4, 2, 6, 3, 8],
  },
  {
    center: 499,
    surfid: 72,
    first: 100,
    last: 200,
    vertices: base.map((v, i) =>
      i % 3 === 0 ? v * 2 - 5 : i % 3 === 1 ? v * 3 + 1 : v * 0.5 - 2,
    ),
    bounds: [-3, 3, 7, 19, -0.5, 2],
  },
];
function writeMesh(api: FileIoApi, output: string): void {
  const h = api.dskopn(output, "AUTHORED_STEP7_MESH", 37);
  try {
    for (const seg of segments) {
      const index = api.dskmi2(
        4,
        seg.vertices,
        4,
        plates,
        0.5,
        2,
        100000,
        5000,
        5000,
        true,
        120000,
      );
      const b = seg.bounds;
      api.dskw02(
        h,
        seg.center,
        seg.surfid,
        2,
        "J2000",
        3,
        new Array<number>(10).fill(0),
        b[0]!,
        b[1]!,
        b[2]!,
        b[3]!,
        b[4]!,
        b[5]!,
        seg.first,
        seg.last,
        4,
        seg.vertices,
        4,
        plates,
        index.spaixd,
        index.spaixi,
      );
    }
  } finally {
    api.dascls(h);
  }
}

function writeDla(api: FileIoApi, output: string): void {
  const h = api.dlaopn(output, "mIxDextra", "AUTHORED_DLA_HEADER", 1025);
  api.dlacls(h);
  expect(api.getfat(output)).toEqual({ arch: "DAS", type: "MIXD" });
}

describe("actual DSK writer geometry content against SpiceyPy", () => {
  for (const backend of ["wasm", "node"] as const)
    it.runIf(backend === "wasm" || nodeBackendAvailable)(
      backend,
      async () => {
        const root = fs.mkdtempSync(
          path.join(os.tmpdir(), "tspice-dsk-content-"),
        );
        const output = path.join(root, "actual.bds");
        try {
          if (backend === "node") {
            const setup = await spiceClients.toSync({ backend });
            try {
              writeMesh(setup.spice.raw, output);
              writeDla(setup.spice.raw, path.join(root, "actual.dla"));
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
            const api = createFileIoApi(module, createSpiceHandleRegistry());
            writeMesh(api, "content.bds");
            writeDla(api, "content.dla");
            fs.writeFileSync(
              path.join(root, "actual.dla"),
              module.FS.readFile("/kernels/content.dla", {
                encoding: "binary",
              }),
            );
            fs.writeFileSync(
              output,
              module.FS.readFile("/kernels/content.bds", {
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
import json, sys, pathlib, numpy as np, spiceypy as sp
segments = json.load(sys.stdin)
plates = np.array(${JSON.stringify(plates)}, dtype=np.int32).reshape((-1,3))
reference = pathlib.Path(sys.argv[1]) / 'reference.bds'
h = sp.dskopn(str(reference), 'AUTHORED_STEP7_MESH', 37)
try:
    for s in segments:
        vertices = np.array(s['vertices'], dtype=np.float64).reshape((-1,3))
        sd, si = sp.dskmi2(vertices, plates, .5, 2, 100000, 5000, 5000, True, 120000)
        b = s['bounds']
        sp.dskw02(handle=h, center=s['center'], surfid=s['surfid'], dclass=2, fname='J2000', corsys=3, corpar=np.zeros(10), mncor1=b[0], mxcor1=b[1], mncor2=b[2], mxcor2=b[3], mncor3=b[4], mxcor3=b[5], first=s['first'], last=s['last'], vrtces=vertices, plates=plates, spaixd=sd, spaixi=si)
finally:
    sp.dascls(h)
def inspect(filename):
    h = sp.dasopr(str(filename))
    try:
        result = {'header': list(sp.dasrfr(h)), 'segments': []}
        with sp.no_found_check():
            d, found = sp.dlabfs(h)
            while found:
                nv, np_count = sp.dskb02(h,d)[:2]
                descriptor = sp.dskgd(h,d)
                fields = {key.lstrip('_'): list(getattr(descriptor, key)) if key == '_corpar' else getattr(descriptor, key) for key, _ in descriptor._fields_}
                result['segments'].append({'descriptor': fields, 'vertices': sp.dskv02(h,d,1,nv).tolist(), 'plates': sp.dskp02(h,d,1,np_count).tolist()})
                d, found = sp.dlafns(h,d)
        return result
    finally:
        sp.dascls(h)
actual = inspect(sys.argv[2])
expected = inspect(reference)
assert actual == expected, 'actual writer content differs from live SpiceyPy writer'
assert len(actual['segments']) == len(segments)
for stored, s in zip(actual['segments'], segments):
    assert stored['vertices'] == np.array(s['vertices']).reshape((-1,3)).tolist()
    assert stored['plates'] == plates.tolist()
assert actual['header'][1] == 'AUTHORED_STEP7_MESH'
reference_dla = pathlib.Path(sys.argv[1]) / 'reference.dla'
h = sp.dlaopn(str(reference_dla), 'mIxDextra', 'AUTHORED_DLA_HEADER', 1025)
sp.dascls(h)
def dla_header(filename):
    h = sp.dasopr(str(filename))
    try:
        with sp.no_found_check():
            _, found = sp.dlabfs(h)
            assert not found
        return list(sp.dasrfr(h))
    finally:
        sp.dascls(h)
header = dla_header(pathlib.Path(sys.argv[1]) / 'actual.dla')
assert header == dla_header(reference_dla)
assert sp.getfat(str(pathlib.Path(sys.argv[1]) / 'actual.dla')) == ('DAS', 'MIXD')
assert header[0] == 'DAS/mIxD' and header[1] == 'AUTHORED_DLA_HEADER' and header[4] >= 2
print(json.dumps({'dlaHeader': True, 'segments':len(actual['segments']), 'vertices':sum(len(s['vertices']) for s in actual['segments']), 'plates':sum(len(s['plates']) for s in actual['segments'])}))
`,
              root,
              output,
            ],
            { encoding: "utf8", input: JSON.stringify(segments) },
          );
          expect(JSON.parse(stdout)).toEqual({
            dlaHeader: true,
            segments: 2,
            vertices: 8,
            plates: 8,
          });
        } finally {
          fs.rmSync(root, { recursive: true, force: true });
        }
      },
      20000,
    );
});
