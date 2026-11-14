import {
  snapshotDskDataDescriptor,
  dskPageStorage,
  dskDataRows,
} from "@rybosome/tspice-core";
import type {
  DlaDescriptor,
  DskApi,
  DskDescriptor,
  DskType2Bookkeeping,
  SpiceHandle,
  SpiceIntCell,
} from "@rybosome/tspice-backend-contract";
import { invariant } from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";
import type { KernelStager } from "../runtime/kernel-staging.js";
import type {
  SpiceHandleKind,
  SpiceHandleRegistry,
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
    invariant(v >= min, `${context}: expected ${key} >= ${min}`);
  }
}

function assertI32(value: unknown, context: string): asserts value is number {
  invariant(
    typeof value === "number" &&
      Number.isInteger(value) &&
      value >= I32_MIN &&
      value <= I32_MAX,
    `${context}: expected a 32-bit signed integer`,
  );
}

function assertFiniteNumber(
  value: unknown,
  context: string,
): asserts value is number {
  invariant(
    typeof value === "number" && Number.isFinite(value),
    `${context}: expected a finite number`,
  );
}

function readI32(
  obj: Record<string, unknown>,
  key: string,
  context: string,
): number {
  const value = obj[key];
  assertI32(value, `${context}.${key}`);
  return value;
}
function readFinite(
  obj: Record<string, unknown>,
  key: string,
  context: string,
): number {
  const value = obj[key];
  assertFiniteNumber(value, `${context}.${key}`);
  return value;
}
function readFiniteArray(
  value: unknown,
  length: number,
  context: string,
): number[] {
  invariant(Array.isArray(value), `${context}: expected an array`);
  invariant(value.length === length, `${context}: expected length ${length}`);
  return value.map((item: unknown, i: number) => {
    assertFiniteNumber(item, `${context}[${i}]`);
    return item;
  });
}
function readPair(value: unknown, context: string): [number, number] {
  const pair = readFiniteArray(value, 2, context);
  return [pair[0]!, pair[1]!];
}
function normalizeDskDescriptor(
  value: unknown,
  context: string,
): DskDescriptor {
  invariant(
    typeof value === "object" && value !== null,
    `${context}: expected an object`,
  );
  const obj = value as Record<string, unknown>;
  return {
    surfce: readI32(obj, "surfce", context),
    center: readI32(obj, "center", context),
    dclass: readI32(obj, "dclass", context),
    dtype: readI32(obj, "dtype", context),
    frmcde: readI32(obj, "frmcde", context),
    corsys: readI32(obj, "corsys", context),
    corpar: readFiniteArray(obj.corpar, 10, `${context}.corpar`),
    co1min: readFinite(obj, "co1min", context),
    co1max: readFinite(obj, "co1max", context),
    co2min: readFinite(obj, "co2min", context),
    co2max: readFinite(obj, "co2max", context),
    co3min: readFinite(obj, "co3min", context),
    co3max: readFinite(obj, "co3max", context),
    start: readFinite(obj, "start", context),
    stop: readFinite(obj, "stop", context),
  };
}
function normalizeDskType2Bookkeeping(
  value: unknown,
  context: string,
): DskType2Bookkeeping {
  invariant(
    typeof value === "object" && value !== null,
    `${context}: expected an object`,
  );
  const obj = value as Record<string, unknown>;
  const bounds: unknown = obj.vtxbds;
  invariant(
    Array.isArray(bounds) && bounds.length === 3,
    `${context}.vtxbds: expected three axis pairs`,
  );
  const origin = readFiniteArray(obj.voxori, 3, `${context}.voxori`);
  const extents = readFiniteArray(obj.vgrext, 3, `${context}.vgrext`);
  for (const extent of extents) assertI32(extent, `${context}.vgrext[]`);
  return {
    nv: readI32(obj, "nv", context),
    np: readI32(obj, "np", context),
    nvxtot: readI32(obj, "nvxtot", context),
    cgscal: readI32(obj, "cgscal", context),
    vtxnpl: readI32(obj, "vtxnpl", context),
    voxnpt: readI32(obj, "voxnpt", context),
    voxnpl: readI32(obj, "voxnpl", context),
    vtxbds: [
      readPair(bounds[0], `${context}.vtxbds[0]`),
      readPair(bounds[1], `${context}.vtxbds[1]`),
      readPair(bounds[2], `${context}.vtxbds[2]`),
    ],
    voxsiz: readFinite(obj, "voxsiz", context),
    voxori: [origin[0]!, origin[1]!, origin[2]!],
    vgrext: [extents[0]!, extents[1]!, extents[2]!],
  };
}

function readDskData(
  value: unknown,
  maxLength: number,
  integer: boolean,
): number[] {
  if (!Array.isArray(value) || value.length > maxLength)
    throw new RangeError("Unexpected native DSK data length");
  const result: number[] = [];
  for (const n of value) {
    if (integer) assertI32(n, "DSK integer result");
    if (typeof n !== "number") throw new TypeError("Expected numeric DSK data");
    result.push(n);
  }
  return result;
}

