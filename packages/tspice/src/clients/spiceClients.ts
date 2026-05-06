import { createSpice, createSpiceAsync, type CreateSpiceAsyncOptions, type CreateSpiceOptions } from "../spice.js";
import type { Spice, SpiceAsync } from "../kit/types/spice-types.js";

import type { SpiceTransport, SpiceTransportSync } from "../transport/types.js";

import {
  isCachingTransport,
  withCaching,
  type WithCachingOptions,
} from "../transport/caching/withCaching.js";
import {
  isCachingTransportSync,
  withCachingSync,
} from "../transport/caching/withCachingSync.js";
import { createSpiceAsyncFromTransport } from "./createSpiceAsyncFromTransport.js";
import { createSpiceSyncFromTransport } from "./createSpiceSyncFromTransport.js";
import type { FetchLike, KernelPack } from "../kernels/kernelPack.js";
import { loadKernelPack } from "../kernels/kernelPack.js";
import { createSpiceWorker } from "../worker/browser/createSpiceWorker.js";
import { createWorkerTransport, type WorkerLike, type WorkerTransport } from "../worker/transport/createWorkerTransport.js";

type KernelBatch = {
  pack: KernelPack;
};

type NonEmptyKernelPacks = readonly [KernelPack, ...KernelPack[]];

type BuilderState = {
  cachingOptions?: WithCachingOptions;
  kernelBatches: readonly KernelBatch[];
  kernelFetch?: FetchLike;
};

export type SpiceClientBuildResult<TSpice extends Spice | SpiceAsync = SpiceAsync> = {
  spice: TSpice;
  /**
   * Dispose the client and clean up any worker/caches.
   *
   * - Idempotent
   * - Safe (does not throw)
   */
  dispose: () => Promise<void>;
};

export type SpiceClientsWebWorkerOptions = {
  /**
   * Pass an existing Worker-like or a factory to create one.
   *
   * Defaults to an inline blob worker (created internally).
   */
  worker?: WorkerLike | (() => WorkerLike);

  /**
   * Override the WASM binary URL used by the default inline blob worker.
   *
   * This is only used when `worker` is omitted.
   */
  wasmUrl?: string | URL;
  /** Default request timeout forwarded to `createWorkerTransport`. */
  timeoutMs?: number;
  /** Forwarded to `createWorkerTransport`. Defaults to `true` when `worker` is a factory. */
  terminateOnDispose?: boolean;
  /** Forwarded to `createWorkerTransport`. Defaults to `terminateOnDispose`. */
  signalDispose?: boolean;
};

export type SpiceClientsBuilder = {
  caching(opts: WithCachingOptions): SpiceClientsBuilder;

  /** Override `fetch` used for kernel pack loading (defaults to `globalThis.fetch`). */
  withFetch(fetchFn: FetchLike): SpiceClientsBuilder;

  /**
   * Append one or more kernel packs.
   *
   * Batching semantics:
   * - `withKernels(pack)` appends a single batch
   * - `withKernels(packs)` appends multiple batches (must be non-empty)
   *
   * Kernel load order matches call order (batch order preserved; within each
   * pack, kernel order preserved).
   */
  withKernels(pack: KernelPack): SpiceClientsBuilder;
  withKernels(packs: NonEmptyKernelPacks): SpiceClientsBuilder;

  /** Build a sync-ish in-process client. */
  toSync(opts?: CreateSpiceOptions): Promise<SpiceClientBuildResult<Spice>>;
  /** Build an async in-process client. */
  toAsync(opts?: CreateSpiceAsyncOptions): Promise<SpiceClientBuildResult<SpiceAsync>>;
  /** Build a web-worker client (async). */
  toWebWorker(opts?: SpiceClientsWebWorkerOptions): Promise<SpiceClientBuildResult<SpiceAsync>>;
};

