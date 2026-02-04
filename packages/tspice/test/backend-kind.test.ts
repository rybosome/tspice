import { describe, expect, it, vi } from "vitest";

vi.mock("@rybosome/tspice-backend-node", () => {
  return {
    createNodeBackend: () => {
      return {
        kind: "node",
        spiceVersion: () => "mock-node",
      };
    },
  };
});

vi.mock("@rybosome/tspice-backend-wasm", () => {
  return {
    createWasmBackend: async () => {
      return {
        kind: "wasm",
        spiceVersion: () => "mock-wasm",
      };
    },
  };
});

import { createBackend } from "@rybosome/tspice";

describe("createBackend()", () => {
  it("adds kind=\"node\"", async () => {
    const backend = await createBackend({ backend: "node" });
    expect(backend.kind).toBe("node");
  });

  it("adds kind=\"wasm\"", async () => {
    const backend = await createBackend({ backend: "wasm" });
    expect(backend.kind).toBe("wasm");
  });
});
