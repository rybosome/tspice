export const WASM_WEB_JS_FILENAME = "tspice_backend_wasm.web.js";
export const WASM_NODE_JS_FILENAME = "tspice_backend_wasm.node.js";
export const WASM_BINARY_FILENAME = "tspice_backend_wasm.wasm";

/** Replace literal quoted Emscripten filenames without treating their characters as regex syntax. */
export function rewriteQuotedWasmBasename(source, oldBasename, newBasename) {
  const escaped = oldBasename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(['"])${escaped}\\1`, "g");
  return source.replace(
    pattern,
    (_match, quote) => `${quote}${newBasename}${quote}`,
  );
}