const blockedStringKeys = new Set<string>([
  // Promise / thenable
  "then",

  // Prototype / constructor escapes
  "__proto__",
  "prototype",
  "constructor",

  // Common stringification / inspection hooks
  "toJSON",
  "inspect",

  // Object.prototype keys (avoid accidental RPC calls during introspection)
  "toString",
  "valueOf",
  "toLocaleString",
  "hasOwnProperty",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "__defineGetter__",
  "__defineSetter__",
  "__lookupGetter__",
  "__lookupSetter__",
]);

const isSafeRpcKey = (key: string): boolean => /^[A-Za-z_$][\w$]*$/.test(key);

type SpiceLike = Pick<Spice, "raw" | "kit"> | Pick<SpiceAsync, "raw" | "kit">;

type RpcNamespace = "raw" | "kit";

type MethodKeys<T extends object> = Extract<{
  [K in keyof T]-?: T[K] extends (...args: unknown[]) => unknown ? K : never;
}[keyof T], string>;

type TransportSurfaceMethodKeys<TSpice extends SpiceLike> = {
  raw: ReadonlySet<MethodKeys<TSpice["raw"]>>;
  kit: ReadonlySet<MethodKeys<TSpice["kit"]>>;
};

function snapshotFunctionKeys<T extends object>(target: T): ReadonlySet<MethodKeys<T>> {
  const out = new Set<MethodKeys<T>>();
  const obj = target as Record<string, unknown>;

  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === "function") {
      out.add(key as MethodKeys<T>);
    }
  }

  return out;
}

function snapshotTransportSurfaceMethodKeys<TSpice extends SpiceLike>(
  spice: TSpice,
): TransportSurfaceMethodKeys<TSpice> {
  return {
    raw: snapshotFunctionKeys(spice.raw) as TransportSurfaceMethodKeys<TSpice>["raw"],
    kit: snapshotFunctionKeys(spice.kit) as TransportSurfaceMethodKeys<TSpice>["kit"],
  };
}

function normalizeTransportMethodKeyList<TKey extends string>(
  value: unknown,
  label: string,
): ReadonlySet<TKey> {
  if (!Array.isArray(value) || !value.every((v): v is string => typeof v === "string")) {
    throw new Error(
      `${label}: invalid method-key list type. Expected: string[]. Got: ${Object.prototype.toString.call(value)}. Hint: return an array of method-name strings.`,
    );
  }

  const out = new Set<TKey>();
  for (const key of value) {
    if (!isSafeRpcKey(key) || blockedStringKeys.has(key)) {
      throw new Error(
        `${label}: invalid method key. Expected: safe identifier string not in blocked key set. Got: ${JSON.stringify(key)}. Hint: return callable method names only.`,
      );
    }
    out.add(key as TKey);
  }
  return out;
}

function parseTransportSurfaceMethodKeys(
  value: unknown,
): TransportSurfaceMethodKeys<Pick<SpiceAsync, "raw" | "kit">> {
  if (typeof value !== "object" || value === null) {
    throw new Error(
      `meta.surfaceMethodKeys: invalid response envelope. Expected: object with rawMethodKeys and kitMethodKeys arrays. Got: ${Object.prototype.toString.call(value)}.`,
    );
  }

  const rec = value as Record<string, unknown>;
  return {
    raw: normalizeTransportMethodKeyList<MethodKeys<SpiceAsync["raw"]>>(
      rec.rawMethodKeys,
      "meta.surfaceMethodKeys.rawMethodKeys",
    ),
    kit: normalizeTransportMethodKeyList<MethodKeys<SpiceAsync["kit"]>>(
      rec.kitMethodKeys,
      "meta.surfaceMethodKeys.kitMethodKeys",
    ),
  };
}

async function requestTransportSurfaceMethodKeys(
  transport: SpiceTransport,
): Promise<TransportSurfaceMethodKeys<Pick<SpiceAsync, "raw" | "kit">>> {
  try {
    const response = await transport.request("meta.surfaceMethodKeys", []);
    return parseTransportSurfaceMethodKeys(response);
  } catch (error) {
    throw new Error(
      `spiceClients.toWebWorker(): transport metadata request failed. Expected: transport.request("meta.surfaceMethodKeys", []) to return { rawMethodKeys: string[], kitMethodKeys: string[] }. Got: ${String(error)}. Hint: implement meta.surfaceMethodKeys on the worker transport endpoint.`,
      { cause: error },
    );
  }
}

