import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { it, expect } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type { DskApi, FileIoApi } from "@rybosome/tspice-backend-contract";
import { createSpiceHandleRegistry } from "@rybosome/tspice-core";
import { assertEmscriptenModule } from "../../backend-wasm/dist/lowlevel/exports.js";
import { createFileIoApi } from "../../backend-wasm/dist/domains/file-io.js";
import { createDskApi } from "../../backend-wasm/dist/domains/dsk.js";
import { allCases } from "../src/cases/index.js";
import { runCaseInTspice } from "../src/run-tspice.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const pkg = path.resolve(import.meta.dirname, "..");
const mesh = [1, 2, 3, 4, 2, 3, 1, 6, 3, 1, 2, 8],
  faces = [1, 3, 2, 1, 2, 4, 2, 3, 4, 3, 1, 4];
function locked(program: string, ...args: string[]): unknown {
  return JSON.parse(
    execFileSync(
      "uv",
      [
        "run",
        "--locked",
        "--project",
        path.join(pkg, "sidecars/spiceypy"),
        "python",
        "-c",
        program,
        ...args,
      ],
      { encoding: "utf8", timeout: 20000 },
    ),
  );
}
function write(
  api: FileIoApi & Pick<DskApi, "dskcls">,
  file: string,
  opt: boolean,
) {
  const h = api.dskopn(file, "STEP8_DSKCLS", 64);
  let closed = false;
  try {
    const { spaixd, spaixi } = api.dskmi2(
      4,
      mesh,
      4,
      faces,
      0.5,
      2,
      100000,
      5000,
      5000,
      true,
      120000,
    );
    for (const body of [399, 499])
      api.dskw02(
        h,
        body,
        83,
        2,
        "J2000",
        3,
        Array<number>(10).fill(0),
        1,
        4,
        2,
        6,
        3,
        8,
        -25,
        75,
        4,
        mesh,
        4,
        faces,
        spaixd,
        spaixi,
      );
    api.dskcls(h, opt);
    closed = true;
    expect(() => api.dascls(h)).toThrow(/closed/);
  } finally {
    if (!closed) api.dascls(h);
  }
}
for (const backend of ["node", "wasm"] as const) {
  const run = backend === "node" ? it.runIf(nodeBackendAvailable) : it;
  run(
    backend +
      " checks complete partial pages, normal direction, independent extents and owned rows",
    async () => {
      const client = await spiceClients.toSync({ backend });
      const raw = client.spice.raw;
      try {
        const bytes = fs.readFileSync(
          path.join(pkg, "fixtures/kernels/audit-multi-dsk.bds"),
        );
        raw.furnsh({ path: "page-fixture.bds", bytes });
        const h = raw.dasopr("page-fixture.bds");
        try {
          const d = raw.dlabfs(h);
          if (!d.found) throw new Error("Missing authored DLA descriptor");
          const desc = d.descr;
          expect(raw.dskz02(h, desc)).toEqual({ nv: 4, np: 4 });
          const verts = raw.dskv02(h, desc, 1, 2147483647),
            plates = raw.dskp02(h, desc, 1, 99);
          expect(verts.flat()).toEqual(mesh);
          expect(plates.flat()).toEqual(faces);
          expect(raw.dskd02(h, desc, 19, 2, 8)).toEqual(mesh.slice(2, 10));
          expect(raw.dski02(h, desc, 9, 10, 1000)).toEqual(faces.slice(10));
          const a = raw.dskn02(h, desc, 3);
          const length = Math.hypot(20, 15, 12);
          [20, 15, 12].forEach((v, i) =>
            expect(a[i]).toBeCloseTo(v / length, 14),
          );
          verts[0]![2] = -999;
          plates[0]![0] = 0;
          expect(raw.dskv02(h, desc, 1, 1)).toEqual([[1, 2, 3]]);
          expect(raw.dskp02(h, desc, 1, 1)).toEqual([[1, 3, 2]]);
          for (const short of [0, -1])
            expect(() => raw.dskv02(h, desc, 1, short)).toThrow(
              /VALUEOUTOFRANGE/,
            );
          expect(() => raw.dskp02(h, desc, 0, 0)).toThrow(/INDEXOUTOFRANGE/);
          expect(raw.failed()).toBe(false);
        } finally {
          raw.dskcls(h, false);
        }
      } finally {
        await client.dispose();
      }
    },
  );
  run(
    backend +
      " checks descriptor provenance, opaque token ownership, guard boundaries and surviving reader claims",
    async () => {
      const left = await spiceClients.toSync({ backend });
      const right = await spiceClients.toSync({ backend });
      try {
        const raw = left.spice.raw,
          other = right.spice.raw;
        const bytes = fs.readFileSync(
          path.join(pkg, "fixtures/kernels/audit-multi-dsk.bds"),
        );
        raw.furnsh({ path: "claims.bds", bytes });
        other.furnsh({ path: "other-claims.bds", bytes });
        const a = raw.dasopr("claims.bds"),
          b = raw.dasopr("claims.bds"),
          foreign = other.dasopr("other-claims.bds");
        try {
          const first = raw.dlabfs(a);
          if (!first.found) throw new Error("missing segment");
          const d = first.descr;
          expect(() => raw.dskcls(foreign, false)).toThrow(/closed/);
          expect(() => raw.dskz02(foreign, d)).toThrow(/closed/);
          expect(() => raw.dskz02(a, { ...d, dsize: d.dsize - 1 })).toThrow(
            /descriptor|segment/,
          );
          expect(() => raw.dskn02(a, { ...d, ibase: 2147483647 }, 1)).toThrow(
            /descriptor/,
          );
          expect(() => raw.dski02(a, d, 1, -1, 2)).toThrow(/Scalar/);
          expect(() => raw.dskd02(a, d, 19, 2147483647, 1)).toThrow(
            /start plus one/,
          );
          expect(() => raw.dski02(a, d, 9, 2147483646, 1)).toThrow(/address/);
          expect(() => raw.dskp02(a, d, 1, -2147483648)).toThrow(/row width/);
          raw.dskcls(a, true);
          expect(() => raw.dskv02(a, d, 1, 1)).toThrow(/closed/);
          expect(raw.dskv02(b, { ...d }, 4, 4)).toEqual([[1, 2, 8]]);
          raw.dskcls(b, false);
        } finally {
          other.dascls(foreign);
        }
      } finally {
        await left.dispose();
        await right.dispose();
      }
    },
  );
  run(
    backend + " retries the same registered DSK writer on one live client",
    async () => {
      const client = await spiceClients.toSync({ backend });
      try {
        const writer = allCases.find(
          (c) => c.caseId === "dsk-dskcls-writer-optimized",
        );
        if (!writer) throw new Error("Missing DSK close workflow");
        for (let i = 0; i < 2; i++) {
          const r = runCaseInTspice(
            client.spice,
            writer,
            path.join(pkg, "fixtures"),
          );
          expect(r.error).toBeNull();
          expect(r.ok).toBe(true);
        }
      } finally {
        await client.dispose();
      }
    },
  );
  for (const optimize of [false, true])
    run(
      backend +
        " securely finalizes two written segments, optimize=" +
        optimize,
      async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-dsk-close-")),
          out = path.join(dir, "disk.bds");
        try {
          if (backend === "node") {
            const client = await spiceClients.toSync({ backend });
            try {
              write(client.spice.raw, out, optimize);
            } finally {
              await client.dispose();
            }
          } else {
            // Inspect actual MEMFS bytes with a separate physical CSPICE process.
            const assets = new URL(
              "../../backend-wasm/emscripten/",
              import.meta.url,
            );
            const loaded: unknown = await import(
              new URL("tspice_backend_wasm.node.js", assets).href
            );
            if (!loaded || typeof loaded !== "object")
              throw new Error("Missing WASM module");
            const factory: unknown = Reflect.get(loaded, "default");
            if (typeof factory !== "function")
              throw new Error("Missing WASM factory");
            const module: unknown = await Reflect.apply(factory, undefined, [
              {
                wasmBinary: fs.readFileSync(
                  new URL("tspice_backend_wasm.wasm", assets),
                ),
              },
            ]);
            assertEmscriptenModule(module);
            const handles = createSpiceHandleRegistry();
            write(
              {
                ...createFileIoApi(module, handles),
                ...createDskApi(module, handles),
              },
              "disk.bds",
              optimize,
            );
            expect(handles.size()).toBe(0);
            fs.writeFileSync(
              out,
              module.FS.readFile("/kernels/disk.bds", { encoding: "binary" }),
            );
          }
          const evidence = locked(
            `import sys,json,spiceypy as sp
from py_parity_sidecar.dsk_data_oracle import read_page
h=sp.dasopr(sys.argv[1]); result=[]
try:
    with sp.no_found_check():
        d,found=sp.dlabfs(h)
        while found:
            nv,np=sp.dskz02(h,d)
            result.append([sp.dskgd(h,d).center,nv,np,read_page("dskv02",h,d,None,1,5),read_page("dskp02",h,d,None,1,5)])
            d,found=sp.dlafns(h,d)
finally:
    sp.dskcls(h,True)
print(json.dumps(result))`,
            out,
          );
          const xyz = [
              [1, 2, 3],
              [4, 2, 3],
              [1, 6, 3],
              [1, 2, 8],
            ],
            tri = [
              [1, 3, 2],
              [1, 2, 4],
              [2, 3, 4],
              [3, 1, 4],
            ];
          expect(evidence).toEqual([
            [399, 4, 4, xyz, tri],
            [499, 4, 4, xyz, tri],
          ]);
        } finally {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      },
    );
}
it("locked binding exposes the toolkit count and untouched surplus, independently of SpiceyPy capacity padding", () => {
  const file = path.join(pkg, "fixtures/kernels/audit-multi-dsk.bds");
  expect(
    locked(
      `import sys,json,spiceypy as sp
from py_parity_sidecar.dsk_data_oracle import read_page
h=sp.dasopr(sys.argv[1]); obs=[]
try:
    d=sp.dlabfs(h)
    for name,item,start in [("dskd02",19,11),("dski02",9,11),("dskv02",None,4),("dskp02",None,4)]:
        args=[h,d]+([item] if item is not None else [])+[start,3]
        ordinary=getattr(sp,name)(*args).tolist()
        actual=read_page(name,h,d,item,start,3)
        assert ordinary[:len(actual)]==actual
        obs.append([len(ordinary),actual])
finally:
    sp.dskcls(h,False)
print(json.dumps(obs))`,
      file,
    ),
  ).toEqual([
    [3, [8]],
    [3, [4]],
    [3, [[1, 2, 8]]],
    [3, [[3, 1, 4]]],
  ]);
});
