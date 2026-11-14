import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createFramesApi } from "../src/domains/frames.js";
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
describe("CK writer allocation rollback on the actual WASM heap", () => {
  for (const [method, count] of [
    ["ckopn", 4],
    ["ckcls", 1],
    ["ckw01", 4],
    ["ckw02", 4],
    ["ckw03", 4],
    ["ckw05", 4],
  ] as const) {
    for (let failAt = 1; failAt <= count; ++failAt)
      it(`${method} recovers every allocation through failure ${failAt}`, async () => {
        const m = await actualModule();
        const raw = createFramesApi(m);
        const w = raw.ckopn("out.bc", "TEST", 0);
        const q = [1, 0, 0, 0, 0.98, 0.1, 0.1, 0.1],
          t = [1, 2],
          av = [0.1, 0.2, 0.3, 0.2, 0.3, 0.4];
        raw.ckw01(w, 1, 2, -123000, "J2000", true, "BASE", t, q, av);
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
              case "ckopn":
                return raw.ckopn("other.bc", "TEST", 0);
              case "ckcls":
                return raw.ckcls(w);
              case "ckw01":
                return raw.ckw01(
                  w,
                  1,
                  2,
                  -123000,
                  "J2000",
                  true,
                  "ONE",
                  t,
                  q,
                  av,
                );
              case "ckw02":
                return raw.ckw02(
                  w,
                  1,
                  2,
                  -123000,
                  "J2000",
                  "TWO",
                  [1],
                  [2],
                  q.slice(0, 4),
                  av.slice(0, 3),
                  [0.5],
                );
              case "ckw03":
                return raw.ckw03(
                  w,
                  1,
                  2,
                  -123000,
                  "J2000",
                  true,
                  "THREE",
                  t,
                  q,
                  av,
                  [1],
                );
              case "ckw05":
                return raw.ckw05(
                  w,
                  1,
                  1,
                  1,
                  2,
                  -123000,
                  "J2000",
                  true,
                  "FIVE",
                  t,
                  q,
                  0.5,
                  [1],
                );
            }
          }).toThrow(/WASM malloc failed/);
          expect(live.size).toBe(0);
        } finally {
          m._malloc = malloc;
          m._free = free;
          raw.ckcls(w);
        }
      });
  }
});