function createSpiceTransportFromSpiceLike(spice: SpiceLike): SpiceTransport {
  return {
    request: async (op: string, args: unknown[]): Promise<unknown> => {
      const dot = op.indexOf(".");
      if (dot <= 0 || dot === op.length - 1) {
        throw new Error(
          `spice transport request: invalid op format. Expected: "<namespace>.<method>" with non-empty namespace and method. Got: ${op}.`,
        );
      }

      const namespace = op.slice(0, dot);
      const method = op.slice(dot + 1);

      if (namespace !== "raw" && namespace !== "kit") {
        throw new Error(
          `spice transport request: unsupported namespace. Expected: "raw" | "kit". Got: ${namespace}.`,
        );
      }

      if (!isSafeRpcKey(method) || blockedStringKeys.has(method)) {
        throw new Error(
          `spice transport request: invalid method token. Expected: safe identifier not in blocked key set. Got: ${method}.`,
        );
      }

      const ns = namespace satisfies RpcNamespace;

      const target = spice[ns] as unknown as Record<string, unknown>;
      const fn = target[method];
      if (typeof fn !== "function") {
        throw new Error(
          `spice transport request: unresolved operation. Expected: an existing function on spice.raw or spice.kit. Got: ${op}. Hint: verify method availability and operation metadata wiring.`,
        );
      }

      // Use Reflect.apply to be defensive about `this`.
      return await Reflect.apply(fn as (...a: unknown[]) => unknown, target, args);
    },
  };
}

function createSpiceTransportSyncFromSpiceLike(
  spice: Pick<Spice, "raw" | "kit">,
): SpiceTransportSync {
  return {
    request: (op: string, args: unknown[]): unknown => {
      const dot = op.indexOf(".");
      if (dot <= 0 || dot === op.length - 1) {
        throw new Error(
          `spice transport request: invalid op format. Expected: "<namespace>.<method>" with non-empty namespace and method. Got: ${op}.`,
        );
      }

      const namespace = op.slice(0, dot);
      const method = op.slice(dot + 1);

      if (namespace !== "raw" && namespace !== "kit") {
        throw new Error(
          `spice transport request: unsupported namespace. Expected: "raw" | "kit". Got: ${namespace}.`,
        );
      }

      if (!isSafeRpcKey(method) || blockedStringKeys.has(method)) {
        throw new Error(
          `spice transport request: invalid method token. Expected: safe identifier not in blocked key set. Got: ${method}.`,
        );
      }

      const ns = namespace satisfies RpcNamespace;

      const target = spice[ns] as unknown as Record<string, unknown>;
      const fn = target[method];
      if (typeof fn !== "function") {
        throw new Error(
          `spice transport request: unresolved operation. Expected: an existing function on spice.raw or spice.kit. Got: ${op}. Hint: verify method availability and operation metadata wiring.`,
        );
      }

      // Use Reflect.apply to be defensive about `this`.
      return Reflect.apply(fn as (...a: unknown[]) => unknown, target, args);
    },
  };
}

