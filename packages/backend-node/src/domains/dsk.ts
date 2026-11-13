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

/** Create a {@link DskApi} implementation backed by the native Node addon. */
export function createDskApi(
  native: NativeAddon,
  handles: SpiceHandleRegistry,
  stager: Pick<KernelStager, "resolvePathForSpice">,
): DskApi {
  const resolvePath = (path: string) => stager.resolvePathForSpice(path);

  return {
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
