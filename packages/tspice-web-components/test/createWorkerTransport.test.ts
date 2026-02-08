import { afterEach, describe, expect, it, vi } from "vitest";

type Listener = (ev: any) => void;

class FakeWorker {
  terminated = false;
  posted: any[] = [];

  private listeners = new Map<string, Set<Listener>>();

  addEventListener(type: string, listener: Listener): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  postMessage(msg: any): void {
    this.posted.push(msg);
  }

  terminate(): void {
    this.terminated = true;
  }

  emit(type: string, ev: any): void {
    for (const listener of this.listeners.get(type) ?? []) listener(ev);
  }

  emitMessage(data: any): void {
    this.emit("message", { data });
  }

  emitError(message: string): void {
    this.emit("error", { message });
  }

  emitMessageError(): void {
    this.emit("messageerror", { data: null });
  }
}

describe("createWorkerTransport()", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("resolves requests via postMessage round-trip", async () => {
    const { createWorkerTransport } = await import(
      /* @vite-ignore */ "@rybosome/tspice-web-components"
    );

    const w = new FakeWorker();
    const transport = createWorkerTransport({ worker: () => w as any });

    const p = transport.request("kit.utcToEt", ["2026-01-01T00:00:00Z"]);

    const posted = w.posted[0];
    expect(posted).toMatchObject({ type: "tspice:request", op: "kit.utcToEt" });

    w.emitMessage({ type: "tspice:response", id: posted.id, ok: true, value: 123 });

    await expect(p).resolves.toBe(123);

    transport.dispose();
    expect(w.terminated).toBe(true);
  });

  it("rejects and cleans up on timeout", async () => {
    const { createWorkerTransport } = await import(
      /* @vite-ignore */ "@rybosome/tspice-web-components"
    );

    vi.useFakeTimers();

    const w = new FakeWorker();
    const transport = createWorkerTransport({ worker: () => w as any, timeoutMs: 10 });

    const p = transport.request("op", []);

    vi.advanceTimersByTime(11);

    await expect(p).rejects.toThrow(/timed out/i);

    transport.dispose();
  });

  it("supports per-request abort", async () => {
    const { createWorkerTransport } = await import(
      /* @vite-ignore */ "@rybosome/tspice-web-components"
    );

    const w = new FakeWorker();
    const transport = createWorkerTransport({ worker: () => w as any });

    const ac = new AbortController();
    const p = transport.request("op", [], { signal: ac.signal });

    ac.abort();

    await expect(p).rejects.toMatchObject({ name: "AbortError" });

    transport.dispose();
  });

  it("rejects pending requests on dispose", async () => {
    const { createWorkerTransport } = await import(
      /* @vite-ignore */ "@rybosome/tspice-web-components"
    );

    const w = new FakeWorker();
    const transport = createWorkerTransport({ worker: () => w as any });

    const p = transport.request("op", []);
    transport.dispose();

    await expect(p).rejects.toThrow(/disposed/i);
    expect(w.terminated).toBe(true);
  });
});
