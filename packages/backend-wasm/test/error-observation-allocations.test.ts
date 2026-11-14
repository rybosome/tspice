import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import type { ErrorApi } from "@rybosome/tspice-backend-contract";
import { createErrorApi } from "../src/domains/error.js";
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
  // Emscripten replaces lazy aliases on first use. Capture only the resolved functions.
  module._free(module._malloc(8));
  return module;
}

const probes: {
  name: string;
  count: number;
  run: (api: ErrorApi) => unknown;
  expected: unknown;
}[] = [
  {
    name: "errch",
    count: 3,
    run: (a) => a.errch("@", "kept"),
    expected: undefined,
  },
  {
    name: "errdp",
    count: 2,
    run: (a) => a.errdp("@", 0.75),
    expected: undefined,
  },
  {
    name: "errint",
    count: 2,
    run: (a) => a.errint("@", -7),
    expected: undefined,
  },
  { name: "qcktrc", count: 2, run: (a) => a.qcktrc(), expected: "TRACE" },
  { name: "return", count: 2, run: (a) => a.return(), expected: false },
  { name: "trcdep", count: 2, run: (a) => a.trcdep(), expected: 1 },
  { name: "trcnam", count: 2, run: (a) => a.trcnam(0), expected: "TRACE" },
];
for (const probe of probes) {
  for (let fail = 0; fail <= probe.count; fail++) {
    it(probe.name + " on the real heap, allocation " + fail, async () => {
      const module = await actualModule();
      const api = createErrorApi(module);
      api.chkin("TRACE");
      try {
        api.setmsg("prepared @");
        const malloc = module._malloc,
          free = module._free;
        const live = new Set<number>();
        let ordinal = 0;
        module._malloc = (n: number) => {
          ordinal++;
          if (ordinal === fail) return 0;
          const p = malloc(n);
          if (p) live.add(p);
          return p;
        };
        module._free = (p: number) => {
          expect(live.delete(p)).toBe(true);
          free(p);
        };
        try {
          if (fail) expect(() => probe.run(api)).toThrow(/alloc/i);
          else expect(probe.run(api)).toEqual(probe.expected);
          expect(live.size).toBe(0);
        } finally {
          module._malloc = malloc;
          module._free = free;
        }
        if (fail) expect(api.getmsg("LONG")).toBe("prepared @");
        expect(api.trcnam(0)).toBe("TRACE");
        expect(api.failed()).toBe(false);
      } finally {
        api.chkout("TRACE");
        api.reset();
      }
    });
  }
}
