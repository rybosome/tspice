import { describe, expect, it } from "vitest";

import type { SpiceTransport } from "../src/transport/types.js";
import { nextMacrotask } from "../src/transport/rpc/taskScheduling.js";
import { spiceClients } from "../src/clients/spiceClients.js";
import { kernels } from "../src/kernels/kernels.js";
import { exposeTransportToWorker } from "../src/worker/transport/exposeTransportToWorker.js";

import { createConnectedWorkerPair } from "./_helpers/fakeWorker.js";

describe("spiceClients cleanup", () => {
  it("toWebWorker() disposes an owned worker when kernel preload fails", async () => {
    const { worker, scope } = createConnectedWorkerPair();

    const server: SpiceTransport = {
      request: async (op) => {
        if (op === "kit.toolkitVersion") return "TSPICE_TEST";
        throw new Error(`Unexpected op: ${op}`);
      },
    };
    exposeTransportToWorker({ transport: server, self: scope, closeOnDispose: false });

    const originalFetch = (globalThis as unknown as { fetch?: unknown }).fetch;
    (globalThis as unknown as { fetch: unknown }).fetch = async () => ({
      ok: false,
      status: 404,
      statusText: "Not Found",
      arrayBuffer: async () => new ArrayBuffer(0),
    });

    try {
      await expect(
        spiceClients
          .withKernel(
            kernels.custom().add({ url: "https://example.com/missing-kernel.tls" }).pack(),
          )
          .toWebWorker({ worker: () => worker }),
      ).rejects.toThrow(/Failed to fetch kernel/i);
    } finally {
      if (originalFetch === undefined) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete (globalThis as unknown as { fetch?: unknown }).fetch;
      } else {
        (globalThis as unknown as { fetch: unknown }).fetch = originalFetch;
      }
    }

    // Worker termination is deferred by a macrotask.
    await nextMacrotask();
    expect(worker.terminated).toBe(true);
  });
});
