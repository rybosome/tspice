import {
  dasCommentTable,
  dasCommentPageBytes,
  dasCommentPage,
  dasFileTarget,
  dasText,
  decodeDasSummary,
  decodeDasAddresses,
  decodeDasFileRecord,
} from "@rybosome/tspice-core";
import type {
  DlaDescriptor,
  FileIoApi,
  FileIoKitApi,
  FoundDlaDescriptor,
  SpiceHandle,
  VirtualOutput,
} from "@rybosome/tspice-backend-contract";
import { assertSpiceInt32, invariant } from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";
import type { KernelStager } from "../runtime/kernel-staging.js";
import type { VirtualOutputStager } from "../runtime/virtual-output-staging.js";
import type {
  SpiceHandleRegistry,
  SpiceHandleKind,
} from "../runtime/spice-handles.js";
const I32_MIN = -2147483648;
const I32_MAX = 2147483647;

const DAS_BACKED = ["DAS", "DLA"] as const satisfies readonly SpiceHandleKind[];

function assertDlaDescriptor(
  value: unknown,
  context: string,
): asserts value is DlaDescriptor {
  invariant(
    typeof value === "object" && value !== null,
    `${context}: expected an object`,
  );
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
    invariant(v >= min, `${context}: expected ${key} to be >= ${min}`);
  }
}

function normalizeFoundDlaDescriptor(
  value: unknown,
  context: string,
): FoundDlaDescriptor {
  invariant(
    typeof value === "object" && value !== null,
    `${context}: expected an object`,
  );
  const obj = value as { found?: unknown; descr?: unknown };
  invariant(
    typeof obj.found === "boolean",
    `${context}: expected found to be a boolean`,
  );

  if (!obj.found) {
    return { found: false };
  }

  assertDlaDescriptor(obj.descr, `${context}.descr`);
  return { found: true, descr: obj.descr };
}

