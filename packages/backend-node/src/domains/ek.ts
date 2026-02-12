import {
  assertSpiceInt32NonNegative,
  type EkApi,
  type SpiceHandle,
} from "@rybosome/tspice-backend-contract";
import { invariant } from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";
import type { KernelStager } from "../runtime/kernel-staging.js";
import type { SpiceHandleKind, SpiceHandleRegistry } from "../runtime/spice-handles.js";

const I32_MAX = 2147483647;

const EK_ONLY = ["EK"] as const satisfies readonly SpiceHandleKind[];

type NativeEkDeps = Pick<NativeAddon, "ekopr" | "ekopw" | "ekopn" | "ekcls" | "ekntab" | "ektnam" | "eknseg">;

type KernelStagerEkDeps = Pick<KernelStager, "resolvePath">;

// Backend-node-only internal debug hooks (not part of the public backend contract).
export interface EkApiDebug {
  __debugOpenHandleCount(): number;
  __debugCloseAllHandles(): void;
}

/**
* @internal Test-only helper: access non-enumerable debug hooks without `unknown` casts.
*/
export function asEkApiDebug(
  api: ReturnType<typeof createEkApi>,
): ReturnType<typeof createEkApi> & EkApiDebug {
  return api as ReturnType<typeof createEkApi> & EkApiDebug;
}

function debugEntries(
  handles: SpiceHandleRegistry,
): ReadonlyArray<readonly [SpiceHandle, { kind: SpiceHandleKind; nativeHandle: number }]> {
  return (
    (handles as unknown as {
      __entries?: () => ReadonlyArray<
        readonly [SpiceHandle, { kind: SpiceHandleKind; nativeHandle: number }]
      >;
    }).__entries?.() ?? []
  );
}

export function createEkApi<
  N extends NativeEkDeps,
  S extends KernelStagerEkDeps | undefined,
>(native: N, handles: SpiceHandleRegistry, stager?: S): EkApi {
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

  function debugOpenHandleCount(): number {
    let count = 0;
    for (const [, entry] of debugEntries(handles)) {
      if (entry.kind === "EK") {
        count++;
      }
    }
    return count;
  }

  function closeAllHandles(): void {
    const errors: unknown[] = [];

    for (const [handle, entry] of debugEntries(handles)) {
      if (entry.kind !== "EK") {
        continue;
      }

      try {
        // In teardown contexts, we want to best-effort close everything and
        // always clear the JS-side handle registry (even if the native close
        // fails). So we swallow native close errors here and throw an
        // AggregateError at the end.
        handles.close(
          handle,
          EK_ONLY,
          (e) => {
            try {
              native.ekcls(e.nativeHandle);
            } catch (error) {
              errors.push(error);
            }
          },
          "__debugCloseAllHandles:ekcls",
        );
      } catch (error) {
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, "Failed to close one or more EK handles during teardown");
    }
  }

  const api = {
    ekopr: (path: string) => handles.register("EK", native.ekopr(resolvePath(path))),
    ekopw: (path: string) => handles.register("EK", native.ekopw(resolvePath(path))),
    ekopn: (path: string, ifname: string, ncomch: number) => {
      assertSpiceInt32NonNegative(ncomch, "ekopn(ncomch)");
      return handles.register("EK", native.ekopn(resolvePath(path), ifname, ncomch));
    },
    ekcls: (handle: SpiceHandle) =>
      handles.close(handle, EK_ONLY, (e) => native.ekcls(e.nativeHandle), "ekcls"),

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
      const nseg = native.eknseg(handles.lookup(handle, EK_ONLY, "eknseg").nativeHandle);
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
    value: debugOpenHandleCount,
    enumerable: false,
  });

  // Internal teardown helper (not part of the public backend contract).
  Object.defineProperty(api, "__debugCloseAllHandles", {
    value: closeAllHandles,
    enumerable: false,
  });

  return api;
}
