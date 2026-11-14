import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createFramesApi } from "../src/domains/frames.js";
import { createCellsWindowsKitApi } from "../src/domains/cells-windows.js";
import { assertEmscriptenModule } from "../src/lowlevel/exports.js";
async function actualModule() {
  const assets = new URL("../emscripten/", import.meta.url);
  const imported: unknown = await import(
    new URL("tspice_backend_wasm.node.js", assets).href
  );
  if (typeof imported !== "object" || imported === null)
    throw new Error("Missing actual module factory");
  const factory: unknown = Reflect.get(imported, "default");
  if (typeof factory !== "function")
    throw new Error("Missing actual module factory");
  const pending: unknown = Reflect.apply(factory, undefined, [
    {
      wasmBinary: fs.readFileSync(new URL("tspice_backend_wasm.wasm", assets)),
      locateFile: (name: string) => fileURLToPath(new URL(name, assets)),
    },
  ]);
  const module = await pending;
  assertEmscriptenModule(module);
  return module;
}
describe("PCK allocation rollback on an actual WASM heap", () => {
  for (const [method, count] of [
    ["pckcls", 1],
    ["pckcov", 2],
    ["pckfrm", 2],
    ["pcklof", 3],
    ["pckopn", 4],
    ["pckuof", 1],
    ["pckw02", 4],
  ] as const) {
    for (let failAt = 1; failAt <= count; ++failAt)
      it(`${method} releases all allocations on failure ${failAt}`, async () => {
        const m = await actualModule();
        const raw = createFramesApi(m),
          kit = createCellsWindowsKitApi(m);
        m.FS.mkdirTree("/kernels");
        m.FS.writeFile(
          "/kernels/ref.bpc",
          fs.readFileSync(
            new URL(
              "../../py-parity-checking/fixtures/kernels/audit-orientation.bpc",
              import.meta.url,
            ),
          ),
        );
        const ids = kit.newIntCell(4),
          win = kit.newWindow(2);
        const writer = raw.pckopn("out.bpc", "TEST", 0);
        raw.pckw02(
          writer,
          3000,
          "J2000",
          0,
          2,
          "BASE",
          2,
          1,
          0,
          [0.2, 0.3, 0.4],
          0,
        );
        const loaded = raw.pcklof("ref.bpc");
        const malloc = m._malloc,
          free = m._free,
          live = new Set<number>();
        let calls = 0;
        m._malloc = (size) => {
          if (++calls === failAt) return 0;
          const p = malloc(size);
          if (p) live.add(p);
          return p;
        };
        m._free = (p) => {
          expect(live.delete(p)).toBe(true);
          free(p);
        };
        try {
          expect(() => {
            switch (method) {
              case "pckopn":
                return raw.pckopn("other.bpc", "TEST", 0);
              case "pcklof":
                return raw.pcklof("ref.bpc");
              case "pckcls":
                return raw.pckcls(writer);
              case "pckuof":
                return raw.pckuof(loaded);
              case "pckfrm":
                return raw.pckfrm("ref.bpc", ids);
              case "pckcov":
                return raw.pckcov("ref.bpc", 3000, win);
              case "pckw02":
                return raw.pckw02(
                  writer,
                  3000,
                  "J2000",
                  0,
                  2,
                  "TEST",
                  2,
                  1,
                  0,
                  [0, 0, 0],
                  0,
                );
            }
          }).toThrow(/WASM malloc failed/);
          expect(live.size).toBe(0);
        } finally {
          m._malloc = malloc;
          m._free = free;
          raw.pckcls(writer);
          raw.pckuof(loaded);
          kit.freeCell(ids);
          kit.freeWindow(win);
        }
      });
  }
});
