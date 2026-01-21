import { describe, expect, it } from "vitest";

import { createBackend } from "@rybosome/tspice";

describe("@rybosome/tspice", () => {
  it("defaults to wasm backend", async () => {
    const backend = await createBackend();
    expect(backend.kind).toBe("wasm");
  });
});
