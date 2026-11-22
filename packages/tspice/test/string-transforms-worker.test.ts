import { expect, it, vi } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { createConnectedWorkerPair } from "./_helpers/fakeWorker.js";

it("discovers raw strings through worker metadata and preserves their bytes, indices and errors over RPC", async () => {
  const { worker, scope } = createConnectedWorkerPair();
  worker.onPostMessage = (message) =>
    scope.dispatchMessageFromMain(structuredClone(message));
  scope.onPostMessage = (message) =>
    worker.dispatch("message", { data: structuredClone(message) });
  vi.stubGlobal("addEventListener", scope.addEventListener.bind(scope));
  vi.stubGlobal("removeEventListener", scope.removeEventListener.bind(scope));
  vi.stubGlobal("postMessage", scope.postMessage.bind(scope));
  vi.stubGlobal("close", scope.close.bind(scope));
  try {
    // Load the production worker entry on this isolated message channel. It
    // discovers the WASM facade and supplies the production metadata and RPC endpoint.
    await import("../src/worker/browser/spiceWorkerEntry.js");
    const { spice, dispose } = await spiceClients.toWebWorker({
      worker: () => worker,
    });
    try {
      const raw = spice.raw;
      expect(await raw.ucase("éAz \t")).toBe("éAZ \t");
      expect(await raw.lcase("A\uFEFF  ")).toBe("a\uFEFF  ");
      expect(await raw.cmprss(" ", 1, "a   b  ")).toBe("a b ");
      expect(await raw.lastnb("é  ")).toBe(1);
      expect(await raw.eqstr(" a\tB", "Ab")).toBe(true);
      expect(await raw.iswhsp(" \t\n")).toBe(true);
      expect(await raw.matchi("aB", "A?", "*", "?")).toBe(true);
      expect(await raw.matchw("aB", "A?", "*", "?")).toBe(false);
      await expect(raw.matchw("", "*", "*", "?")).rejects.toThrow(
        /EMPTYSTRING/,
      );
      expect(await raw.failed()).toBe(false);
    } finally {
      await dispose();
      // The client can terminate before the endpoint finishes clearing its state.
      await vi.waitFor(() => expect(scope.closed).toBe(true));
    }
  } finally {
    vi.unstubAllGlobals();
  }
});
