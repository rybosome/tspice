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
import type { SpiceHandleKind, SpiceHandleRegistry } from "../runtime/spice-handles.js";

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

function assertFiniteNumber(value: unknown, context: string): asserts value is number {
  invariant(typeof value === "number" && Number.isFinite(value), `${context}: expected a finite number`);
}

function normalizeDskDescriptor(value: unknown, context: string): DskDescriptor {
  invariant(typeof value === "object" && value !== null, `${context}: expected an object`);
  const obj = value as Record<string, unknown>;

  for (const k of ["surfce", "center", "dclass", "dtype", "frmcde", "corsys"] as const) {
    assertI32(obj[k], `${context}.${k}`);
  }

  invariant(Array.isArray(obj.corpar), `${context}.corpar: expected an array`);
  invariant(obj.corpar.length === 10, `${context}.corpar: expected length 10`);
  for (let i = 0; i < obj.corpar.length; i++) {
    assertFiniteNumber(obj.corpar[i], `${context}.corpar[${i}]`);
  }

  for (const k of [
    "co1min",
    "co1max",
    "co2min",
    "co2max",
    "co3min",
    "co3max",
    "start",
    "stop",
  ] as const) {
    assertFiniteNumber(obj[k], `${context}.${k}`);
  }

  return obj as unknown as DskDescriptor;
}

function normalizeDskType2Bookkeeping(value: unknown, context: string): DskType2Bookkeeping {
  invariant(typeof value === "object" && value !== null, `${context}: expected an object`);
  const obj = value as Record<string, unknown>;

  for (const k of ["nv", "np", "nvxtot", "cgscal", "vtxnpl", "voxnpt", "voxnpl"] as const) {
    assertI32(obj[k], `${context}.${k}`);
  }

  invariant(Array.isArray(obj.vtxbds), `${context}.vtxbds: expected an array`);
  invariant(obj.vtxbds.length === 3, `${context}.vtxbds: expected length 3`);
  for (let axis = 0; axis < 3; axis++) {
    const pair = obj.vtxbds[axis];
    invariant(Array.isArray(pair), `${context}.vtxbds[${axis}]: expected an array`);
    invariant(pair.length === 2, `${context}.vtxbds[${axis}]: expected length 2`);
    assertFiniteNumber(pair[0], `${context}.vtxbds[${axis}][0]`);
    assertFiniteNumber(pair[1], `${context}.vtxbds[${axis}][1]`);
  }

  assertFiniteNumber(obj.voxsiz, `${context}.voxsiz`);

  invariant(Array.isArray(obj.voxori), `${context}.voxori: expected an array`);
  invariant(obj.voxori.length === 3, `${context}.voxori: expected length 3`);
  for (let i = 0; i < 3; i++) {
    assertFiniteNumber(obj.voxori[i], `${context}.voxori[${i}]`);
  }

  invariant(Array.isArray(obj.vgrext), `${context}.vgrext: expected an array`);
  invariant(obj.vgrext.length === 3, `${context}.vgrext: expected length 3`);
  for (let i = 0; i < 3; i++) {
    assertI32(obj.vgrext[i], `${context}.vgrext[${i}]`);
  }

  return obj as unknown as DskType2Bookkeeping;
}

export function createDskApi(native: NativeAddon, handles: SpiceHandleRegistry): DskApi {
  return {
    dskobj: (dsk: string, bodids: SpiceIntCell) => {
      native.dskobj(dsk, bodids as unknown as number);
    },

    dsksrf: (dsk: string, bodyid: number, srfids: SpiceIntCell) => {
      native.dsksrf(dsk, bodyid, srfids as unknown as number);
    },

    dskgd: (handle: SpiceHandle, dladsc: DlaDescriptor) => {
      assertDlaDescriptor(dladsc, "dskgd(dladsc)");
      const entry = handles.lookup(handle, DAS_BACKED, "dskgd");
      return normalizeDskDescriptor(native.dskgd(entry.nativeHandle, dladsc as unknown as Record<string, unknown>), "dskgd()");
    },

    dskb02: (handle: SpiceHandle, dladsc: DlaDescriptor) => {
      assertDlaDescriptor(dladsc, "dskb02(dladsc)");
      const entry = handles.lookup(handle, DAS_BACKED, "dskb02");
      return normalizeDskType2Bookkeeping(
        native.dskb02(entry.nativeHandle, dladsc as unknown as Record<string, unknown>),
        "dskb02()",
      );
    },
  } satisfies DskApi;
}
