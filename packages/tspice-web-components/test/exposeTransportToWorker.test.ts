import { describe, expect, it, vi } from "vitest";

import type { RpcMessageFromMain, RpcMessageFromWorker } from "../src/worker/rpcProtocol.js";
import {
  tspiceRpcDisposeType,
  tspiceRpcRequestType,
  tspiceRpcResponseType,
} from "../src/worker/rpcProtocol.js";

type Listener = (ev: MessageEvent<unknown>) => void;

class FakeWorkerSelf {
  posted: RpcMessageFromWorker[] = [];
  closed = false;

  private listeners = new Set<Listener>();

  addEventListener(type: "message", listener: Listener): void {
    if (type !== "message") return;
    this.listeners.add(listener);
  }

  removeEventListener(type: "message", listener: Listener): void {
    if (type !== "message") return;
    this.listeners.delete(listener);
  }

  postMessage(msg: unknown): void {
    this.posted.push(msg as RpcMessageFromWorker);
  }

  close(): void {
    this.closed = true;
  }

  emitMessage(data: RpcMessageFromMain): void {
    for (const listener of this.listeners) {
      listener({ data } as MessageEvent<RpcMessageFromMain>);
    }
  }
}

const flush = async (): Promise<void> => {
  await new Promise((r) => setTimeout(r, 0));
};

describe("exposeTransportToWorker()", () => {
  it("throws for invalid maxConcurrentRequests values", async () => {
    const { exposeTransportToWorker } = await import(
      /* @vite-ignore */ "@rybosome/tspice-web-components"
    );

    const self = new FakeWorkerSelf();
    const transport = { request: vi.fn(async () => 123) };

    for (const maxConcurrentRequests of [0, -1, Number.NaN, 1.5]) {
      expect(() =>
        exposeTransportToWorker({
          transport,
          self,
          closeOnDispose: false,
          // @ts-expect-error - intentional invalid values
          maxConcurrentRequests,
        }),
      ).toThrow(/maxConcurrentRequests/i);
    }
  });

  it("serves requests over the tspice worker RPC protocol", async () => {
    const { exposeTransportToWorker } = await import(
      /* @vite-ignore */ "@rybosome/tspice-web-components"
    );

    const self = new FakeWorkerSelf();

    const transport = {
      request: vi.fn(async () => 123),
    };

    exposeTransportToWorker({ transport, self, closeOnDispose: false });

    self.emitMessage({
      type: tspiceRpcRequestType,
      id: 1,
      op: "kit.utcToEt",
      args: ["2026-01-01T00:00:00Z"],
    });

    await flush();

    expect(transport.request).toHaveBeenCalledWith("kit.utcToEt", ["2026-01-01T00:00:00Z"]);
    expect(self.posted[0]).toMatchObject({
      type: tspiceRpcResponseType,
      id: 1,
      ok: true,
      value: 123,
    });
  });

  it("serializes errors and supports dispose", async () => {
    const { exposeTransportToWorker } = await import(
      /* @vite-ignore */ "@rybosome/tspice-web-components"
    );

    const self = new FakeWorkerSelf();

    const transport = {
      request: vi.fn(async () => {
        throw new Error("nope");
      }),
    };

    const onDispose = vi.fn();

    exposeTransportToWorker({ transport, self, onDispose });

    self.emitMessage({ type: tspiceRpcRequestType, id: 2, op: "op", args: [] });
    await flush();

    expect(self.posted[0]).toMatchObject({
      type: tspiceRpcResponseType,
      id: 2,
      ok: false,
      error: { message: "nope" },
    });

    self.emitMessage({ type: tspiceRpcDisposeType });
    await flush();

    expect(onDispose).toHaveBeenCalledTimes(1);
    expect(self.closed).toBe(true);
  });

  it("applies maxConcurrentRequests backpressure (FIFO)", async () => {
    const { exposeTransportToWorker } = await import(
      /* @vite-ignore */ "@rybosome/tspice-web-components"
    );

    const self = new FakeWorkerSelf();

    let resolve1: ((value: number) => void) | undefined;
    let resolve2: ((value: number) => void) | undefined;

    const transport = {
      request: vi
        .fn()
        .mockImplementationOnce(
          async () =>
            await new Promise<number>((resolve) => {
              resolve1 = resolve;
            }),
        )
        .mockImplementationOnce(
          async () =>
            await new Promise<number>((resolve) => {
              resolve2 = resolve;
            }),
        ),
    };

    exposeTransportToWorker({
      transport,
      self,
      closeOnDispose: false,
      maxConcurrentRequests: 1,
    });

    self.emitMessage({ type: tspiceRpcRequestType, id: 1, op: "op1", args: [] });
    self.emitMessage({ type: tspiceRpcRequestType, id: 2, op: "op2", args: [] });

    // Second request should be queued until the first settles.
    expect(transport.request).toHaveBeenCalledTimes(1);

    resolve1?.(111);
    await flush();

    // Once the first settles, the queued request should begin.
    expect(transport.request).toHaveBeenCalledTimes(2);

    resolve2?.(222);
    await flush();

    expect(self.posted).toMatchObject([
      { type: tspiceRpcResponseType, id: 1, ok: true, value: 111 },
      { type: tspiceRpcResponseType, id: 2, ok: true, value: 222 },
    ]);
  });

  it("does not post responses after dispose", async () => {
    const { exposeTransportToWorker } = await import(
      /* @vite-ignore */ "@rybosome/tspice-web-components"
    );

    const self = new FakeWorkerSelf();

    let resolveRequest: ((value: number) => void) | undefined;

    const transport = {
      request: vi.fn(async () =>
        await new Promise<number>((resolve) => {
          resolveRequest = resolve;
        }),
      ),
    };

    exposeTransportToWorker({ transport, self, closeOnDispose: false });

    self.emitMessage({
      type: tspiceRpcRequestType,
      id: 1,
      op: "kit.utcToEt",
      args: [],
    });

    // Dispose before the request resolves.
    self.emitMessage({ type: tspiceRpcDisposeType });

    resolveRequest?.(123);
    await flush();

    expect(transport.request).toHaveBeenCalledTimes(1);
    expect(self.posted).toHaveLength(0);
  });
});
