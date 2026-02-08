export type CreateWasmBackendOptions = {
  wasmUrl?: string | URL;

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
