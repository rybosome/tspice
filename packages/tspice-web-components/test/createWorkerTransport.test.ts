import { afterEach, describe, expect, it, vi } from "vitest";

type WorkerLike = import("@rybosome/tspice-web-components").WorkerLike;

type Listener = (ev: unknown) => void;

class FakeWorker implements WorkerLike {
  terminated = false;
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
    this.terminated = true;
  }

  emit(type: string, ev: unknown): void {
    for (const listener of Array.from(this.listeners.get(type) ?? [])) listener(ev);
  }

  emitMessage(data: unknown): void {
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
    const transport = createWorkerTransport({ worker: () => w });

    const p = transport.request("kit.utcToEt", ["2026-01-01T00:00:00Z"]);

    const posted = w.posted[0] as { id: number };
    expect(posted).toMatchObject({ type: "tspice:request", op: "kit.utcToEt" });

    w.emitMessage({ type: "tspice:response", id: posted.id, ok: true, value: 123 });

    await expect(p).resolves.toBe(123);

    transport.dispose();
    // Termination is deferred by 1 macrotask to give the dispose postMessage a
    // chance to be processed.
    await new Promise((r) => setTimeout(r, 0));
    expect(w.terminated).toBe(true);
  });

  it("lets dispose() win over an already-received response message", async () => {
    const { createWorkerTransport } = await import(
      /* @vite-ignore */ "@rybosome/tspice-web-components"
    );

    vi.useFakeTimers();

    const w = new FakeWorker();
    const transport = createWorkerTransport({ worker: () => w });

    const p = transport.request("op", []);
    const posted = w.posted[0] as { id: number };

    // The transport defers settling by 1 macrotask to avoid a dispose-vs-message race.
    w.emitMessage({ type: "tspice:response", id: posted.id, ok: true, value: 123 });
    expect(vi.getTimerCount()).toBe(1);
    transport.dispose();
    expect(vi.getTimerCount()).toBe(0);

    // Attach a handler immediately to avoid an unhandled rejection warning.
    const expectation = expect(p).rejects.toThrow(/disposed/i);

    await vi.runAllTimersAsync();
    await expectation;
    expect(w.terminated).toBe(true);
  });

  it("batches response settlements into a single macrotask", async () => {
    const { createWorkerTransport } = await import(
      /* @vite-ignore */ "@rybosome/tspice-web-components"
    );

    vi.useFakeTimers();

    const w = new FakeWorker();
    const transport = createWorkerTransport({ worker: () => w });

    const p1 = transport.request("op1", []);
    const posted1 = w.posted[0] as { id: number };

    const p2 = transport.request("op2", []);
    const posted2 = w.posted[1] as { id: number };

    w.emitMessage({ type: "tspice:response", id: posted1.id, ok: true, value: 1 });
    expect(vi.getTimerCount()).toBe(1);

    w.emitMessage({ type: "tspice:response", id: posted2.id, ok: true, value: 2 });
    // Still just one settlement macrotask scheduled for this tick.
    expect(vi.getTimerCount()).toBe(1);

    await vi.runAllTimersAsync();

    await expect(p1).resolves.toBe(1);
    await expect(p2).resolves.toBe(2);

    transport.dispose();
  });

  it("rejects and cleans up on timeout", async () => {
    const { createWorkerTransport } = await import(
      /* @vite-ignore */ "@rybosome/tspice-web-components"
    );

    vi.useFakeTimers();

    const w = new FakeWorker();
    const transport = createWorkerTransport({ worker: () => w, timeoutMs: 10 });

    const p = transport.request("op", []);

    vi.advanceTimersByTime(11);

    await expect(p).rejects.toThrow(/timed out.*op=op.*id=\d+/i);

    transport.dispose();
  });

  it("supports per-request abort", async () => {
    const { createWorkerTransport } = await import(
      /* @vite-ignore */ "@rybosome/tspice-web-components"
    );

    const w = new FakeWorker();
    const transport = createWorkerTransport({ worker: () => w });

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
    const transport = createWorkerTransport({ worker: () => w });

    const p = transport.request("op", []);
    transport.dispose();

    await expect(p).rejects.toThrow(/disposed/i);
    // Termination is deferred by 1 macrotask to give the dispose postMessage a
    // chance to be processed.
    await new Promise((r) => setTimeout(r, 0));
    expect(w.terminated).toBe(true);
  });

  it("rejects malformed response messages (ok=true missing value)", async () => {
    const { createWorkerTransport } = await import(
      /* @vite-ignore */ "@rybosome/tspice-web-components"
    );

    vi.useFakeTimers();

    const w = new FakeWorker();
    const transport = createWorkerTransport({ worker: () => w });

    const p = transport.request("op", []);
    const posted = w.posted[0] as { id: number };

    // Missing `value` should reject immediately (next macrotask) with a helpful error.
    w.emitMessage({ type: "tspice:response", id: posted.id, ok: true });

    const expectation = expect(p).rejects.toThrow(
      new RegExp(`malformed.*\\(op=op, id=${posted.id}\\)`, "i"),
    );

    await vi.runAllTimersAsync();
    await expectation;

    transport.dispose();
  });

});
