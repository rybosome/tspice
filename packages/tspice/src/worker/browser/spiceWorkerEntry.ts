import { createSpiceAsync } from "../../spice.js";
import type { SpiceAsync } from "../../kit/types/spice-types.js";

import type { SpiceTransport } from "../../transport/types.js";
import { exposeTransportToWorker } from "../transport/exposeTransportToWorker.js";

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

type RpcNamespace = "raw" | "kit";

type RpcAllowlist = Partial<Record<RpcNamespace, ReadonlySet<string>>>;

const allowedKitMethodList = [
  "loadKernel",
  "unloadKernel",
  "kclear",
  "toolkitVersion",
  "utcToEt",
  "etToUtc",
  "frameTransform",
  "getState",
] as const satisfies readonly (keyof SpiceAsync["kit"])[];

const defaultAllowlist: RpcAllowlist = {
  // NOTE: `kit` is deliberately allowlisted because it's a small, curated API.
  // `raw` is intentionally not allowlisted here (see module comment below).
  kit: new Set<string>(allowedKitMethodList),
};

function createSpiceTransportFromSpiceAsync(
  spice: SpiceAsync,
  opts?: {
    /**
     * Optional allowlist by namespace.
     *
     * When provided for a namespace, any non-allowlisted method name is rejected.
     */
    allowlist?: RpcAllowlist;
  },
): SpiceTransport {
  const allowlist = opts?.allowlist ?? defaultAllowlist;

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

      const nsAllowlist = allowlist[ns];
      if (nsAllowlist && !nsAllowlist.has(method)) {
        throw new Error(`Disallowed op: ${op}`);
      }

      const target = spice[ns] as unknown as Record<string, unknown>;
      const fn = target[method];
      if (typeof fn !== "function") {
        throw new Error(`Unknown op: ${op}`);
      }

      // `spice.raw` and `spice.kit` are proxies that return bound/wrapped
      // functions, but use Reflect.apply to be defensive about `this`.
      return await Reflect.apply(
        fn as (...a: unknown[]) => unknown,
        target,
        args,
      );
    },
  };
}

// NOTE: This file is meant to be loaded as a Web Worker module.
// It intentionally has no exports and runs as a side-effect.
//
// Security/design note:
// - This worker entry is intended for internal workspace use.
// - By default, it exposes:
//   - `kit.*` as a small, curated allowlist (see `allowedKitMethodList`), and
//   - `raw.*` without an allowlist (subject to the blocked key checks above).
// - If you need a tighter RPC capability set (especially for `raw.*`), create
//   a custom worker entry and provide an explicit allowlist.
//
// IMPORTANT: `exposeTransportToWorker()` must run synchronously so the worker's
// `message` handler is installed immediately. Otherwise, early RPC messages from
// the main thread can be dropped while the WASM backend is still initializing.
const spicePromise = createSpiceAsync({ backend: "wasm" });
const transportPromise = spicePromise.then((spice) =>
  createSpiceTransportFromSpiceAsync(spice),
);

exposeTransportToWorker({
  transport: {
    request: async (op: string, args: unknown[]): Promise<unknown> =>
      (await transportPromise).request(op, args),
  },
  onDispose: async () => {
    // Best-effort cleanup. Worker termination also releases resources, but this
    // helps callers who keep the worker alive.
    try {
      const spice = await spicePromise;
      await spice.raw.kclear();
    } catch {
      // ignore
    }
  },
});
