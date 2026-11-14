import {
  copyDasBytes,
  copyDasValues,
  dasReadCount,
  dasFileTarget,
  copyDlaDescriptor,
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

const DAS_BACKED = ["DAS", "DLA"] as const satisfies readonly SpiceHandleKind[];

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

  return {
    found: true,
    descr: copyDlaDescriptor(obj.descr, `${context}.descr`),
  };
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

    dasadc: (
      handle: SpiceHandle,
      n: number,
      bpos: number,
      epos: number,
      datlen: number,
      data: Uint8Array,
    ) => {
      const id = dasHandle(handle, "dasadc");
      assertSpiceInt32(n, "dasadc(n)");
      assertSpiceInt32(bpos, "dasadc(bpos)");
      assertSpiceInt32(epos, "dasadc(epos)");
      assertSpiceInt32(datlen, "dasadc(datlen)");
      const owned = copyDasBytes(data);
      native.dasadc(id, n, bpos, epos, datlen, owned);
    },
    dasadd: (handle: SpiceHandle, n: number, data: readonly number[]) => {
      const id = dasHandle(handle, "dasadd");
      assertSpiceInt32(n, "dasadd(n)");
      const owned = copyDasValues(data, "double");
      native.dasadd(id, n, owned);
    },
    dasadi: (handle: SpiceHandle, n: number, data: readonly number[]) => {
      const id = dasHandle(handle, "dasadi");
      assertSpiceInt32(n, "dasadi(n)");
      const owned = copyDasValues(data, "integer");
      native.dasadi(id, n, owned);
    },
    dasrdc: (
      handle: SpiceHandle,
      first: number,
      last: number,
      bpos: number,
      epos: number,
      datlen: number,
      data: Uint8Array,
    ) => {
      const id = dasHandle(handle, "dasrdc");
      assertSpiceInt32(first, "dasrdc(first)");
      assertSpiceInt32(last, "dasrdc(last)");
      assertSpiceInt32(bpos, "dasrdc(bpos)");
      assertSpiceInt32(epos, "dasrdc(epos)");
      assertSpiceInt32(datlen, "dasrdc(datlen)");
      const owned = copyDasBytes(data);
      const count = owned.length;
      const result = copyDasBytes(
        native.dasrdc(id, first, last, bpos, epos, datlen, owned),
      );
      if (result.length !== count)
        throw new TypeError("Invalid DAS result length");
      return result;
    },
    dasrdd: (handle: SpiceHandle, first: number, last: number) => {
      const id = dasHandle(handle, "dasrdd");
      const count = dasReadCount(first, last, 8);
      const result = copyDasValues(native.dasrdd(id, first, last), "double");
      if (result.length !== count)
        throw new TypeError("Invalid DAS result length");
      return result;
    },
    dasrdi: (handle: SpiceHandle, first: number, last: number) => {
      const id = dasHandle(handle, "dasrdi");
      const count = dasReadCount(first, last, 4);
      const result = copyDasValues(native.dasrdi(id, first, last), "integer");
      if (result.length !== count)
        throw new TypeError("Invalid DAS result length");
      return result;
    },
    dasudc: (
      handle: SpiceHandle,
      first: number,
      last: number,
      bpos: number,
      epos: number,
      datlen: number,
      data: Uint8Array,
    ) => {
      const id = dasHandle(handle, "dasudc");
      assertSpiceInt32(first, "dasudc(first)");
      assertSpiceInt32(last, "dasudc(last)");
      assertSpiceInt32(bpos, "dasudc(bpos)");
      assertSpiceInt32(epos, "dasudc(epos)");
      assertSpiceInt32(datlen, "dasudc(datlen)");
      const owned = copyDasBytes(data);
      native.dasudc(id, first, last, bpos, epos, datlen, owned);
    },
    dasudd: (
      handle: SpiceHandle,
      first: number,
      last: number,
      data: readonly number[],
    ) => {
      const id = dasHandle(handle, "dasudd");
      assertSpiceInt32(first, "dasudd(first)");
      assertSpiceInt32(last, "dasudd(last)");
      const owned = copyDasValues(data, "double");
      native.dasudd(id, first, last, owned);
    },
    dasudi: (
      handle: SpiceHandle,
      first: number,
      last: number,
      data: readonly number[],
    ) => {
      const id = dasHandle(handle, "dasudi");
      assertSpiceInt32(first, "dasudi(first)");
      assertSpiceInt32(last, "dasudi(last)");
      const owned = copyDasValues(data, "integer");
      native.dasudi(id, first, last, owned);
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
      const owned = copyDlaDescriptor(descr, "dlafns(descr)");
      return normalizeFoundDlaDescriptor(
        native.dlafns(
          handles.lookup(handle, DAS_BACKED, "dlafns").nativeHandle,
          owned,
        ),
        "dlafns()",
      );
    },

    dlabbs: (handle: SpiceHandle) =>
      normalizeFoundDlaDescriptor(
        native.dlabbs(
          handles.lookup(handle, DAS_BACKED, "dlabbs").nativeHandle,
        ),
        "dlabbs()",
      ),

    dlafps: (handle: SpiceHandle, descr: DlaDescriptor) => {
      const owned = copyDlaDescriptor(descr, "dlafps(descr)");
      return normalizeFoundDlaDescriptor(
        native.dlafps(
          handles.lookup(handle, DAS_BACKED, "dlafps").nativeHandle,
          owned,
        ),
        "dlafps()",
      );
    },

    dlabns: (handle) => native.dlabns(dasHandle(handle, "dlabns")),
    dlaens: (handle) => native.dlaens(dasHandle(handle, "dlaens")),
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
