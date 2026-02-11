import { afterEach, describe, expect, it, vi } from "vitest";

type WorkerLike = import("@rybosome/tspice-web-components").WorkerLike;

type Listener = (ev: unknown) => void;

class FakeWorker implements WorkerLike {
  posted: unknown[] = [];
  private listeners = new Map<string, Set<Listener>>();

  addEventListener(type: string, listener: Listener): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  postMessage(msg: unknown): void {
    this.posted.push(msg);
  }

  terminate(): void {
    // no-op
  }
}

const tick = async (): Promise<void> => {
  await new Promise((r) => setTimeout(r, 0));
};

describe("createSpiceWorkerClient()", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs both disposal error and onDisposeError error", async () => {
    const { createSpiceWorkerClient } = await import(
      /* @vite-ignore */ "@rybosome/tspice-web-components"
    );

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const w = new FakeWorker();

    const disposeErr = new Error("wrapper dispose failed");
    const onDisposeErr = new Error("onDisposeError blew up");

    const client = createSpiceWorkerClient({
      worker: () => w as unknown as Worker,
      terminateOnDispose: false,
      wrapTransport: (base) =>
        ({
          request: base.request.bind(base),
          dispose: async () => {
            throw disposeErr;
          },
        }) as unknown as typeof base,
      onDisposeError: () => {
        throw onDisposeErr;
      },
    });

    client.dispose();
    await tick();

    expect(consoleError).toHaveBeenCalledTimes(2);
    expect(consoleError.mock.calls[0]?.[0]).toMatch(/disposeAsync\(\) failed/i);
    expect(consoleError.mock.calls[0]?.[1]).toBe(disposeErr);
    expect(consoleError.mock.calls[1]?.[0]).toMatch(/onDisposeError threw/i);
    expect(consoleError.mock.calls[1]?.[1]).toBe(onDisposeErr);
  });
});
