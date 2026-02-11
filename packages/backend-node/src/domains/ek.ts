import type { EkApi, SpiceHandle } from "@rybosome/tspice-backend-contract";
import { invariant } from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";

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

export function createEkApi(native: NativeAddon): EkApi {
  let nextHandleId = 1;
  const handles = new Map<number, HandleEntry>();

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

  const api = {
    ekopr: (path: string) => register(native.ekopr(path)),
    ekopw: (path: string) => register(native.ekopw(path)),
    ekopn: (path: string, ifname: string, ncomch: number) => register(native.ekopn(path, ifname, ncomch)),
    ekcls: (handle: SpiceHandle) => close(handle, (e) => native.ekcls(e.nativeHandle)),

    ekntab: () => {
      const n = native.ekntab();
      invariant(typeof n === "number" && Number.isFinite(n), "Expected native backend ekntab() to return a number");
      return n;
    },

    ektnam: (n: number) => {
      const name = native.ektnam(n);
      invariant(typeof name === "string", "Expected native backend ektnam(n) to return a string");
      return name;
    },

    eknseg: (handle: SpiceHandle) => {
      const nseg = native.eknseg(lookup(handle).nativeHandle);
      invariant(
        typeof nseg === "number" && Number.isFinite(nseg),
        "Expected native backend eknseg(handle) to return a number",
      );
      return nseg;
    },
  } satisfies EkApi;

  Object.defineProperty(api, "__debugOpenHandleCount", {
    value: () => handles.size,
    enumerable: false,
  });

  return api;
}
