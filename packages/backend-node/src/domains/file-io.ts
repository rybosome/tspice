import type {
  DlaDescriptor,
  FileIoApi,
  FoundDlaDescriptor,
  SpiceHandle,
} from "@rybosome/tspice-backend-contract";
import { invariant } from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";

type HandleKind = "DAF" | "DAS" | "DLA";
const DAS_BACKED = ["DAS", "DLA"] as const;
const I32_MIN = -2147483648;
const I32_MAX = 2147483647;

type HandleEntry = {
  kind: HandleKind;
  nativeHandle: number;
};

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

    const min = key === "bwdptr" || key === "fwdptr" ? -1 : 0;
    invariant(
      v >= min,
      `${context}: expected ${key} to be >= ${min}`,
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
      typeof nativeHandle === "number" &&
        Number.isInteger(nativeHandle) &&
        nativeHandle >= I32_MIN &&
        nativeHandle <= I32_MAX,
      `Expected native backend to return a 32-bit signed integer handle for ${kind}`,
    );

    invariant(
      nextHandleId < Number.MAX_SAFE_INTEGER,
      `SpiceHandle ID overflow: too many handles allocated (nextHandleId=${nextHandleId})`,
    );

    const handleId = nextHandleId++;
    handles.set(handleId, { kind, nativeHandle });
    return asSpiceHandle(handleId);
  }

  function lookup(handle: SpiceHandle, expected: readonly HandleKind[]): HandleEntry {
    const handleId = asHandleId(handle, "lookup(handle)");
    const entry = handles.get(handleId);
    if (!entry) {
      throw new Error(`Invalid or closed SpiceHandle: ${handleId}`);
    }
    if (!expected.includes(entry.kind)) {
      throw new Error(
        `Invalid SpiceHandle kind: ${handleId} is ${entry.kind}, expected ${expected.join(" or ")}`,
      );
    }
    return entry;
  }

  function close(
    handle: SpiceHandle,
    expected: readonly HandleKind[],
    closeNative: (entry: HandleEntry) => void,
  ): void {
    const handleId = asHandleId(handle, "close(handle)");
    const entry = handles.get(handleId);
    if (!entry) {
      throw new Error(`Invalid or closed SpiceHandle: ${handleId}`);
    }
    if (!expected.includes(entry.kind)) {
      throw new Error(
        `Invalid SpiceHandle kind: ${handleId} is ${entry.kind}, expected ${expected.join(" or ")}`,
      );
    }

    // Close-once semantics: only forget the handle after the native close succeeds.
    closeNative(entry);
    handles.delete(handleId);
  }

  function closeDasBacked(handle: SpiceHandle): void {
    close(handle, DAS_BACKED, (entry) => {
      // In CSPICE, `dascls_c` closes both DAS and DLA handles, and `dlacls_c`
      // is just an alias.
      native.dascls(entry.nativeHandle);
    });
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
    dafcls: (handle: SpiceHandle) => close(handle, ["DAF"], (e) => native.dafcls(e.nativeHandle)),
    dafbfs: (handle: SpiceHandle) => native.dafbfs(lookup(handle, ["DAF"]).nativeHandle),
    daffna: (handle: SpiceHandle) => {
      const found = native.daffna(lookup(handle, ["DAF"]).nativeHandle);
      invariant(typeof found === "boolean", "Expected native backend daffna() to return a boolean");
      return found;
    },

    dasopr: (path: string) => register("DAS", native.dasopr(path)),
    dascls: closeDasBacked,

    dlaopn: (path: string, ftype: string, ifname: string, ncomch: number) =>
      register("DLA", native.dlaopn(path, ftype, ifname, ncomch)),

    dlabfs: (handle: SpiceHandle) =>
      normalizeFoundDlaDescriptor(native.dlabfs(lookup(handle, DAS_BACKED).nativeHandle), "dlabfs()"),

    dlafns: (handle: SpiceHandle, descr: DlaDescriptor) => {
      assertDlaDescriptor(descr, "dlafns(descr)");
      return normalizeFoundDlaDescriptor(
        native.dlafns(lookup(handle, DAS_BACKED).nativeHandle, descr),
        "dlafns()",
      );
    },

    dlacls: closeDasBacked,
  } satisfies FileIoApi;

  Object.defineProperty(api, "__debugOpenHandleCount", {
    value: () => handles.size,
    enumerable: false,
  });

  return api;
}
