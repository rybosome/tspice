import { describe, expect, it } from "vitest";

import { createWasmBackend } from "@rybosome/tspice-backend-wasm";

describe("@rybosome/tspice-backend-wasm", () => {
  it("creates a backend", () => {
    const backend = createWasmBackend();
    expect(backend.kind).toBe("wasm");
    expect(backend.spiceVersion()).toBe("wasm-stub");
  });
});