/** Create a {@link DskApi} implementation backed by the native Node addon. */
export function createDskApi(
  native: NativeAddon,
  handles: SpiceHandleRegistry,
  stager: Pick<KernelStager, "resolvePathForSpice">,
): DskApi {
  const resolvePath = (path: string) => stager.resolvePathForSpice(path);

  return {
    dskd02(handle, dladsc, item, start, room) {
      const actual = handles.lookup(handle, DAS_BACKED, "dskd02").nativeHandle;
      const descriptor = snapshotDskDataDescriptor(dladsc);
      assertI32(item, "dskd02(item)");
      assertI32(start, "dskd02(start)");
      assertI32(room, "dskd02(room)");
      const words = dskPageStorage(descriptor.dsize, room, 1, 8, 2147483647);
      const result = readDskData(
        native.dskd02(actual, descriptor, item, start, room),
        words,
        false,
      );
      return result;
    },
    dski02(handle, dladsc, item, start, room) {
      const actual = handles.lookup(handle, DAS_BACKED, "dski02").nativeHandle;
      const descriptor = snapshotDskDataDescriptor(dladsc);
      assertI32(item, "dski02(item)");
      assertI32(start, "dski02(start)");
      assertI32(room, "dski02(room)");
      const words = dskPageStorage(descriptor.isize, room, 1, 4, 2147483647);
      const result = readDskData(
        native.dski02(actual, descriptor, item, start, room),
        words,
        true,
      );
      return result;
    },
    dskn02(handle, dladsc, plid) {
      const actual = handles.lookup(handle, DAS_BACKED, "dskn02").nativeHandle;
      const descriptor = snapshotDskDataDescriptor(dladsc);
      assertI32(plid, "dskn02(plid)");
      const words = 3;
      const result = readDskData(
        native.dskn02(actual, descriptor, plid),
        words,
        false,
      );
      if (result.length !== words)
        throw new RangeError("Invalid DSK result length");
      return [result[0]!, result[1]!, result[2]!];
    },
    dskp02(handle, dladsc, start, room) {
      const actual = handles.lookup(handle, DAS_BACKED, "dskp02").nativeHandle;
      const descriptor = snapshotDskDataDescriptor(dladsc);
      assertI32(start, "dskp02(start)");
      assertI32(room, "dskp02(room)");
      const words = dskPageStorage(descriptor.isize, room, 3, 4, 2147483647);
      const result = readDskData(
        native.dskp02(actual, descriptor, start, room),
        words,
        true,
      );
      return dskDataRows(result);
    },
    dskv02(handle, dladsc, start, room) {
      const actual = handles.lookup(handle, DAS_BACKED, "dskv02").nativeHandle;
      const descriptor = snapshotDskDataDescriptor(dladsc);
      assertI32(start, "dskv02(start)");
      assertI32(room, "dskv02(room)");
      const words = dskPageStorage(descriptor.dsize, room, 3, 8, 2147483647);
      const result = readDskData(
        native.dskv02(actual, descriptor, start, room),
        words,
        false,
      );
      return dskDataRows(result);
    },
    dskz02(handle, dladsc) {
      const actual = handles.lookup(handle, DAS_BACKED, "dskz02").nativeHandle;
      const descriptor = snapshotDskDataDescriptor(dladsc);
      const words = 2;
      const result = readDskData(
        native.dskz02(actual, descriptor),
        words,
        true,
      );
      if (result.length !== words)
        throw new RangeError("Invalid DSK result length");
      return { nv: result[0]!, np: result[1]! };
    },
    dskcls(handle, optmiz) {
      if (typeof optmiz !== "boolean")
        throw new TypeError("Expected boolean optimize flag");
      handles.close(
        handle,
        DAS_BACKED,
        (entry) => {
          native.dskcls(entry.nativeHandle, optmiz);
        },
        "dskcls",
      );
    },
    dskobj: (dsk: string, bodids: SpiceIntCell) => {
      native.dskobj(resolvePath(dsk), bodids);
    },

    dsksrf: (dsk: string, bodyid: number, srfids: SpiceIntCell) => {
      native.dsksrf(resolvePath(dsk), bodyid, srfids);
    },

    dskgd: (handle: SpiceHandle, dladsc: DlaDescriptor) => {
      assertDlaDescriptor(dladsc, "dskgd(dladsc)");
      const entry = handles.lookup(handle, DAS_BACKED, "dskgd");
      return normalizeDskDescriptor(
        native.dskgd(entry.nativeHandle, dladsc),
        "dskgd()",
      );
    },

    dskb02: (handle: SpiceHandle, dladsc: DlaDescriptor) => {
      assertDlaDescriptor(dladsc, "dskb02(dladsc)");
      const entry = handles.lookup(handle, DAS_BACKED, "dskb02");
      return normalizeDskType2Bookkeeping(
        native.dskb02(entry.nativeHandle, dladsc),
        "dskb02()",
      );
    },
  } satisfies DskApi;
}
