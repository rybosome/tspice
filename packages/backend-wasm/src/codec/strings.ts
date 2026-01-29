import type { EmscriptenModule } from "../lowlevel/exports.js";

export function writeUtf8CString(module: EmscriptenModule, value: string): number {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(value);
  const ptr = module._malloc(encoded.length + 1);
  if (!ptr) {
    throw new Error("WASM malloc failed");
  }
  module.HEAPU8.set(encoded, ptr);
  module.HEAPU8[ptr + encoded.length] = 0;
  return ptr;
}
