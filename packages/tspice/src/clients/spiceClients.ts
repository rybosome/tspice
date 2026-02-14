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
import type { KernelPack } from "../kernels/kernelPack.js";
import { loadKernelPack } from "../kernels/kernelPack.js";
import { createSpiceWorker } from "../worker/browser/createSpiceWorker.js";
import { createWorkerTransport, type WorkerLike, type WorkerTransport } from "../worker/transport/createWorkerTransport.js";

type KernelBatch = {
  pack: KernelPack;
};

type BuilderState = {
  cachingOptions?: WithCachingOptions;
  kernelBatches: readonly KernelBatch[];
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

  /**
   * Append one or more kernel packs.
   *
   * Batching semantics:
   * - `withKernels(pack)` appends a single batch
   * - `withKernels(packs)` appends multiple batches
   *
   * Kernel load order matches call order (batch order preserved; within each
   * pack, kernel order preserved).
   */
  withKernels(packOrPacks: KernelPack | KernelPack[]): SpiceClientsBuilder;

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

function createSpiceTransportFromSpiceLike(spice: SpiceLike): SpiceTransport {
  return {
    request: async (op: string, args: unknown[]): Promise<unknown> => {
      const dot = op.indexOf(".");
      if (dot <= 0 || dot === op.length - 1) {
        throw new Error(`Invalid op: ${op}`);
      }

      const namespace = op.slice(0, dot);
      const method = op.slice(dot + 1);

      if (namespace !== "raw" && namespace !== "kit") {
        throw new Error(`Unknown namespace: ${namespace}`);
      }

      if (!isSafeRpcKey(method) || blockedStringKeys.has(method)) {
        throw new Error(`Invalid method name: ${method}`);
      }

      const ns = namespace satisfies RpcNamespace;

      const target = spice[ns] as unknown as Record<string, unknown>;
      const fn = target[method];
      if (typeof fn !== "function") {
        throw new Error(`Unknown op: ${op}`);
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
        throw new Error(`Invalid op: ${op}`);
      }

      const namespace = op.slice(0, dot);
      const method = op.slice(dot + 1);

      if (namespace !== "raw" && namespace !== "kit") {
        throw new Error(`Unknown namespace: ${namespace}`);
      }

      if (!isSafeRpcKey(method) || blockedStringKeys.has(method)) {
        throw new Error(`Invalid method name: ${method}`);
      }

      const ns = namespace satisfies RpcNamespace;

      const target = spice[ns] as unknown as Record<string, unknown>;
      const fn = target[method];
      if (typeof fn !== "function") {
        throw new Error(`Unknown op: ${op}`);
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
      await loadKernelPack(spice, batch.pack);
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

    withKernels: (packOrPacks: KernelPack | KernelPack[]) => {
      const packs = Array.isArray(packOrPacks) ? packOrPacks : [packOrPacks];
      return addKernelBatches(packs);
    },

    toSync: async (inProcessOpts?: CreateSpiceOptions): Promise<SpiceClientBuildResult<Spice>> => {
      const baseSpice = await createSpice(inProcessOpts ?? defaultInProcessOptions);
      const baseTransport = createSpiceTransportSyncFromSpiceLike(baseSpice);

      const cachedTransport = state.cachingOptions
        ? withCachingSync(baseTransport, state.cachingOptions)
        : undefined;

      // Use an uncached spice instance for kernel loading/cleanup.
      const raw = createSpiceSyncFromTransport(baseTransport);
      const spice = createSpiceSyncFromTransport(cachedTransport ?? baseTransport);

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
      const spice = createSpiceAsyncFromTransport(transport);

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
      const spice = createSpiceAsyncFromTransport(transport);

      // Web-worker clients currently always use the WASM backend.
      Object.defineProperty(spice.raw, "kind", { value: "wasm", enumerable: true });

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

      const client: SpiceClientBuildResult<SpiceAsync> = { spice, dispose };

      // Runtime alias for Explicit Resource Management. Do not polyfill.
      if (typeof (Symbol as any).asyncDispose === "symbol") {
        (client as any)[(Symbol as any).asyncDispose] = dispose;
      }

      try {
        // Eagerly create/validate the worker transport so `.toWebWorker()` throws
        // (instead of deferring errors to the first spice call).
        await spice.kit.toolkitVersion();

        await loadKernelBatches(spice);
      } catch (error) {
        // `toWebWorker()` does eager validation + kernel preload. Ensure we
        // don't leak a worker/transport/caches if any eager step throws before
        // the caller receives `dispose()`.
        //
        // Note: for owned workers, `workerTransport.dispose()` signals a global
        // dispose message (`tspice:dispose`) by default, which triggers worker-
        // side best-effort `kclear()` before termination.
        await disposeAsync();
        throw error;
      }

      return client;
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
