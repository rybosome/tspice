import { describe, expect, it } from "vitest";

import type { SpiceTransport } from "../src/transport/types.js";
import { tspiceRpcRequestType, tspiceRpcResponseType } from "../src/transport/rpc/protocol.js";
import { nextMacrotask } from "../src/transport/rpc/taskScheduling.js";
import { createWorkerTransport } from "../src/worker/transport/createWorkerTransport.js";
import { exposeTransportToWorker } from "../src/worker/transport/exposeTransportToWorker.js";

import {
  FakeWorker,
  FakeWorkerGlobalScope,
  createConnectedWorkerPair,
} from "./_helpers/fakeWorker.js";

const getRejectedError = async (promise: Promise<unknown>): Promise<Error> => {
  try {
    await promise;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
  throw new Error("Expected promise to reject");
};

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

  it("classifies malformed worker responses as internal protocol failures", async () => {
    const worker = new FakeWorker();
    worker.onPostMessage = (message) => {
      const req = message as { id: number };
      worker.dispatch("message", {
        data: {
          type: tspiceRpcResponseType,
          id: req.id,
          ok: true,
          // Intentionally missing `value`.
        },
      });
    };

    const transport = createWorkerTransport({ worker: () => worker });

    const error = await getRejectedError(transport.request("kit.toolkitVersion", []));

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain("Internal worker RPC protocol error");
    expect(error.message).toContain('op="kit.toolkitVersion"');
    expect(error.message).toContain("id=1");
    expect(error.message).toContain("Expected:");
    expect(error.message).toContain("Got:");
    expect(error.message).toContain("Hint:");

    transport.dispose();
  });

  it("classifies messageerror failures as internal transport/protocol failures", async () => {
    const worker = new FakeWorker();
    worker.onPostMessage = () => {
      // Keep the request pending until `messageerror` is dispatched.
    };

    const transport = createWorkerTransport({ worker: () => worker });

    const request = transport.request("raw.echo", []);
    worker.dispatch("messageerror", {});

    const error = await getRejectedError(request);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain("Internal worker RPC protocol error");
    expect(error.message).toContain("worker message deserialization failed");
    expect(error.message).toContain('op="raw.echo"');
    expect(error.message).toContain("id=1");
    expect(error.message).toContain("Expected:");
    expect(error.message).toContain("Got:");

    transport.dispose();
  });

  it("returns an internal protocol error for malformed request packets with an id", async () => {
    const scope = new FakeWorkerGlobalScope();
    const postedMessages: unknown[] = [];
    scope.onPostMessage = (msg) => {
      postedMessages.push(msg);
    };

    const server: SpiceTransport = {
      request: async () => "ok",
    };

    exposeTransportToWorker({ transport: server, self: scope, closeOnDispose: false });

    scope.dispatchMessageFromMain({
      type: tspiceRpcRequestType,
      id: 7,
      op: "raw.echo",
      // Intentionally malformed: missing args array.
    });

    expect(postedMessages).toHaveLength(1);

    const response = postedMessages[0] as {
      type: string;
      id: number;
      ok: boolean;
      error?: { message?: string };
    };

    expect(response.type).toBe(tspiceRpcResponseType);
    expect(response.id).toBe(7);
    expect(response.ok).toBe(false);
    expect(response.error?.message).toContain("Internal worker RPC protocol error");
    expect(response.error?.message).toContain('op="raw.echo"');
    expect(response.error?.message).toContain("id=7");
    expect(response.error?.message).toContain("Expected:");
    expect(response.error?.message).toContain("Got:");
    expect(response.error?.message).toContain("Hint:");
  });

  it("does not throw if posting malformed-request errors fails", () => {
    const scope = new FakeWorkerGlobalScope();
    scope.onPostMessage = () => {
      throw new Error("postMessage failed");
    };

    const server: SpiceTransport = {
      request: async () => "ok",
    };

    exposeTransportToWorker({ transport: server, self: scope, closeOnDispose: false });

    expect(() => {
      scope.dispatchMessageFromMain({
        type: tspiceRpcRequestType,
        id: 8,
        op: "raw.echo",
        // Intentionally malformed: missing args array.
      });
    }).not.toThrow();
  });
});
