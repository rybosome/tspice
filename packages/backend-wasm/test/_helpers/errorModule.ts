import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { assertEmscriptenModule } from "../../src/lowlevel/exports.js";

/** Instantiate a fresh real toolkit, including independent irreversible error policy. */
export async function actualModule() {
  const assets = new URL("../../emscripten/", import.meta.url);
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
