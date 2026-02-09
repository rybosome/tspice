import type {
  DlaDescriptor,
  FileIoApi,
  FoundDlaDescriptor,
  SpiceHandle,
} from "@rybosome/tspice-backend-contract";
import { invariant } from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";

type HandleKind = "DAF" | "DAS" | "DLA";
const I32_MIN = -2147483648;
const I32_MAX = 2147483647;

type HandleEntry = {
  kind: HandleKind;
  nativeHandle: number;
};

function asHandleId(handle: SpiceHandle): number {
  return handle as unknown as number;
}

function asSpiceHandle(handleId: number): SpiceHandle {
  return handleId as unknown as SpiceHandle;
}

function assertDlaDescriptor(value: unknown, context: string): asserts value is DlaDescriptor {
  invariant(typeof value === "object" && value !== null, `${context}: expected an object`);
  const obj = value as Record<string, unknown>;
  for (const key of [
    "bwdptr",
    "fwdptr",
    "ibase",
    "isize",
    "dbase",
    "dsize",
    "cbase",
    "csize",
  ] as const) {
    const v = obj[key];
    invariant(
      typeof v === "number" &&
        Number.isInteger(v) &&
        v >= I32_MIN &&
        v <= I32_MAX,
      `${context}: expected ${key} to be a 32-bit signed integer`,
    );
  }
}

function normalizeFoundDlaDescriptor(value: unknown, context: string): FoundDlaDescriptor {
  invariant(typeof value === "object" && value !== null, `${context}: expected an object`);
  const obj = value as { found?: unknown; descr?: unknown };
  invariant(typeof obj.found === "boolean", `${context}: expected found to be a boolean`);

  if (!obj.found) {
    return { found: false };
  }

  assertDlaDescriptor(obj.descr, `${context}.descr`);
  return { found: true, descr: obj.descr };
}

export function createFileIoApi(native: NativeAddon): FileIoApi {
  let nextHandleId = 1;
  const handles = new Map<number, HandleEntry>();

  function register(kind: HandleKind, nativeHandle: number): SpiceHandle {
    invariant(
      typeof nativeHandle === "number" && Number.isFinite(nativeHandle),
      `Expected native backend to return a numeric handle for ${kind}`,
    );

    invariant(
      nextHandleId < Number.MAX_SAFE_INTEGER,
      `SpiceHandle ID overflow: too many handles allocated (nextHandleId=${nextHandleId})`,
    );

    const handleId = nextHandleId++;
    handles.set(handleId, { kind, nativeHandle });
    return asSpiceHandle(handleId);
  }

  function lookup(handle: SpiceHandle, expected: HandleKind): HandleEntry {
    const handleId = asHandleId(handle);
    const entry = handles.get(handleId);
    if (!entry) {
      throw new Error(`Invalid or closed SpiceHandle: ${handleId}`);
    }
    if (entry.kind !== expected) {
      throw new Error(
        `Invalid SpiceHandle kind for ${expected} operation: ${handleId} is ${entry.kind}, expected ${expected}`,
      );
    }
    return entry;
  }

  function close(handle: SpiceHandle, expected: HandleKind, closeNative: (nativeHandle: number) => void): void {
    const handleId = asHandleId(handle);
    const entry = handles.get(handleId);
    if (!entry) {
      throw new Error(`Invalid or closed SpiceHandle: ${handleId}`);
    }
    if (entry.kind !== expected) {
      throw new Error(
        `Invalid SpiceHandle kind for ${expected} close: ${handleId} is ${entry.kind}, expected ${expected}`,
      );
    }

    // Close-once semantics: only forget the handle after the native close succeeds.
    closeNative(entry.nativeHandle);
    handles.delete(handleId);
  }

  const api = {
    exists: (path: string) => {
      const exists = native.exists(path);
      invariant(typeof exists === "boolean", "Expected native backend exists() to return a boolean");
      return exists;
    },

    getfat: (path: string) => {
      const result = native.getfat(path);
      invariant(typeof result === "object" && result !== null, "Expected native backend getfat() to return an object");
      const obj = result as { arch?: unknown; type?: unknown };
      invariant(typeof obj.arch === "string", "Expected getfat().arch to be a string");
      invariant(typeof obj.type === "string", "Expected getfat().type to be a string");
      return { arch: obj.arch, type: obj.type };
    },

    dafopr: (path: string) => register("DAF", native.dafopr(path)),
    dafcls: (handle: SpiceHandle) => close(handle, "DAF", (h) => native.dafcls(h)),
    dafbfs: (handle: SpiceHandle) => native.dafbfs(lookup(handle, "DAF").nativeHandle),
    daffna: (handle: SpiceHandle) => {
      const found = native.daffna(lookup(handle, "DAF").nativeHandle);
      invariant(typeof found === "boolean", "Expected native backend daffna() to return a boolean");
      return found;
    },

    dasopr: (path: string) => register("DAS", native.dasopr(path)),
    dascls: (handle: SpiceHandle) => close(handle, "DAS", (h) => native.dascls(h)),

    dlaopn: (path: string, ftype: string, ifname: string, ncomch: number) =>
      register("DLA", native.dlaopn(path, ftype, ifname, ncomch)),

    dlabfs: (handle: SpiceHandle) =>
      normalizeFoundDlaDescriptor(native.dlabfs(lookup(handle, "DLA").nativeHandle), "dlabfs()"),

    dlafns: (handle: SpiceHandle, descr: DlaDescriptor) =>
      normalizeFoundDlaDescriptor(
        native.dlafns(lookup(handle, "DLA").nativeHandle, descr),
        "dlafns()",
      ),

    dlacls: (handle: SpiceHandle) => close(handle, "DLA", (h) => native.dlacls(h)),
  } satisfies FileIoApi;

  Object.defineProperty(api, "__debugOpenHandleCount", {
    value: () => handles.size,
    enumerable: false,
  });

  return api;
}
