import type {
  DlaDescriptor,
  FileIoApi,
  FoundDlaDescriptor,
  SpiceHandle,
  VirtualOutput,
} from "@rybosome/tspice-backend-contract";
import { invariant } from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";
import type { VirtualOutputStager } from "../runtime/virtual-output-staging.js";
import type { SpiceHandleRegistry, SpiceHandleKind } from "../runtime/spice-handles.js";
const I32_MIN = -2147483648;
const I32_MAX = 2147483647;

const DAS_BACKED = ["DAS", "DLA"] as const satisfies readonly SpiceHandleKind[];

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

export function createFileIoApi(native: NativeAddon, handles: SpiceHandleRegistry, outputs: VirtualOutputStager): FileIoApi {
  function closeDasBacked(handle: SpiceHandle, context: string): void {
    handles.close(
      handle,
      DAS_BACKED,
      (entry) => {
        // In CSPICE, `dascls_c` closes both DAS and DLA handles, and `dlacls_c`
        // is just an alias.
        native.dascls(entry.nativeHandle);
      },
      context,
    );
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

    readVirtualOutput: (output: VirtualOutput) => {
      invariant(output && typeof output === "object", "readVirtualOutput(output): expected an object");
      const obj = output as { kind?: unknown; path?: unknown };
      invariant(obj.kind === "virtual-output", "readVirtualOutput(output): expected kind='virtual-output'");
      invariant(typeof obj.path === "string", "readVirtualOutput(output): expected path to be a string");
      return outputs.readVirtualOutput({ kind: "virtual-output", path: obj.path });
    },

    dafopr: (path: string) => handles.register("DAF", native.dafopr(path)),
    dafcls: (handle: SpiceHandle) =>
      handles.close(handle, ["DAF"], (e) => native.dafcls(e.nativeHandle), "dafcls"),
    dafbfs: (handle: SpiceHandle) =>
      native.dafbfs(handles.lookup(handle, ["DAF"], "dafbfs").nativeHandle),
    daffna: (handle: SpiceHandle) => {
      const found = native.daffna(handles.lookup(handle, ["DAF"], "daffna").nativeHandle);
      invariant(typeof found === "boolean", "Expected native backend daffna() to return a boolean");
      return found;
    },

    dasopr: (path: string) => handles.register("DAS", native.dasopr(path)),
    dascls: (handle: SpiceHandle) => closeDasBacked(handle, "dascls"),

    dlaopn: (path: string, ftype: string, ifname: string, ncomch: number) =>
      handles.register("DLA", native.dlaopn(path, ftype, ifname, ncomch)),

    dlabfs: (handle: SpiceHandle) =>
      normalizeFoundDlaDescriptor(
        native.dlabfs(handles.lookup(handle, DAS_BACKED, "dlabfs").nativeHandle),
        "dlabfs()",
      ),

    dlafns: (handle: SpiceHandle, descr: DlaDescriptor) => {
      assertDlaDescriptor(descr, "dlafns(descr)");
      return normalizeFoundDlaDescriptor(
        native.dlafns(handles.lookup(handle, DAS_BACKED, "dlafns").nativeHandle, descr),
        "dlafns()",
      );
    },

    dlacls: (handle: SpiceHandle) => closeDasBacked(handle, "dlacls"),
  } satisfies FileIoApi;

  Object.defineProperty(api, "__debugOpenHandleCount", {
    value: () => handles.size(),
    enumerable: false,
  });

  return api;
}
