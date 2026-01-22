import { describe, it } from "vitest";

import { createBackend } from "@rybosome/tspice";

describe("createBackend() types", () => {
  it("exposes wasm-only helpers only on wasm backend", async () => {
    const wasmBackend = await createBackend({ backend: "wasm" });
    // If overloads are correct, this should typecheck.
    wasmBackend.loadKernel;
    wasmBackend.writeFile;

    const nodeBackend = await createBackend({ backend: "node" });
    // If overloads are correct, these should *not* typecheck.
    // @ts-expect-error wasm-only helper not present on node backend
    nodeBackend.loadKernel;
    // @ts-expect-error wasm-only helper not present on node backend
    nodeBackend.writeFile;
  });
});