/** Create a {@link FileIoApi} implementation backed by the native Node addon. */
export function createFileIoApi(
  native: NativeAddon,
  handles: SpiceHandleRegistry,
  stager: Pick<KernelStager, "resolvePathForSpice">,
  outputs: VirtualOutputStager,
): FileIoApi {
  const resolvePath = (path: string) => stager.resolvePathForSpice(path);

  const knownDasOutputs = new Map<string, VirtualOutput>();
  const dasOutputs = new Map<SpiceHandle, VirtualOutput>();
  const dasHandle = (handle: SpiceHandle, method: string) =>
    handles.lookup(handle, DAS_BACKED, method).nativeHandle;
  function registerDas(
    nativeHandle: number,
    output?: VirtualOutput,
  ): SpiceHandle {
    try {
      const handle = handles.register("DAS", nativeHandle);
      if (output !== undefined) {
        try {
          outputs.markOpen(output);
          dasOutputs.set(handle, output);
        } catch (error) {
          handles.close(
            handle,
            DAS_BACKED,
            () => {},
            "DAS registration rollback",
          );
          throw error;
        }
      }
      return handle;
    } catch (error) {
      native.dasllc(nativeHandle);
      throw error;
    }
  }

  function closeDasBacked(handle: SpiceHandle, context: string): void {
    handles.close(
      handle,
      DAS_BACKED,
      (entry) => {
        // CSPICE dascls_c closes both DAS and DLA handles; tspice dlacls is
        // an alias, not a separate CSPICE C entrypoint.
        if (context === "dasllc") native.dasllc(entry.nativeHandle);
        else native.dascls(entry.nativeHandle);
      },
      context,
    );
    const output = dasOutputs.get(handle);
    if (output !== undefined) {
      outputs.markClosed(output);
      dasOutputs.delete(handle);
    }
  }

  const api = {
    exists: (path: string) => {
      const exists = native.exists(resolvePath(path));
      invariant(
        typeof exists === "boolean",
        "Expected native backend exists() to return a boolean",
      );
      return exists;
    },

    getfat: (path: string) => {
      const result = native.getfat(resolvePath(path));
      invariant(
        typeof result === "object" && result !== null,
        "Expected native backend getfat() to return an object",
      );
      const obj = result as { arch?: unknown; type?: unknown };
      invariant(
        typeof obj.arch === "string",
        "Expected getfat().arch to be a string",
      );
      invariant(
        typeof obj.type === "string",
        "Expected getfat().type to be a string",
      );
      return { arch: obj.arch, type: obj.type };
    },

    dafopr: (path: string) =>
      handles.register("DAF", native.dafopr(resolvePath(path))),
    dafcls: (handle: SpiceHandle) =>
      handles.close(
        handle,
        ["DAF"],
        (e) => native.dafcls(e.nativeHandle),
        "dafcls",
      ),
    dafbfs: (handle: SpiceHandle) =>
      native.dafbfs(handles.lookup(handle, ["DAF"], "dafbfs").nativeHandle),
    daffna: (handle: SpiceHandle) => {
      const found = native.daffna(
        handles.lookup(handle, ["DAF"], "daffna").nativeHandle,
      );
      invariant(
        typeof found === "boolean",
        "Expected native backend daffna() to return a boolean",
      );
      return found;
    },

    dasac: (handle, lines) => {
      const { n, width, table } = dasCommentTable(lines);
      // Array accessors can close the original claim. Look it up after snapshotting.
      const h = dasHandle(handle, "dasac");
      native.dasac(h, n, width, table);
    },
    dasdc: (handle) => native.dasdc(dasHandle(handle, "dasdc")),
    dasec: (handle, bufsiz, buffln = 1024) => {
      const h = dasHandle(handle, "dasec");
      dasCommentPageBytes(bufsiz, buffln);
      const { n, done, bytes } = native.dasec(h, bufsiz, buffln);
      return dasCommentPage(n, done, bytes, bufsiz, buffln);
    },
    dasonw: (
      file: string | VirtualOutput,
      ftype: string,
      ifname: string,
      ncomr: number,
    ) => {
      const target = dasFileTarget(file);
      assertSpiceInt32(ncomr, "dasonw(ncomr)");
      const path =
        typeof target === "string"
          ? resolvePath(target)
          : outputs.resolvePathForSpice(target);
      const output =
        typeof target === "string" ? knownDasOutputs.get(path) : target;
      const handle = registerDas(
        native.dasonw(path, dasText(ftype), dasText(ifname), ncomr),
        output,
      );
      if (output) knownDasOutputs.set(path, output);
      return handle;
    },
    dasops: () => registerDas(native.dasops()),
    dasopw: (file: string | VirtualOutput) => {
      const target = dasFileTarget(file);
      const path =
        typeof target === "string"
          ? resolvePath(target)
          : outputs.resolvePathForSpice(target);
      const output = knownDasOutputs.get(path);
      if (typeof target !== "string" && !output)
        throw new RangeError(
          "dasopw requires a VirtualOutput created by dasonw on this backend",
        );
      return registerDas(native.dasopw(path), output);
    },
    dashfn: (handle: SpiceHandle, namlen = 256) => {
      assertSpiceInt32(namlen, "dashfn(namlen)");
      const value = native.dashfn(
        dasHandle(handle, "dashfn"),
        Math.min(256, namlen),
      );
      if (typeof value !== "string")
        throw new TypeError("Invalid DASHFN result");
      return value;
    },
    dashfs: (handle: SpiceHandle) =>
      decodeDasSummary(native.dashfs(dasHandle(handle, "dashfs"))),
    daslla: (handle: SpiceHandle) =>
      decodeDasAddresses(native.daslla(dasHandle(handle, "daslla"))),
    dasllc: (handle: SpiceHandle) => closeDasBacked(handle, "dasllc"),
    dasrfr: (handle: SpiceHandle, idwlen = 9, ifnlen = 61) => {
      assertSpiceInt32(idwlen, "dasrfr(idwlen)");
      assertSpiceInt32(ifnlen, "dasrfr(ifnlen)");
      const record = native.dasrfr(
        dasHandle(handle, "dasrfr"),
        Math.min(9, idwlen),
        Math.min(61, ifnlen),
      );
      return decodeDasFileRecord(record.idword, record.ifname, record.counts);
    },
    daswbr: (handle: SpiceHandle) => native.daswbr(dasHandle(handle, "daswbr")),
    dasopr: (path: string) =>
      handles.register("DAS", native.dasopr(resolvePath(path))),
    dascls: (handle: SpiceHandle) => closeDasBacked(handle, "dascls"),

    dlaopn: (path: string, ftype: string, ifname: string, ncomch: number) =>
      handles.register(
        "DLA",
        native.dlaopn(resolvePath(path), ftype, ifname, ncomch),
      ),

    dlabfs: (handle: SpiceHandle) =>
      normalizeFoundDlaDescriptor(
        native.dlabfs(
          handles.lookup(handle, DAS_BACKED, "dlabfs").nativeHandle,
        ),
        "dlabfs()",
      ),

    dlafns: (handle: SpiceHandle, descr: DlaDescriptor) => {
      assertDlaDescriptor(descr, "dlafns(descr)");
      return normalizeFoundDlaDescriptor(
        native.dlafns(
          handles.lookup(handle, DAS_BACKED, "dlafns").nativeHandle,
          descr,
        ),
        "dlafns()",
      );
    },

    dlacls: (handle: SpiceHandle) => closeDasBacked(handle, "dlacls"),

    dskopn: (path: string, ifname: string, ncomch: number) =>
      // DSKs are DAS-backed; register as DAS so `dascls` can close it.
      handles.register("DAS", native.dskopn(resolvePath(path), ifname, ncomch)),

    dskmi2: (
      nv: number,
      vrtces: readonly number[],
      np: number,
      plates: readonly number[],
      finscl: number,
      corscl: number,
      worksz: number,
      voxpsz: number,
      voxlsz: number,
      makvtl: boolean,
      spxisz: number,
    ) => {
      const result = native.dskmi2(
        nv,
        vrtces,
        np,
        plates,
        finscl,
        corscl,
        worksz,
        voxpsz,
        voxlsz,
        makvtl,
        spxisz,
      );
      invariant(
        typeof result === "object" && result !== null,
        "Expected native backend dskmi2() to return an object",
      );
      const obj = result as { spaixd?: unknown; spaixi?: unknown };
      invariant(
        Array.isArray(obj.spaixd),
        "Expected dskmi2().spaixd to be an array",
      );
      invariant(
        Array.isArray(obj.spaixi),
        "Expected dskmi2().spaixi to be an array",
      );
      invariant(
        obj.spaixd.every((v) => typeof v === "number"),
        "Expected dskmi2().spaixd to be a number[]",
      );
      invariant(
        obj.spaixi.every((v) => typeof v === "number"),
        "Expected dskmi2().spaixi to be a number[]",
      );
      return { spaixd: obj.spaixd as number[], spaixi: obj.spaixi as number[] };
    },

    dskw02: (
      handle: SpiceHandle,
      center: number,
      surfid: number,
      dclass: number,
      frame: string,
      corsys: number,
      corpar: readonly number[],
      mncor1: number,
      mxcor1: number,
      mncor2: number,
      mxcor2: number,
      mncor3: number,
      mxcor3: number,
      first: number,
      last: number,
      nv: number,
      vrtces: readonly number[],
      np: number,
      plates: readonly number[],
      spaixd: readonly number[],
      spaixi: readonly number[],
    ) =>
      native.dskw02(
        handles.lookup(handle, ["DAS"], "dskw02").nativeHandle,
        center,
        surfid,
        dclass,
        frame,
        corsys,
        corpar,
        mncor1,
        mxcor1,
        mncor2,
        mxcor2,
        mncor3,
        mxcor3,
        first,
        last,
        nv,
        vrtces,
        np,
        plates,
        spaixd,
        spaixi,
      ),
  } satisfies FileIoApi;

  Object.defineProperty(api, "__debugOpenHandleCount", {
    value: () => handles.size(),
    enumerable: false,
  });

  return api;
}

/** Create a {@link FileIoKitApi} implementation for virtual output reads. */
export function createFileIoKitApi(outputs: VirtualOutputStager): FileIoKitApi {
  return {
    readVirtualOutput: (output: VirtualOutput) => {
      invariant(
        output && typeof output === "object",
        "readVirtualOutput(output): expected an object",
      );
      const obj = output as { kind?: unknown; path?: unknown };
      invariant(
        obj.kind === "virtual-output",
        "readVirtualOutput(output): expected kind='virtual-output'",
      );
      invariant(
        typeof obj.path === "string",
        "readVirtualOutput(output): expected path to be a string",
      );
      return outputs.readVirtualOutput({
        kind: "virtual-output",
        path: obj.path,
      });
    },
  };
}
