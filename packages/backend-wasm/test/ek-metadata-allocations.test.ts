import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createEkApi } from "../src/domains/ek.js";
import { createSpiceHandleRegistry } from "@rybosome/tspice-core";
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

const bytes = fs.readFileSync(
  new URL(
    "../../py-parity-checking/fixtures/kernels/audit-query.ek",
    import.meta.url,
  ),
);
const sizes = {
  eklef: 3,
  ekuef: 1,
  ekccnt: 3,
  ekcii: 4,
  eknelt: 2,
  ekpsel: 4,
  ekssum: 3,
} as const;
describe("compiled EK query metadata allocations", () => {
  for (const method of Object.keys(sizes) as (keyof typeof sizes)[]) {
    for (let ordinal = 0; ordinal <= sizes[method]; ordinal++)
      it(method + " allocation " + ordinal, async () => {
        const module = await actualModule();
        module.FS.mkdirTree("/kernels");
        module.FS.writeFile("/kernels/meta.ek", bytes);
        const handles = createSpiceHandleRegistry(),
          api = createEkApi(module, handles);
        let h = method === "eklef" ? undefined : api.eklef("meta.ek");
        const query = "SELECT CV FROM AUDIT_QUERY ORDER BY KEY";
        if (method === "eknelt") api.ekfind(query);
        const call = () => {
          switch (method) {
            case "eklef":
              h = api.eklef("meta.ek");
              return;
            case "ekuef":
              api.ekuef(h!);
              h = undefined;
              return;
            case "ekccnt":
              expect(api.ekccnt("audit_query")).toBe(7);
              return;
            case "ekcii":
              expect(api.ekcii("AUDIT_QUERY", 6).column).toBe("IFIX");
              return;
            case "eknelt":
              expect(api.eknelt(0, 2)).toBe(2);
              return;
            case "ekpsel":
              expect(api.ekpsel(query)).toMatchObject({
                ok: true,
                cols: ["CV"],
              });
              return;
            case "ekssum":
              expect(api.ekssum(h!, 0).cdescrs).toHaveLength(7);
              return;
          }
        };
        module._free(module._malloc(8));
        const malloc = module._malloc,
          free = module._free,
          live = new Set<number>();
        let calls = 0;
        try {
          module._malloc = (n) => {
            if (++calls === ordinal) return 0;
            const ptr = malloc(n);
            if (ptr) live.add(ptr);
            return ptr;
          };
          module._free = (ptr) => {
            live.delete(ptr);
            free(ptr);
          };
          if (ordinal) expect(call).toThrow(/malloc failed/);
          else call();
          expect(calls).toBe(ordinal || sizes[method]);
          expect(live.size).toBe(0);
        } finally {
          module._malloc = malloc;
          module._free = free;
        }
        try {
          if (ordinal) call();
        } finally {
          if (h !== undefined) api.ekuef(h);
        }
        expect(api.ekntab()).toBe(0);
      });
  }
});
