import {
  assertSpiceInt32NonNegative,
  type EkApi,
  type SpiceHandle,
} from "@rybosome/tspice-backend-contract";
import { invariant } from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";
import type { KernelStager } from "../runtime/kernel-staging.js";

type HandleEntry = {
  kind: "EK";
  nativeHandle: number;
};

const I32_MIN = -2147483648;
const I32_MAX = 2147483647;

function asHandleId(handle: SpiceHandle, context: string): number {
  const id = handle as unknown as number;
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new TypeError(`${context}: expected a positive safe integer SpiceHandle`);
  }
  return id;
}

function asSpiceHandle(handleId: number): SpiceHandle {
  return handleId as unknown as SpiceHandle;
}

type NativeEkDeps = Pick<NativeAddon, "ekopr" | "ekopw" | "ekopn" | "ekcls" | "ekntab" | "ektnam" | "eknseg">;

type KernelStagerEkDeps = Pick<KernelStager, "resolvePath">;

export function createEkApi<
  N extends NativeEkDeps,
  S extends KernelStagerEkDeps | undefined,
>(native: N, stager?: S): EkApi {
  let nextHandleId = 1;
  const handles = new Map<number, HandleEntry>();

  const resolvePath = (path: string) => {
    if (!stager) return path;

    try {
      return stager.resolvePath(path);
    } catch (error) {
      // Best-effort path resolution for *virtual-ish* kernel IDs only. If this
      // was an OS path (or some unexpected staging invariant), surface the error.
      const isVirtualish = path.startsWith("kernels/") || path.startsWith("/kernels/");
      if (!isVirtualish) {
        throw error;
      }
      return path;
    }
  };

  function register(nativeHandle: number): SpiceHandle {
    invariant(
      typeof nativeHandle === "number" &&
        Number.isInteger(nativeHandle) &&
        nativeHandle >= I32_MIN &&
        nativeHandle <= I32_MAX,
      "Expected native backend to return a 32-bit signed integer EK handle",
    );

    invariant(
      nextHandleId < Number.MAX_SAFE_INTEGER,
      `SpiceHandle ID overflow: too many handles allocated (nextHandleId=${nextHandleId})`,
    );

    const handleId = nextHandleId++;
    handles.set(handleId, { kind: "EK", nativeHandle });
    return asSpiceHandle(handleId);
  }

  function lookup(handle: SpiceHandle): HandleEntry {
    const handleId = asHandleId(handle, "lookup(handle)");
    const entry = handles.get(handleId);
    if (!entry) {
      throw new Error(`Invalid or closed SpiceHandle: ${handleId}`);
    }
    return entry;
  }

  function close(handle: SpiceHandle, closeNative: (entry: HandleEntry) => void): void {
    const handleId = asHandleId(handle, "close(handle)");
    const entry = handles.get(handleId);
    if (!entry) {
      throw new Error(`Invalid or closed SpiceHandle: ${handleId}`);
    }

    // Close-once semantics: only forget the handle after the native close succeeds.
    closeNative(entry);
    handles.delete(handleId);
  }

  function closeAllHandles(): void {
    const errors: unknown[] = [];

    for (const [handleId, entry] of Array.from(handles.entries())) {
      try {
        native.ekcls(entry.nativeHandle);
      } catch (error) {
        errors.push(error);
      } finally {
        handles.delete(handleId);
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, "Failed to close one or more EK handles during teardown");
    }
  }

  const api = {
    ekopr: (path: string) => register(native.ekopr(resolvePath(path))),
    ekopw: (path: string) => register(native.ekopw(resolvePath(path))),
    ekopn: (path: string, ifname: string, ncomch: number) => {
      assertSpiceInt32NonNegative(ncomch, "ekopn(ncomch)");
      return register(native.ekopn(resolvePath(path), ifname, ncomch));
    },
    ekcls: (handle: SpiceHandle) => close(handle, (e) => native.ekcls(e.nativeHandle)),

    ekntab: () => {
      const n = native.ekntab();

      invariant(
        typeof n === "number" &&
          Number.isInteger(n) &&
          n >= 0 &&
          n <= I32_MAX,
        "Expected native backend ekntab() to return a non-negative 32-bit signed integer",
      );
      return n;
    },

    ektnam: (n: number) => {
      assertSpiceInt32NonNegative(n, "ektnam(n)");
      const name = native.ektnam(n);
      invariant(typeof name === "string", "Expected native backend ektnam(n) to return a string");
      return name;
    },

    eknseg: (handle: SpiceHandle) => {
      const nseg = native.eknseg(lookup(handle).nativeHandle);
      invariant(
        typeof nseg === "number" &&
          Number.isInteger(nseg) &&
          nseg >= 0 &&
          nseg <= I32_MAX,
        "Expected native backend eknseg(handle) to return a non-negative 32-bit signed integer",
      );
      return nseg;
    },
  } satisfies EkApi;

  Object.defineProperty(api, "__debugOpenHandleCount", {
    value: () => handles.size,
    enumerable: false,
  });

  // Internal teardown helper (not part of the public backend contract).
  Object.defineProperty(api, "__debugCloseAllHandles", {
    value: closeAllHandles,
    enumerable: false,
  });

  return api;
}
