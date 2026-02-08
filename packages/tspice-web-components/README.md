# `@rybosome/tspice-web-components`

Composable browser-side client utilities for `@rybosome/tspice`.

This package is currently intended for **internal workspace use**.

## Building blocks

- `createWorkerTransport()` — request/response RPC over `Worker.postMessage()` (timeout + dispose support)
- `withCaching()` — memoized transport wrapper (in-flight dedupe + LRU + optional TTL)
- `createSpiceAsyncFromTransport()` — builds a `SpiceAsync` `{ raw, kit }` client from a transport

## Behavior notes

### `withCaching()`

- `ttlMs` semantics:
  - `undefined`/`null`: cache forever (still LRU-bounded by `maxEntries`)
  - `<= 0`: caching disabled (passthrough)
  - `> 0`: absolute TTL measured from when the value resolves (non-sliding)
- Default keying uses `JSON.stringify([op, args])`. If that throws (cyclic
  structures, bigint, etc), the call is **not cached**. Provide `opts.key` for
  deterministic keys in those cases.
- TTL eviction is lazy (runs on `request()`) unless you pass `sweepIntervalMs`.
  You can always `clear()`/`dispose()` to drop references.

### `createWorkerTransport()`

- Supports a default `timeoutMs` (and per-request `{ timeoutMs, signal }` overrides).
- Call `dispose()` when you're done. By default it will terminate factory-created
  workers; override with `terminateOnDispose`.

## Examples

### 1) Caching-only composition

```ts
import {
  createSpiceAsyncFromTransport,
  withCaching,
  type SpiceTransport,
} from "@rybosome/tspice-web-components";

const base: SpiceTransport = {
  async request(op, args) {
    // Your own transport (HTTP, WebSocket, iframe bridge, etc)
    const res = await fetch("/spice", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ op, args }),
    });

    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return (await res.json()) as unknown;
  },
};

const cached = withCaching(base, {
  maxEntries: 500,
  ttlMs: 30_000,
});

const spice = createSpiceAsyncFromTransport(cached);
await spice.kit.toolkitVersion();

// Optional, e.g. on unmount:
// cached.dispose();
```

### 2) Worker-only composition

```ts
import {
  createSpiceAsyncFromTransport,
  createWorkerTransport,
} from "@rybosome/tspice-web-components";

const transport = createWorkerTransport({
  worker: () =>
    new Worker(new URL("./spice.worker.ts", import.meta.url), { type: "module" }),
  timeoutMs: 30_000,
});

const spice = createSpiceAsyncFromTransport(transport);
await spice.kit.utcToEt("2026-01-01T00:00:00Z");

// Optional, e.g. on unmount:
// transport.dispose();
```

Worker-side pseudo-code (message handler):

```ts
// spice.worker.ts (pseudo-code)
import type { SpiceAsync } from "@rybosome/tspice";

type RpcRequest = {
  type: "tspice:request";
  id: number;
  op: string;
  args: unknown[];
};

type RpcResponse =
  | { type: "tspice:response"; id: number; ok: true; value: unknown }
  | {
      type: "tspice:response";
      id: number;
      ok: false;
      error: { message: string; name?: string; stack?: string };
    };

declare const spice: SpiceAsync;

function serializeError(err: unknown): RpcResponse & { ok: false } {
  const e = err instanceof Error ? err : new Error(String(err));
  return {
    type: "tspice:response",
    id: -1,
    ok: false,
    error: { message: e.message, name: e.name, stack: e.stack },
  };
}

self.addEventListener("message", async (ev: MessageEvent<unknown>) => {
  const msg = ev.data as RpcRequest;
  if (!msg || msg.type !== "tspice:request") return;

  const { id, op, args } = msg;

  try {
    const [ns, method] = op.split(".") as ["raw" | "kit", string];
    const target = ns === "raw" ? spice.raw : spice.kit;
    const value = await (target as any)[method](...args);

    const res: RpcResponse = { type: "tspice:response", id, ok: true, value };
    self.postMessage(res);
  } catch (err) {
    const base = serializeError(err);
    self.postMessage({ ...base, id });
  }
});
```

### 3) Worker → caching composition

```ts
import {
  createSpiceAsyncFromTransport,
  createWorkerTransport,
  withCaching,
} from "@rybosome/tspice-web-components";

const workerTransport = createWorkerTransport({
  worker: () =>
    new Worker(new URL("./spice.worker.ts", import.meta.url), { type: "module" }),
  timeoutMs: 30_000,
});

const transport = withCaching(workerTransport, {
  maxEntries: 1000,
  ttlMs: 10_000,
});

const spice = createSpiceAsyncFromTransport(transport);
await spice.kit.toolkitVersion();
```
