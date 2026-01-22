import { describe, expect, it } from "vitest";

import { createBackend } from "@rybosome/tspice";

describe("@rybosome/tspice", () => {
  it.runIf(process.arch !== "arm64")("defaults to node backend", async () => {
    const backend = await createBackend();
    expect(backend.kind).toBe("node");
  });
});
