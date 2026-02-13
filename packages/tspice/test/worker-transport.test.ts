import { describe, expect, it } from "vitest";

import type { SpiceTransport } from "../src/transport/types.js";
import { nextMacrotask } from "../src/transport/rpc/taskScheduling.js";
import { createWorkerTransport } from "../src/worker/transport/createWorkerTransport.js";
import { exposeTransportToWorker } from "../src/worker/transport/exposeTransportToWorker.js";

import { createConnectedWorkerPair } from "./_helpers/fakeWorker.js";

describe("worker transport", () => {
  it("resolves responses on a later macrotask", async () => {
    const { worker, scope } = createConnectedWorkerPair();

    const server: SpiceTransport = {
      request: async (op, args) => ({ op, args }),
    };
    exposeTransportToWorker({ transport: server, self: scope, closeOnDispose: false });

    const transport = createWorkerTransport({ worker: () => worker });

    let settled = false;
    const p = transport.request("raw.echo", [1, "two"]).then((v) => {
      settled = true;
      return v;
    });

    // Receiving a response in the same tick should not synchronously settle.
    await Promise.resolve();
    expect(settled).toBe(false);

    await nextMacrotask();
    expect(settled).toBe(true);

    await expect(p).resolves.toEqual({ op: "raw.echo", args: [1, "two"] });
    transport.dispose();
  });

  it("dispose() deterministically wins over a same-tick response", async () => {
    const { worker, scope } = createConnectedWorkerPair();

    const server: SpiceTransport = {
      request: async () => "ok",
    };
    exposeTransportToWorker({ transport: server, self: scope, closeOnDispose: false });

    const transport = createWorkerTransport({ worker: () => worker });

    const p = transport.request("raw.ok", []);
    transport.dispose();

    await expect(p).rejects.toThrow(/disposed/i);

    // Termination is deferred by one macrotask.
    await nextMacrotask();
    expect(worker.terminated).toBe(true);
  });

  it("supports backpressure queue overflow errors (maxConcurrentRequests/maxQueuedRequests)", async () => {
    const { worker, scope } = createConnectedWorkerPair();

    let resolveFirst!: (v: unknown) => void;
    const firstPromise = new Promise((r) => {
      resolveFirst = r;
    });

    const server: SpiceTransport = {
      request: async (op) => {
        if (op === "raw.first") return await firstPromise;
        return "ok";
      },
    };

    exposeTransportToWorker({
      transport: server,
      self: scope,
      closeOnDispose: false,
      maxConcurrentRequests: 1,
      maxQueuedRequests: 0,
    });

    const transport = createWorkerTransport({ worker: () => worker });

    const p1 = transport.request("raw.first", []);
    const p2 = transport.request("raw.second", []);

    await expect(p2).rejects.toThrow(/queue overflow/i);

    resolveFirst("done");
    await expect(p1).resolves.toBe("done");

    transport.dispose();
  });
});
