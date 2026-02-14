import type { WorkerLike } from "../../src/worker/transport/createWorkerTransport.js";

type Listener = (ev: { data?: unknown; message?: unknown }) => void;

/**
 * Minimal `WorkerLike` implementation for unit tests.
 *
 * This is intentionally synchronous: `postMessage()` immediately delivers a
 * "message" event to the connected worker-global-scope (and vice versa).
 */
export class FakeWorker implements WorkerLike {
  terminated = false;

  private listeners = new Map<string, Set<Listener>>();

  /** Hook used by {@link createConnectedWorkerPair}. */
  onPostMessage: ((msg: unknown) => void) | undefined;

  postMessage(message: unknown): void {
    this.onPostMessage?.(message);
  }

  addEventListener(type: string, listener: Listener): void {
    const set = this.listeners.get(type) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  terminate(): void {
    this.terminated = true;
  }

  dispatch(type: string, ev: { data?: unknown; message?: unknown }): void {
    for (const l of this.listeners.get(type) ?? []) {
      l(ev);
    }
  }
}

export class FakeWorkerGlobalScope {
  closed = false;

  private messageListeners = new Set<(ev: { data: unknown }) => void>();

  /** Hook used by {@link createConnectedWorkerPair}. */
  onPostMessage: ((msg: unknown) => void) | undefined;

  addEventListener(type: "message", listener: (ev: { data: unknown }) => void): void {
    if (type !== "message") return;
    this.messageListeners.add(listener);
  }

  removeEventListener(type: "message", listener: (ev: { data: unknown }) => void): void {
    if (type !== "message") return;
    this.messageListeners.delete(listener);
  }

  postMessage(msg: unknown): void {
    this.onPostMessage?.(msg);
  }

  close(): void {
    this.closed = true;
  }

  dispatchMessageFromMain(data: unknown): void {
    for (const l of this.messageListeners) {
      l({ data });
    }
  }
}

export function createConnectedWorkerPair(): {
  worker: FakeWorker;
  scope: FakeWorkerGlobalScope;
} {
  const worker = new FakeWorker();
  const scope = new FakeWorkerGlobalScope();

  worker.onPostMessage = (msg) => {
    scope.dispatchMessageFromMain(msg);
  };
  scope.onPostMessage = (msg) => {
    worker.dispatch("message", { data: msg });
  };

  return { worker, scope };
}
