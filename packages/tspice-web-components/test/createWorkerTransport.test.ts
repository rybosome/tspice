import { afterEach, describe, expect, it, vi } from "vitest";

import { nextMacrotask } from "../src/worker/taskScheduling.js";

type WorkerLike = import("@rybosome/tspice-web-components").WorkerLike;

type Listener = (ev: unknown) => void;

class FakeWorker implements WorkerLike {
  terminated = false;
  posted: unknown[] = [];
  calls: string[] = [];

  private listeners = new Map<string, Set<Listener>>();

  addEventListener(type: string, listener: Listener): void {
    this.calls.push(`addEventListener:${type}`);
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.calls.push(`removeEventListener:${type}`);
    this.listeners.get(type)?.delete(listener);
  }

  postMessage(msg: unknown): void {
    this.calls.push("postMessage");
    this.posted.push(msg);
  }

  terminate(): void {
    this.calls.push("terminate");
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
    const transport = createWorkerTransport({ worker: () => w, terminateOnDispose: false });

    const p = transport.request("kit.utcToEt", ["2026-01-01T00:00:00Z"]);

    const posted = w.posted[0] as { id: number };
    expect(posted).toMatchObject({ type: "tspice:request", op: "kit.utcToEt" });

    w.emitMessage({ type: "tspice:response", id: posted.id, ok: true, value: 123 });

    await expect(p).resolves.toBe(123);

    transport.dispose();
  });

  it("lets dispose() win over an already-received response message", async () => {
    const { createWorkerTransport } = await import(
      /* @vite-ignore */ "@rybosome/tspice-web-components"
    );

    const w = new FakeWorker();
    const transport = createWorkerTransport({ worker: () => w, terminateOnDispose: false });

    const p = transport.request("op", []);
    const posted = w.posted[0] as { id: number };

    // The transport defers settling by 1 macrotask to avoid a dispose-vs-message race.
    w.emitMessage({ type: "tspice:response", id: posted.id, ok: true, value: 123 });

    // Attach a handler immediately to avoid an unhandled rejection warning.
    const expectation = expect(p).rejects.toThrow(/disposed/i);

    transport.dispose();

    await expectation;

    // Let the queued settlement macrotask run (should be a no-op after dispose).
    await nextMacrotask();
  });

  it("batches response settlements into a single macrotask", async () => {
    const { createWorkerTransport } = await import(
      /* @vite-ignore */ "@rybosome/tspice-web-components"
    );

    vi.useFakeTimers();

    const originalMessageChannel = globalThis.MessageChannel;
    // Force `queueMacrotask()` to fall back to setTimeout so we can count the
    // single scheduled settlement task with fake timers.
    // @ts-expect-error - test override
    globalThis.MessageChannel = undefined;

    try {
      const w = new FakeWorker();
      const transport = createWorkerTransport({ worker: () => w, terminateOnDispose: false });

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
    } finally {
      // @ts-expect-error - restore
      globalThis.MessageChannel = originalMessageChannel;
    }
  });

  it("rejects and cleans up on timeout", async () => {
    const { createWorkerTransport } = await import(
      /* @vite-ignore */ "@rybosome/tspice-web-components"
    );

    vi.useFakeTimers();

    const w = new FakeWorker();
    const transport = createWorkerTransport({ worker: () => w, timeoutMs: 10, terminateOnDispose: false });

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
    const transport = createWorkerTransport({ worker: () => w, terminateOnDispose: false });

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
    const transport = createWorkerTransport({ worker: () => w, terminateOnDispose: false });

    const p = transport.request("op", []);

    transport.dispose();

    await expect(p).rejects.toThrow(/disposed/i);
  });

  it("signals dispose by default for owned workers", async () => {
    const { createWorkerTransport } = await import(
      /* @vite-ignore */ "@rybosome/tspice-web-components"
    );

    vi.useFakeTimers();

    const originalMessageChannel = globalThis.MessageChannel;
    // Ensure `queueMacrotask()` uses timers so we can deterministically flush termination.
    // @ts-expect-error - test override
    globalThis.MessageChannel = undefined;

    try {
      const w = new FakeWorker();
      const transport = createWorkerTransport({ worker: () => w });

      // Ensure the worker is constructed before disposing (the transport is lazy).
      const p = transport.request("op", []);
      // Attach handler before dispose to avoid unhandled rejections.
      const expectation = expect(p).rejects.toThrow(/disposed/i);

      transport.dispose();

      // Owned worker (factory): signalDispose defaults to true.
      expect(w.posted[w.posted.length - 1]).toEqual({ type: "tspice:dispose" });
      expect(w.terminated).toBe(false);

      await vi.runAllTimersAsync();
      await expectation;
      expect(w.terminated).toBe(true);
    } finally {
      // @ts-expect-error - restore
      globalThis.MessageChannel = originalMessageChannel;
    }
  });

  it("does not signal dispose by default for shared workers", async () => {
    const { createWorkerTransport } = await import(
      /* @vite-ignore */ "@rybosome/tspice-web-components"
    );

    const w = new FakeWorker();
    const transport = createWorkerTransport({ worker: w });

    const p = transport.request("op", []);
    transport.dispose();

    await expect(p).rejects.toThrow(/disposed/i);

    // Request postMessage only; no `tspice:dispose` signal for shared workers.
    expect(w.posted).toHaveLength(1);
    expect(w.terminated).toBe(false);

    await nextMacrotask();
    expect(w.terminated).toBe(false);
  });

  it("rejects malformed response messages (ok=true missing value)", async () => {
    const { createWorkerTransport } = await import(
      /* @vite-ignore */ "@rybosome/tspice-web-components"
    );

    vi.useFakeTimers();

    const originalMessageChannel = globalThis.MessageChannel;
    // Force `queueMacrotask()` to use setTimeout so we can flush deterministically.
    // @ts-expect-error - test override
    globalThis.MessageChannel = undefined;

    try {
      const w = new FakeWorker();
      const transport = createWorkerTransport({ worker: () => w, terminateOnDispose: false });

      const p = transport.request("op", []);
      const posted = w.posted[0] as { id: number };

      // Missing `value` should reject on the next macrotask with a helpful error.
      w.emitMessage({ type: "tspice:response", id: posted.id, ok: true });

      const expectation = expect(p).rejects.toThrow(
        new RegExp(`malformed.*\\(op=op, id=${posted.id}\\)`, "i"),
      );

      await vi.runAllTimersAsync();
      await expectation;

      transport.dispose();
    } finally {
      // @ts-expect-error - restore
      globalThis.MessageChannel = originalMessageChannel;
    }
  });

  it("rejects and cleans up on worker error", async () => {
    const { createWorkerTransport } = await import(
      /* @vite-ignore */ "@rybosome/tspice-web-components"
    );

    const w = new FakeWorker();
    const transport = createWorkerTransport({ worker: () => w, terminateOnDispose: false });

    const p = transport.request("op", []);

    w.emitError("Boom");

    await expect(p).rejects.toThrow(/boom.*op=op.*id=\d+/i);

    // Transport should become terminal: no further messages posted and all
    // future requests fail closed.
    const postedBefore = w.posted.length;

    const err1 = await transport.request("op2", []).catch((e) => e);
    const err2 = await transport.request("op3", []).catch((e) => e);
    expect(err1).toBe(err2);
    expect(err1).toMatchObject({ message: "Boom" });
    expect(w.posted).toHaveLength(postedBefore);

    // And listeners should be detached (no leaks).
    expect(w.calls).toContain("removeEventListener:message");
    expect(w.calls).toContain("removeEventListener:error");
    expect(w.calls).toContain("removeEventListener:messageerror");

    transport.dispose();
  });

  it("rejects and cleans up on messageerror", async () => {
    const { createWorkerTransport } = await import(
      /* @vite-ignore */ "@rybosome/tspice-web-components"
    );

    const w = new FakeWorker();
    const transport = createWorkerTransport({ worker: () => w, terminateOnDispose: false });

    const p = transport.request("op", []);

    w.emitMessageError();

    await expect(p).rejects.toThrow(/deserialization failed.*op=op.*id=\d+/i);

    // Transport should become terminal: no further messages posted and all
    // future requests fail closed.
    const postedBefore = w.posted.length;

    const err1 = await transport.request("op2", []).catch((e) => e);
    const err2 = await transport.request("op3", []).catch((e) => e);
    expect(err1).toBe(err2);
    expect(err1).toMatchObject({ message: "Worker message deserialization failed" });
    expect(w.posted).toHaveLength(postedBefore);

    // And listeners should be detached (no leaks).
    expect(w.calls).toContain("removeEventListener:message");
    expect(w.calls).toContain("removeEventListener:error");
    expect(w.calls).toContain("removeEventListener:messageerror");

    transport.dispose();
  });

  it("fails fast when no macrotask scheduler exists (before posting messages)", async () => {
    const { createWorkerTransport } = await import(
      /* @vite-ignore */ "@rybosome/tspice-web-components"
    );

    const originalMessageChannel = globalThis.MessageChannel;
    const originalSetTimeout = globalThis.setTimeout;
    // @ts-expect-error - test override
    globalThis.MessageChannel = undefined;
    // @ts-expect-error - test override
    globalThis.setTimeout = undefined;

    try {
      const w = new FakeWorker();
      const workerFactory = vi.fn(() => w);
      const transport = createWorkerTransport({ worker: workerFactory, terminateOnDispose: false });

      await expect(transport.request("op", [])).rejects.toThrow(/cannot schedule macrotask/i);

      // No worker should be constructed and no message posted.
      expect(workerFactory).toHaveBeenCalledTimes(0);
      expect(w.posted).toHaveLength(0);

      transport.dispose();
    } finally {
      // @ts-expect-error - restore
      globalThis.MessageChannel = originalMessageChannel;
      // @ts-expect-error - restore
      globalThis.setTimeout = originalSetTimeout;
    }
  });

  it("fails fast when MessageChannel exists but postMessage is broken", async () => {
    const { createWorkerTransport } = await import(
      /* @vite-ignore */ "@rybosome/tspice-web-components"
    );

    const originalMessageChannel = globalThis.MessageChannel;
    const originalSetTimeout = globalThis.setTimeout;

    // A MessageChannel that can be constructed but throws on `postMessage`.
    class BrokenMessageChannel {
      port1 = {
        onmessage: null as null | ((ev: unknown) => void),
        close: () => {},
      };
      port2 = {
        close: () => {},
        postMessage: () => {
          throw new Error("boom");
        },
      };
    }

    // @ts-expect-error - test override
    globalThis.MessageChannel = BrokenMessageChannel;
    // @ts-expect-error - test override
    globalThis.setTimeout = undefined;

    try {
      const w = new FakeWorker();
      const workerFactory = vi.fn(() => w);
      const transport = createWorkerTransport({ worker: workerFactory, terminateOnDispose: false });

      await expect(transport.request("op", [])).rejects.toThrow(/cannot schedule macrotask/i);

      // No worker should be constructed and no message posted.
      expect(workerFactory).toHaveBeenCalledTimes(0);
      expect(w.posted).toHaveLength(0);
    } finally {
      // @ts-expect-error - restore
      globalThis.MessageChannel = originalMessageChannel;
      // @ts-expect-error - restore
      globalThis.setTimeout = originalSetTimeout;
    }
  });

  it("best-effort signals dispose before hard-fail teardown", async () => {
    const { createWorkerTransport } = await import(
      /* @vite-ignore */ "@rybosome/tspice-web-components"
    );

    const originalMessageChannel = globalThis.MessageChannel;
    const originalSetTimeout = globalThis.setTimeout;

    // Force macrotask capability probing to succeed via setTimeout.
    // @ts-expect-error - test override
    globalThis.MessageChannel = undefined;

    try {
      const w = new FakeWorker();
      const transport = createWorkerTransport({ worker: () => w });

      // Construct the worker + send a request while we still have a scheduler.
      const p = transport.request("op", []);
      const posted = w.posted[0] as { id: number };
      expect(posted).toMatchObject({ type: "tspice:request", op: "op" });

      // Now simulate a runtime where the scheduler disappears before settlement.
      // @ts-expect-error - test override
      globalThis.setTimeout = undefined;

      const expectation = expect(p).rejects.toThrow(/cannot schedule macrotask/i);
      w.emitMessage({ type: "tspice:response", id: posted.id, ok: true, value: 123 });

      await expectation;

      // Hard-fail path should have attempted a best-effort dispose signal.
      expect(w.posted[w.posted.length - 1]).toEqual({ type: "tspice:dispose" });

      // And it should occur before listener teardown/terminate.
      const postIdx = w.calls.lastIndexOf("postMessage");
      const rmIdx = w.calls.findIndex((c) => c.startsWith("removeEventListener:"));
      expect(postIdx).toBeGreaterThanOrEqual(0);
      expect(rmIdx).toBeGreaterThanOrEqual(0);
      expect(postIdx).toBeLessThan(rmIdx);
    } finally {
      // @ts-expect-error - restore
      globalThis.MessageChannel = originalMessageChannel;
      // @ts-expect-error - restore
      globalThis.setTimeout = originalSetTimeout;
    }
  });
});
