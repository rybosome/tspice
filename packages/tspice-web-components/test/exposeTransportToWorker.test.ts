import { describe, expect, it, vi } from "vitest";

type Listener = (ev: any) => void;

class FakeWorkerSelf {
  posted: any[] = [];
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

  postMessage(msg: any): void {
    this.posted.push(msg);
  }

  close(): void {
    this.closed = true;
  }

  emitMessage(data: any): void {
    for (const listener of this.listeners) {
      listener({ data });
    }
  }
}

const flush = async (): Promise<void> => {
  await new Promise((r) => setTimeout(r, 0));
};

describe("exposeTransportToWorker()", () => {
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
      type: "tspice:request",
      id: 1,
      op: "kit.utcToEt",
      args: ["2026-01-01T00:00:00Z"],
    });

    await flush();

    expect(transport.request).toHaveBeenCalledWith("kit.utcToEt", ["2026-01-01T00:00:00Z"]);
    expect(self.posted[0]).toMatchObject({
      type: "tspice:response",
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

    self.emitMessage({ type: "tspice:request", id: 2, op: "op", args: [] });
    await flush();

    expect(self.posted[0]).toMatchObject({
      type: "tspice:response",
      id: 2,
      ok: false,
      error: { message: "nope" },
    });

    self.emitMessage({ type: "tspice:dispose" });
    await flush();

    expect(onDispose).toHaveBeenCalledTimes(1);
    expect(self.closed).toBe(true);
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
      type: "tspice:request",
      id: 1,
      op: "kit.utcToEt",
      args: [],
    });

    // Dispose before the request resolves.
    self.emitMessage({ type: "tspice:dispose" });

    resolveRequest?.(123);
    await flush();

    expect(transport.request).toHaveBeenCalledTimes(1);
    expect(self.posted).toHaveLength(0);
  });
});
