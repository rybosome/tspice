import { describe, it } from "vitest";

import { createBackend } from "@rybosome/tspice";

describe("createBackend() types", () => {
  it("exposes wasm-only helpers only on wasm backend", async () => {
    // This test is about TypeScript types, not runtime behavior.
    //
    // In JS-only CI we intentionally do not build the native backend, so
    // `createBackend({ backend: "node" })` may fail at runtime.
    //
    // Wrap in a dead-code branch so TS still typechecks the overloads.
    if (false) {
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
    }
  });
});