function createBuilder(state: BuilderState): SpiceClientsBuilder {
  let builder!: SpiceClientsBuilder;

  const loadKernelBatches = async (spice: Spice | SpiceAsync): Promise<void> => {
    for (const batch of state.kernelBatches) {
      await loadKernelPack(
        spice,
        batch.pack,
        state.kernelFetch === undefined ? undefined : { fetch: state.kernelFetch },
      );
    }
  };

  const addKernelBatches = (packs: readonly KernelPack[]): SpiceClientsBuilder =>
    createBuilder({
      ...state,
      kernelBatches: state.kernelBatches.concat(
        packs.map((pack) => ({ pack })),
      ),
    });


  builder = {
    caching: (opts) => createBuilder({ ...state, cachingOptions: opts }),

    withFetch: (fetchFn) => createBuilder({ ...state, kernelFetch: fetchFn }),

    withKernels: (packOrPacks: KernelPack | NonEmptyKernelPacks) => {
      const packs = (
        Array.isArray(packOrPacks)
          ? packOrPacks
          : [packOrPacks]
      ) as readonly KernelPack[];

      if (packs.length === 0) {
        throw new Error(
          "spiceClients.withKernels(): expected a KernelPack or a non-empty KernelPack[]",
        );
      }

      return addKernelBatches(packs);
    },

    toSync: async (inProcessOpts?: CreateSpiceOptions): Promise<SpiceClientBuildResult<Spice>> => {
      const baseSpice = await createSpice(inProcessOpts ?? defaultInProcessOptions);
      const baseTransport = createSpiceTransportSyncFromSpiceLike(baseSpice);

      const cachedTransport = state.cachingOptions
        ? withCachingSync(baseTransport, state.cachingOptions)
        : undefined;

      // Use an uncached spice instance for kernel loading/cleanup.
      const surfaceMethodKeys = snapshotTransportSurfaceMethodKeys(baseSpice);

      const raw = createSpiceSyncFromTransport(baseTransport, surfaceMethodKeys);
      const spice = createSpiceSyncFromTransport(cachedTransport ?? baseTransport, surfaceMethodKeys);

      // Preserve non-function backend metadata.
      Object.defineProperty(raw.raw, "kind", { value: baseSpice.raw.kind, enumerable: true });
      Object.defineProperty(spice.raw, "kind", { value: baseSpice.raw.kind, enumerable: true });

      let disposePromise: Promise<void> | undefined;

      const disposeAsync = (): Promise<void> => {
        if (disposePromise) return disposePromise;

        disposePromise = (async () => {
          // Always clear caches first so we don't retain references to any large
          // results/kernels after teardown.
          if (cachedTransport && isCachingTransportSync(cachedTransport)) {
            try {
              cachedTransport.dispose();
            } catch {
              // ignore
            }
          }

          // In-process: best-effort kernel cleanup.
          try {
            raw.kit.kclear();
          } catch {
            // ignore
          }
        })().catch(() => {
          // ignore
        });

        return disposePromise;
      };

      const dispose = (): Promise<void> => disposeAsync();

      const client: SpiceClientBuildResult<Spice> = { spice, dispose };

      // Runtime alias for Explicit Resource Management. Do not polyfill.
      if (typeof (Symbol as any).asyncDispose === "symbol") {
        (client as any)[(Symbol as any).asyncDispose] = dispose;
      }

      try {
        await loadKernelBatches(raw);
      } catch (error) {
        // `toSync()` does eager kernel loading; ensure we don't leak resources
        // if kernel preload throws before the caller receives `dispose()`.
        await disposeAsync();
        throw error;
      }

      return client;
    },

    toAsync: async (
      inProcessOpts?: CreateSpiceAsyncOptions,
    ): Promise<SpiceClientBuildResult<SpiceAsync>> => {
      const baseSpice = await createSpiceAsync(inProcessOpts ?? defaultInProcessOptions);
      const baseTransport = createSpiceTransportFromSpiceLike(baseSpice);

      const cachedTransport = state.cachingOptions
        ? withCaching(baseTransport, state.cachingOptions)
        : undefined;

      const transport = cachedTransport ?? baseTransport;
      const surfaceMethodKeys = snapshotTransportSurfaceMethodKeys(baseSpice);
      const spice = createSpiceAsyncFromTransport(transport, surfaceMethodKeys);

      // Preserve non-function backend metadata.
      Object.defineProperty(spice.raw, "kind", { value: baseSpice.raw.kind, enumerable: true });

      let disposePromise: Promise<void> | undefined;

      const disposeAsync = (): Promise<void> => {
        if (disposePromise) return disposePromise;

        disposePromise = (async () => {
          // Always clear caches first so we don't retain references to any large
          // results/kernels after teardown.
          if (cachedTransport && isCachingTransport(cachedTransport)) {
            try {
              cachedTransport.dispose();
            } catch {
              // ignore
            }
          }

          // In-process: best-effort kernel cleanup.
          try {
            await spice.kit.kclear();
          } catch {
            // ignore
          }
        })().catch(() => {
          // ignore
        });

        return disposePromise;
      };

      const dispose = (): Promise<void> => disposeAsync();

      const client: SpiceClientBuildResult<SpiceAsync> = { spice, dispose };

      // Runtime alias for Explicit Resource Management. Do not polyfill.
      if (typeof (Symbol as any).asyncDispose === "symbol") {
        (client as any)[(Symbol as any).asyncDispose] = dispose;
      }

      try {
        await loadKernelBatches(spice);
      } catch (error) {
        // `toAsync()` does eager kernel loading; ensure we don't leak resources
        // if kernel preload throws before the caller receives `dispose()`.
        await disposeAsync();
        throw error;
      }

      return client;
    },

    toWebWorker: async (
      webWorkerOpts?: SpiceClientsWebWorkerOptions,
    ): Promise<SpiceClientBuildResult<SpiceAsync>> => {
      const ww = webWorkerOpts;

      const workerInput =
        ww?.worker ??
        (() =>
          createSpiceWorker(
            ww?.wasmUrl === undefined ? undefined : { wasmUrl: ww.wasmUrl },
          ));
      const terminateOnDispose =
        ww?.terminateOnDispose ?? (typeof workerInput === "function" ? true : false);
      const signalDispose = ww?.signalDispose ?? terminateOnDispose;

      const workerTransport = createWorkerTransport({
        worker: workerInput,
        ...(ww?.timeoutMs === undefined ? {} : { timeoutMs: ww.timeoutMs }),
        terminateOnDispose,
        signalDispose,
      });

      const baseTransport: SpiceTransport = workerTransport;

      const cachedTransport = state.cachingOptions
        ? withCaching(baseTransport, state.cachingOptions)
        : undefined;

      const transport = cachedTransport ?? baseTransport;

      let disposePromise: Promise<void> | undefined;

      const disposeAsync = (): Promise<void> => {
        if (disposePromise) return disposePromise;

        disposePromise = (async () => {
          // Always clear caches first so we don't retain references to any large
          // results/kernels after teardown.
          if (cachedTransport && isCachingTransport(cachedTransport)) {
            try {
              cachedTransport.dispose();
            } catch {
              // ignore
            }
          }

          try {
            workerTransport.dispose();
          } catch {
            // ignore
          }
        })().catch(() => {
          // ignore
        });

        return disposePromise;
      };

      const dispose = (): Promise<void> => disposeAsync();

      try {
        const surfaceMethodKeys = await requestTransportSurfaceMethodKeys(baseTransport);
        const spice = createSpiceAsyncFromTransport(transport, surfaceMethodKeys);

        // Web-worker clients currently always use the WASM backend.
        Object.defineProperty(spice.raw, "kind", { value: "wasm", enumerable: true });

        const client: SpiceClientBuildResult<SpiceAsync> = { spice, dispose };

        // Runtime alias for Explicit Resource Management. Do not polyfill.
        if (typeof (Symbol as any).asyncDispose === "symbol") {
          (client as any)[(Symbol as any).asyncDispose] = dispose;
        }

        // Eagerly create/validate the worker transport so `.toWebWorker()` throws
        // (instead of deferring errors to the first spice call).
        await spice.kit.toolkitVersion();

        await loadKernelBatches(spice);

        return client;
      } catch (error) {
        // `toWebWorker()` does eager bootstrap validation + kernel preload.
        // Ensure we don't leak worker/transport/caches if any eager step
        // throws before the caller receives `dispose()`.
        //
        // Note: for owned workers, `workerTransport.dispose()` signals a global
        // dispose message (`tspice:dispose`) by default, which triggers worker-
        // side best-effort `kclear()` before termination.
        await disposeAsync();
        throw error;
      }
    },
  };

  return builder;
}

const defaultInProcessOptions: CreateSpiceOptions = {
  backend: "wasm",
};

export const spiceClients: SpiceClientsBuilder = createBuilder({
  kernelBatches: [],
});
