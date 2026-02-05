import type { EmscriptenModule } from "../lowlevel/exports.js";

import { mallocOrThrow } from "./alloc.js";

export function writeUtf8CString(module: EmscriptenModule, value: string): number {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(value);
  const ptr = mallocOrThrow(module, encoded.length + 1);
  module.HEAPU8.set(encoded, ptr);
  module.HEAPU8[ptr + encoded.length] = 0;
  return ptr;
}
