import { createSpice, createSpiceAsync, type CreateSpiceAsyncOptions, type CreateSpiceOptions } from "../spice.js";
import type { Spice, SpiceAsync } from "../kit/types/spice-types.js";

import type { SpiceTransport } from "../transport/types.js";

import {
  isCachingTransport,
  withCaching,
  type WithCachingOptions,
} from "../transport/caching/withCaching.js";
import { createSpiceAsyncFromTransport } from "./createSpiceAsyncFromTransport.js";
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

export type SpiceClientBuildResult = {
  spice: SpiceAsync;
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

export type SpiceClientsBuilder = {
  caching(opts: WithCachingOptions): SpiceClientsBuilder;
  withKernels(pack: KernelPack, opts?: LoadKernelPackOptions): SpiceClientsBuilder;
  build(): Promise<SpiceClientBuildResult>;
};

export type SpiceClientsFactory = {
  webWorker(opts?: SpiceClientsWebWorkerOptions): SpiceClientsBuilder;
  synchronous(opts?: CreateSpiceOptions): SpiceClientsBuilder;
  asynchronous(opts?: CreateSpiceAsyncOptions): SpiceClientsBuilder;
};

export type CreateSpiceClientsOptions = {
  /**
   * Default options used when calling `.synchronous()` / `.asynchronous()` with
   * no arguments.
   *
   * Defaults to `{ backend: "wasm" }`.
   */
  defaultInProcessOptions?: CreateSpiceOptions;

  /** Default options used when calling `.webWorker()` with no arguments. */
  defaultWebWorkerOptions?: SpiceClientsWebWorkerOptions;
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

function createBuilder(state: BuilderState): SpiceClientsBuilder {
  let builder!: SpiceClientsBuilder;

  builder = {
    caching: (opts) => createBuilder({ ...state, cachingOptions: opts }),

    withKernels: (pack, opts) =>
      createBuilder({
        ...state,
        kernels: opts === undefined ? { pack } : { pack, loadOptions: opts },
      }),

    build: async (): Promise<SpiceClientBuildResult> => {
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
      } else if (state.kind === "synchronous") {
        const spice = await createSpice(state.inProcessOptions as CreateSpiceOptions);
        baseTransport = createSpiceTransportFromSpiceLike(spice);
      } else {
        const spice = await createSpiceAsync(state.inProcessOptions as CreateSpiceAsyncOptions);
        baseTransport = createSpiceTransportFromSpiceLike(spice);
      }

      const cachedTransport = state.cachingOptions
        ? withCaching(baseTransport, state.cachingOptions)
        : undefined;

      const raw = createSpiceAsyncFromTransport(baseTransport);
      const spice = createSpiceAsyncFromTransport(cachedTransport ?? baseTransport);

      if (state.kind === "webWorker") {
        // Eagerly create/validate the worker transport so `.build()` throws
        // (instead of deferring errors to the first spice call).
        await raw.kit.toolkitVersion();
      }

      if (state.kernels) {
        await loadKernelPack(raw, state.kernels.pack, state.kernels.loadOptions);
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
            await raw.kit.kclear();
          } catch {
            // ignore
          }
        })().catch(() => {
          // ignore
        });

        return disposePromise;
      };

      const dispose = (): Promise<void> => disposeAsync();

      const client: SpiceClientBuildResult = { spice, dispose };

      // Runtime alias for Explicit Resource Management. Do not polyfill.
      if (typeof (Symbol as any).asyncDispose === "symbol") {
        (client as any)[(Symbol as any).asyncDispose] = dispose;
      }

      return client;
    },
  };

  return builder;
}

export function createSpiceClients(opts?: CreateSpiceClientsOptions): SpiceClientsFactory {
  const defaultInProcessOptions: CreateSpiceOptions = opts?.defaultInProcessOptions ?? {
    backend: "wasm",
  };

  const defaultWebWorkerOptions = opts?.defaultWebWorkerOptions;

  return {
    webWorker: (webWorkerOpts) =>
      createBuilder({
        kind: "webWorker",
        webWorkerOptions: {
          ...(defaultWebWorkerOptions ?? {}),
          ...(webWorkerOpts ?? {}),
        },
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
}

export const spiceClients: SpiceClientsFactory = createSpiceClients();
