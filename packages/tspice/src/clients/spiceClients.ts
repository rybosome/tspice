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
import type { KernelPack, LoadKernelPackOptions } from "../kernels/kernelPack.js";
import { loadKernelPack } from "../kernels/kernelPack.js";
import { createSpiceWorker } from "../worker/browser/createSpiceWorker.js";
import { createWorkerTransport, type WorkerLike, type WorkerTransport } from "../worker/transport/createWorkerTransport.js";

type ClientKind = "webWorker" | "synchronous" | "asynchronous";

type BuilderState = {
  kind: ClientKind;

  // In-process modes
  inProcessOptions?: CreateSpiceOptions | CreateSpiceAsyncOptions;

  // Web worker mode
  webWorkerOptions?: SpiceClientsWebWorkerOptions;

  cachingOptions?: WithCachingOptions;
  kernels?: {
    pack: KernelPack;
    loadOptions?: LoadKernelPackOptions;
  };
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
   * Defaults to `() => createSpiceWorker()`.
   */
  worker?: WorkerLike | (() => WorkerLike);
  /** Default request timeout forwarded to `createWorkerTransport`. */
  timeoutMs?: number;
  /** Forwarded to `createWorkerTransport`. Defaults to `true` when `worker` is a factory. */
  terminateOnDispose?: boolean;
  /** Forwarded to `createWorkerTransport`. Defaults to `terminateOnDispose`. */
  signalDispose?: boolean;
};

export type SpiceClientsBuilder<TSpice extends Spice | SpiceAsync = SpiceAsync> = {
  caching(opts: WithCachingOptions): SpiceClientsBuilder<TSpice>;
  withKernels(pack: KernelPack, opts?: LoadKernelPackOptions): SpiceClientsBuilder<TSpice>;
  build(): Promise<SpiceClientBuildResult<TSpice>>;
};

export type SpiceClientsFactory = {
  webWorker(opts?: SpiceClientsWebWorkerOptions): SpiceClientsBuilder<SpiceAsync>;
  synchronous(opts?: CreateSpiceOptions): SpiceClientsBuilder<Spice>;
  asynchronous(opts?: CreateSpiceAsyncOptions): SpiceClientsBuilder<SpiceAsync>;
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

function createBuilder(state: BuilderState & { kind: "synchronous" }): SpiceClientsBuilder<Spice>;
function createBuilder(
  state: BuilderState & { kind: Exclude<ClientKind, "synchronous"> },
): SpiceClientsBuilder<SpiceAsync>;
function createBuilder(state: BuilderState): SpiceClientsBuilder<Spice | SpiceAsync>;
function createBuilder(state: BuilderState): SpiceClientsBuilder<Spice | SpiceAsync> {
  let builder!: SpiceClientsBuilder<Spice | SpiceAsync>;

  builder = {
    caching: (opts) => createBuilder({ ...state, cachingOptions: opts }),

    withKernels: (pack, opts) =>
      createBuilder({
        ...state,
        kernels: opts === undefined ? { pack } : { pack, loadOptions: opts },
      }),

    build: async (): Promise<SpiceClientBuildResult<Spice | SpiceAsync>> => {
      if (state.kind === "synchronous") {
        const baseSpice = await createSpice(state.inProcessOptions as CreateSpiceOptions);
        const baseTransport = createSpiceTransportSyncFromSpiceLike(baseSpice);

        const cachedTransport = state.cachingOptions
          ? withCachingSync(baseTransport, state.cachingOptions)
          : undefined;

        const raw = createSpiceSyncFromTransport(baseTransport);
        const spice = createSpiceSyncFromTransport(cachedTransport ?? baseTransport);

        if (state.kernels) {
          await loadKernelPack(raw, state.kernels.pack, state.kernels.loadOptions);
        }

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

        return client;
      }

      let baseTransport: SpiceTransport;
      let workerTransport: WorkerTransport | undefined;

      if (state.kind === "webWorker") {
        const ww = state.webWorkerOptions;

        workerTransport = createWorkerTransport({
          worker: ww?.worker ?? (() => createSpiceWorker()),
          ...(ww?.timeoutMs === undefined ? {} : { timeoutMs: ww.timeoutMs }),
          ...(ww?.terminateOnDispose === undefined
            ? {}
            : { terminateOnDispose: ww.terminateOnDispose }),
          ...(ww?.signalDispose === undefined ? {} : { signalDispose: ww.signalDispose }),
        });

        baseTransport = workerTransport;
      } else {
        const spice = await createSpiceAsync(state.inProcessOptions as CreateSpiceAsyncOptions);
        baseTransport = createSpiceTransportFromSpiceLike(spice);
      }

      const cachedTransport = state.cachingOptions
        ? withCaching(baseTransport, state.cachingOptions)
        : undefined;

      const transport = cachedTransport ?? baseTransport;
      const spice = createSpiceAsyncFromTransport(transport);

      if (state.kind === "webWorker") {
        // Eagerly create/validate the worker transport so `.build()` throws
        // (instead of deferring errors to the first spice call).
        await spice.kit.toolkitVersion();
      }

      if (state.kernels) {
        await loadKernelPack(spice, state.kernels.pack, state.kernels.loadOptions);
      }

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

          if (state.kind === "webWorker") {
            try {
              workerTransport?.dispose();
            } catch {
              // ignore
            }
            return;
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

      return client;
    },
  };

  return builder;
}

const defaultInProcessOptions: CreateSpiceOptions = {
  backend: "wasm",
};

export const spiceClients: SpiceClientsFactory = {
  webWorker: (webWorkerOpts) =>
    createBuilder({
      kind: "webWorker",
      webWorkerOptions: { ...(webWorkerOpts ?? {}) },
    }),

  synchronous: (inProcessOpts) =>
    createBuilder({
      kind: "synchronous",
      inProcessOptions: inProcessOpts ?? defaultInProcessOptions,
    }),

  asynchronous: (inProcessOpts) =>
    createBuilder({
      kind: "asynchronous",
      inProcessOptions: inProcessOpts ?? defaultInProcessOptions,
    }),
};
