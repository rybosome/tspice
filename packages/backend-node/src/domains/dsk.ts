import {
  legacyPlateRows,
  maxLegacyPlateRows,
  surfaceGrid,
  surfaceVectors,
  surfaceTextBytes,
  assertSpiceInt32,
  dskRay,
  dskRayBatch,
  dskRaySelection,
  dskPoint,
  dskRaySource,
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
    illum_pl02(handle, dladsc, target, et, abcorr, obsrvr, spoint) {
      const h = handles.lookup(handle, DAS_BACKED, "illum_pl02").nativeHandle;
      const desc = snapshotDskDataDescriptor(dladsc);
      if (!Number.isFinite(et))
        throw new TypeError("Expected finite plate epoch");
      const words = dskRay(spoint);
      surfaceTextBytes(target);
      surfaceTextBytes(abcorr);
      surfaceTextBytes(obsrvr);
      const out = new Float64Array(3),
        ids = new Int32Array(1);
      native.illum_pl02(h, desc, target, et, abcorr, obsrvr, words, out, ids);
      return { phase: out[0]!, solar: out[1]!, emissn: out[2]! };
    },
    illum_plid_pl02(handle, dladsc, target, et, abcorr, obsrvr, spoint, plid) {
      const h = handles.lookup(
        handle,
        DAS_BACKED,
        "illum_plid_pl02",
      ).nativeHandle;
      const desc = snapshotDskDataDescriptor(dladsc);
      if (!Number.isFinite(et))
        throw new TypeError("Expected finite plate epoch");
      assertSpiceInt32(plid, "plate ID");
      const words = dskRay(spoint);
      surfaceTextBytes(target);
      surfaceTextBytes(abcorr);
      surfaceTextBytes(obsrvr);
      const out = new Float64Array(7),
        ids = new Int32Array(2);
      native.illum_plid_pl02(
        h,
        desc,
        target,
        et,
        abcorr,
        obsrvr,
        words,
        plid,
        out,
        ids,
      );
      return {
        trgepc: out[0]!,
        srfvec: dskPoint([out[1]!, out[2]!, out[3]!]),
        phase: out[4]!,
        solar: out[5]!,
        emissn: out[6]!,
        visible: ids[0] !== 0,
        lit: ids[1] !== 0,
      };
    },
    limb_pl02(handle, dladsc, target, et, fixref, abcorr, obsrvr, npts) {
      const h = handles.lookup(handle, DAS_BACKED, "limb_pl02").nativeHandle;
      const desc = snapshotDskDataDescriptor(dladsc);
      if (!Number.isFinite(et))
        throw new TypeError("Expected finite plate epoch");
      const rows = legacyPlateRows(npts);
      surfaceTextBytes(target);
      surfaceTextBytes(fixref);
      surfaceTextBytes(abcorr);
      surfaceTextBytes(obsrvr);
      const out = new Float64Array(4 + 3 * rows),
        ids = new Int32Array(rows);
      native.limb_pl02(
        h,
        desc,
        target,
        et,
        fixref,
        abcorr,
        obsrvr,
        npts,
        out,
        ids,
      );
      return {
        trgepc: out[0]!,
        obspos: dskPoint([out[1]!, out[2]!, out[3]!]),
        lmbpts: surfaceVectors(out.subarray(4), npts),
        pltids: Array.from(ids.subarray(0, npts)),
      };
    },
    llgrid_pl02(handle, dladsc, grid) {
      const h = handles.lookup(handle, DAS_BACKED, "llgrid_pl02").nativeHandle;
      const desc = snapshotDskDataDescriptor(dladsc);
      const { count: npts, words } = surfaceGrid(grid, 2, maxLegacyPlateRows);
      const rows = legacyPlateRows(npts);
      const out = new Float64Array(3 * rows),
        ids = new Int32Array(rows);
      native.llgrid_pl02(h, desc, npts, words, out, ids);
      return {
        srfpts: surfaceVectors(out.subarray(0), npts),
        pltids: Array.from(ids.subarray(0, npts)),
      };
    },
    subpt_pl02(handle, dladsc, method, target, et, abcorr, obsrvr) {
      const h = handles.lookup(handle, DAS_BACKED, "subpt_pl02").nativeHandle;
      const desc = snapshotDskDataDescriptor(dladsc);
      if (!Number.isFinite(et))
        throw new TypeError("Expected finite plate epoch");
      surfaceTextBytes(method);
      surfaceTextBytes(target);
      surfaceTextBytes(abcorr);
      surfaceTextBytes(obsrvr);
      const out = new Float64Array(4),
        ids = new Int32Array(1);
      native.subpt_pl02(h, desc, method, target, et, abcorr, obsrvr, out, ids);
      return {
        spoint: dskPoint([out[0]!, out[1]!, out[2]!]),
        alt: out[3]!,
        plateID: ids[0]!,
      };
    },
    subsol_pl02(handle, dladsc, method, target, et, abcorr, obsrvr) {
      const h = handles.lookup(handle, DAS_BACKED, "subsol_pl02").nativeHandle;
      const desc = snapshotDskDataDescriptor(dladsc);
      if (!Number.isFinite(et))
        throw new TypeError("Expected finite plate epoch");
      surfaceTextBytes(method);
      surfaceTextBytes(target);
      surfaceTextBytes(abcorr);
      surfaceTextBytes(obsrvr);
      const out = new Float64Array(4),
        ids = new Int32Array(1);
      native.subsol_pl02(h, desc, method, target, et, abcorr, obsrvr, out, ids);
      return {
        spoint: dskPoint([out[0]!, out[1]!, out[2]!]),
        dist: out[3]!,
        plateID: ids[0]!,
      };
    },
    term_pl02(
      handle,
      dladsc,
      trmtyp,
      source,
      target,
      et,
      fixref,
      abcorr,
      obsrvr,
      npts,
    ) {
      const h = handles.lookup(handle, DAS_BACKED, "term_pl02").nativeHandle;
      const desc = snapshotDskDataDescriptor(dladsc);
      if (!Number.isFinite(et))
        throw new TypeError("Expected finite plate epoch");
      const rows = legacyPlateRows(npts);
      surfaceTextBytes(trmtyp);
      surfaceTextBytes(source);
      surfaceTextBytes(target);
      surfaceTextBytes(fixref);
      surfaceTextBytes(abcorr);
      surfaceTextBytes(obsrvr);
      const out = new Float64Array(4 + 3 * rows),
        ids = new Int32Array(rows);
      native.term_pl02(
        h,
        desc,
        trmtyp,
        source,
        target,
        et,
        fixref,
        abcorr,
        obsrvr,
        npts,
        out,
        ids,
      );
      return {
        trgepc: out[0]!,
        obspos: dskPoint([out[1]!, out[2]!, out[3]!]),
        trmpts: surfaceVectors(out.subarray(4), npts),
        pltids: Array.from(ids.subarray(0, npts)),
      };
    },
    dskx02(handle, dladsc, vertex, raydir) {
      const h = handles.lookup(handle, DAS_BACKED, "dskx02").nativeHandle,
        desc = snapshotDskDataDescriptor(dladsc),
        v = dskRay(vertex),
        d = dskRay(raydir);
      const out = native.dskx02(h, desc, v, d);
      if (!out.found) return { found: false };
      assertI32(out.plid, "plate ID");
      return { found: true, plid: out.plid, xpt: dskPoint(out.xpt) };
    },
    dskxsi(
      pri,
      target,
      srflst,
      et,
      fixref,
      vertex,
      raydir,
      maxd = 1,
      maxi = 1,
    ) {
      const surfaces = dskRaySelection(pri, target, srflst, et, fixref);
      assertI32(maxd, "maxd");
      assertI32(maxi, "maxi");
      const v = dskRay(vertex),
        d = dskRay(raydir);
      const out = native.dskxsi(
        pri,
        target,
        surfaces,
        et,
        fixref,
        v,
        d,
        maxd,
        maxi,
      );
      return out.found
        ? dskRaySource(out.handle, out.plate, out.dla, out.words)
        : { found: false };
    },
    dskxv(pri, target, srflst, et, fixref, vertices, dirs) {
      const surfaces = dskRaySelection(pri, target, srflst, et, fixref);
      const { v, d, n } = dskRayBatch(vertices, dirs);
      const out = native.dskxv(pri, target, surfaces, et, fixref, v, d);
      if (out.length !== n) throw new Error("Incorrect DSK ray result count");
      return out.map((x) =>
        x === null ? { found: false } : { found: true, xpt: dskPoint(x) },
      );
    },
    dskgtl(key) {
      assertI32(key, "DSK tolerance key");
      return native.dskgtl(key);
    },
    dskstl(key, value) {
      assertI32(key, "DSK tolerance key");
      if (!Number.isFinite(value))
        throw new TypeError("Expected finite DSK tolerance");
      return native.dskstl(key, value);
    },
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
