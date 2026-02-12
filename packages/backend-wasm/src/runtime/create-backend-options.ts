export type CreateWasmBackendOptions = {
  wasmUrl?: string | URL;

  /**
   * (Node-only) If the default `dist/**` wasm binary appears invalid/partial,
   * `createWasmBackend()` can fall back to the checked-in Emscripten artifact.
   *
   * By default, the loader does **not** attempt to write the fallback bytes
   * back into `dist/**` (to avoid surprising mutations and to support
   * read-only checkouts). Set this to `true` to opt into a best-effort repair
   * (`writeFile(tmp)` + `rename(tmp, distWasmPath)`).
   *
   * Defaults to `false`.
   */
  repairInvalidDistWasm?: boolean;

  /**
   * Validate that the loaded Emscripten module exports the expected symbols.
   *
   * Defaults to `true`.
   *
   * This exists as an escape hatch for local development when checked-in
   * Emscripten artifacts (glue JS / wasm) temporarily lag behind source.
   */
  validateEmscriptenModule?: boolean;
};
