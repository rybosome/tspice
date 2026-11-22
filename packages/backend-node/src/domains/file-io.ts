import type {
  DlaDescriptor,
  FileIoApi,
  FileIoKitApi,
  FoundDlaDescriptor,
  SpiceHandle,
  VirtualOutput,
} from "@rybosome/tspice-backend-contract";
import {
  invariant,
  assertSpiceInt32,
  dafCommentTable,
  dafCommentPageBytes,
  dafCommentPage,
  dafReplacementBytes,
  dafComponentLayout,
  dafComponents,
  dafBytes,
  dafRecordBytes,
  dafAddressWords,
  dafFileNameCapacity,
  DAF_MAX_SUMMARY_BYTES,
  dafPathByteLength,
  dafSummaryFormat,
} from "@rybosome/tspice-core";

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
): FileIoApi {
  const resolvePath = (path: string) => stager.resolvePathForSpice(path);

  function closeDasBacked(handle: SpiceHandle, context: string): void {
    handles.close(
      handle,
      DAS_BACKED,
      (entry) => {
        // CSPICE dascls_c closes both DAS and DLA handles; tspice dlacls is
        // an alias, not a separate CSPICE C entrypoint.
        native.dascls(entry.nativeHandle);
      },
      context,
    );
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

    dafac: (handle, lines) => {
      const { n, width, table } = dafCommentTable(lines);
      // Array accessors can close the original handle. Look it up after snapshotting.
      const h = handles.lookup(handle, ["DAF"], "dafac").nativeHandle;
      native.dafac(h, n, width, table);
    },
    dafdc: (handle) =>
      native.dafdc(handles.lookup(handle, ["DAF"], "dafdc").nativeHandle),
    dafec: (handle, bufsiz, buffln = 1024) => {
      const h = handles.lookup(handle, ["DAF"], "dafec").nativeHandle;
      dafCommentPageBytes(bufsiz, buffln);
      const { n, done, bytes } = native.dafec(h, bufsiz, buffln);
      return dafCommentPage(n, done, bytes, bufsiz, buffln);
    },
    dafrs: (handle, summary) => {
      const bytes = dafReplacementBytes(summary);
      native.dafrs(
        handles.lookup(handle, ["DAF"], "dafrs").nativeHandle,
        bytes,
      );
    },
    dafps: (nd, ni, dc, ic) => {
      const { n, m, bytes } = dafComponentLayout(nd, ni);
      const result = native.dafps(
        nd,
        ni,
        dafComponents(dc, n, false),
        dafComponents(ic, m, true),
      );
      return dafBytes(result, bytes, true);
    },
    dafus: (summary, nd, ni) => {
      const { n, m, bytes } = dafComponentLayout(nd, ni);
      const result = native.dafus(dafBytes(summary, bytes), nd, ni);
      if (result.dc.length !== n || result.ic.length !== m)
        throw new TypeError("Invalid DAFUS component count");
      return {
        dc: dafComponents(result.dc, n, false),
        ic: dafComponents(result.ic, m, true),
      };
    },
    dafgsr: (handle, recno, begin, end) => {
      const h = handles.lookup(handle, ["DAF"], "dafgsr").nativeHandle;
      const bytes = dafRecordBytes(recno, begin, end, 2147483647);
      const result = native.dafgsr(h, recno, begin, end);
      if (result.found === false) return { found: false };
      if (result.found !== true)
        throw new TypeError("Invalid DAFGSR found flag");
      return { found: true, data: dafBytes(result.data, bytes, true) };
    },
    dafrfr: (handle, ifnlen = 61) => {
      const h = handles.lookup(handle, ["DAF"], "dafrfr").nativeHandle;
      const cap = dafFileNameCapacity(ifnlen);
      const { nd, ni, ifname, fward, bward, free } = native.dafrfr(h, cap);
      for (const v of [nd, ni, fward, bward, free])
        assertSpiceInt32(v, "DAFRFR file record integer");
      if (!(ifname instanceof Uint8Array) || ifname.byteLength >= cap)
        throw new TypeError("Invalid DAFRFR name bytes");
      return {
        nd,
        ni,
        ifname: new TextDecoder("utf-8", {
          fatal: true,
          ignoreBOM: true,
        }).decode(ifname),
        fward,
        bward,
        free,
      };
    },
    dafrda: (handle, begin, end) => {
      const h = handles.lookup(handle, ["DAF"], "dafrda").nativeHandle;
      const words = dafAddressWords(begin, end, 2147483647);
      return dafBytes(native.dafrda(h, begin, end), words * 8, true);
    },
    dafgda: (handle, begin, end) => {
      const h = handles.lookup(handle, ["DAF"], "dafgda").nativeHandle;
      const words = dafAddressWords(begin, end, 2147483647);
      const values = native.dafgda(h, begin, end);
      if (!Array.isArray(values) || values.length !== words)
        throw new TypeError("Invalid DAFGDA output count");
      return dafComponents(values, words, false);
    },
    dafbbs: (handle: SpiceHandle) =>
      native.dafbbs(handles.lookup(handle, ["DAF"], "dafbbs").nativeHandle),
    dafcs: (handle: SpiceHandle) =>
      native.dafcs(handles.lookup(handle, ["DAF"], "dafcs").nativeHandle),
    daffpa: (handle: SpiceHandle) => {
      const found = native.daffpa(
        handles.lookup(handle, ["DAF"], "daffpa").nativeHandle,
      );
      invariant(
        typeof found === "boolean",
        "Expected boolean DAF search result",
      );
      return found;
    },
    dafgh: () => handles.findOwned("DAF", native.dafgh(), "dafgh"),
    dafgn: (handle: SpiceHandle, namlen = DAF_MAX_SUMMARY_BYTES + 1) => {
      const entry = handles.lookup(handle, ["DAF"], "dafgn");
      assertSpiceInt32(namlen, "dafgn(namlen)");
      const capacity = Math.min(namlen, DAF_MAX_SUMMARY_BYTES + 1);
      const bytes = native.dafgn(entry.nativeHandle, capacity);
      invariant(
        bytes instanceof Uint8Array && bytes.byteLength < capacity,
        "Invalid DAF name bytes",
      );
      return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
        bytes,
      );
    },
    dafgs: (handle: SpiceHandle) => {
      const bytes = native.dafgs(
        handles.lookup(handle, ["DAF"], "dafgs").nativeHandle,
      );
      invariant(
        bytes instanceof Uint8Array &&
          bytes.byteLength >= 8 &&
          bytes.byteLength <= DAF_MAX_SUMMARY_BYTES &&
          bytes.byteLength % 8 === 0,
        "Invalid packed DAF summary size",
      );
      return new Uint8Array(bytes);
    },
    dafhsf: (handle: SpiceHandle) => {
      const { nd, ni } = native.dafhsf(
        handles.lookup(handle, ["DAF"], "dafhsf").nativeHandle,
      );
      return dafSummaryFormat(nd, ni);
    },
    dafopw: (path: string) => {
      dafPathByteLength(path);
      const resolved = path.length ? resolvePath(path) : path;
      dafPathByteLength(resolved);
      const handle = native.dafopw(resolved);
      try {
        return handles.register("DAF", handle);
      } catch (error) {
        try {
          native.dafcls(handle);
        } catch (closeError) {
          throw new AggregateError(
            [error, closeError],
            "Cannot register or close DAF writer",
          );
        }
        throw error;
      }
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
