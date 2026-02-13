import {
  assertSpiceInt32,
  assertSpiceInt32NonNegative,
  type EkApi,
  type SpiceHandle,
} from "@rybosome/tspice-backend-contract";
import { invariant } from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";
import type { KernelStager } from "../runtime/kernel-staging.js";
import type { SpiceHandleKind, SpiceHandleRegistry } from "../runtime/spice-handles.js";

const I32_MAX = 2147483647;

const EK_ONLY = ["EK"] as const satisfies readonly SpiceHandleKind[];

type NativeEkDeps = Pick<
  NativeAddon,
  | "ekopr"
  | "ekopw"
  | "ekopn"
  | "ekcls"
  | "ekntab"
  | "ektnam"
  | "eknseg"
  | "ekfind"
  | "ekgc"
  | "ekgd"
  | "ekgi"
  | "ekifld"
  | "ekacli"
  | "ekacld"
  | "ekaclc"
  | "ekffld"
>;

type KernelStagerEkDeps = Pick<KernelStager, "resolvePath">;

export function createEkApi<
  N extends NativeEkDeps,
  S extends KernelStagerEkDeps | undefined,
>(native: N, handles: SpiceHandleRegistry, stager?: S): EkApi {
  const registerEkHandle = (nativeHandle: number, context: string): SpiceHandle => {
    invariant(typeof nativeHandle === "number", `Expected native backend ${context} to return a number handle`);
    assertSpiceInt32(nativeHandle, `native backend ${context} handle`);
    return handles.register("EK", nativeHandle);
  };

  const resolvePath = (path: string) => {
    if (!stager) return path;

    try {
      return stager.resolvePath(path);
    } catch (error) {
      // Best-effort path resolution for *virtual-ish* kernel IDs only. If this
      // was an OS path (or some unexpected staging invariant), surface the error.
      const isVirtualish = path.startsWith("kernels/") || path.startsWith("/kernels/");
      if (!isVirtualish) {
        throw error;
      }
      return path;
    }
  };

  const api = {
    ekopr: (path: string) => registerEkHandle(native.ekopr(resolvePath(path)), "ekopr(path)"),
    ekopw: (path: string) => registerEkHandle(native.ekopw(resolvePath(path)), "ekopw(path)"),
    ekopn: (path: string, ifname: string, ncomch: number) => {
      assertSpiceInt32NonNegative(ncomch, "ekopn(ncomch)");
      return registerEkHandle(native.ekopn(resolvePath(path), ifname, ncomch), "ekopn(path,ifname,ncomch)");
    },
    ekcls: (handle: SpiceHandle) =>
      handles.close(handle, EK_ONLY, (e) => native.ekcls(e.nativeHandle), "ekcls"),

    ekntab: () => {
      const n = native.ekntab();

      invariant(
        typeof n === "number" &&
          Number.isInteger(n) &&
          n >= 0 &&
          n <= I32_MAX,
        "Expected native backend ekntab() to return a non-negative 32-bit signed integer",
      );
      return n;
    },

    ektnam: (n: number) => {
      assertSpiceInt32NonNegative(n, "ektnam(n)");
      const name = native.ektnam(n);
      invariant(typeof name === "string", "Expected native backend ektnam(n) to return a string");
      return name;
    },

    eknseg: (handle: SpiceHandle) => {
      const nseg = native.eknseg(handles.lookup(handle, EK_ONLY, "eknseg").nativeHandle);
      invariant(
        typeof nseg === "number" &&
          Number.isInteger(nseg) &&
          nseg >= 0 &&
          nseg <= I32_MAX,
        "Expected native backend eknseg(handle) to return a non-negative 32-bit signed integer",
      );
      return nseg;
    },

    ekfind: (query: string) => native.ekfind(query),

    ekgc: (selidx: number, row: number, elment: number) => {
      assertSpiceInt32NonNegative(selidx, "ekgc(selidx)");
      assertSpiceInt32NonNegative(row, "ekgc(row)");
      assertSpiceInt32NonNegative(elment, "ekgc(elment)");
      return native.ekgc(selidx, row, elment);
    },

    ekgd: (selidx: number, row: number, elment: number) => {
      assertSpiceInt32NonNegative(selidx, "ekgd(selidx)");
      assertSpiceInt32NonNegative(row, "ekgd(row)");
      assertSpiceInt32NonNegative(elment, "ekgd(elment)");
      return native.ekgd(selidx, row, elment);
    },

    ekgi: (selidx: number, row: number, elment: number) => {
      assertSpiceInt32NonNegative(selidx, "ekgi(selidx)");
      assertSpiceInt32NonNegative(row, "ekgi(row)");
      assertSpiceInt32NonNegative(elment, "ekgi(elment)");
      return native.ekgi(selidx, row, elment);
    },

    ekifld: (
      handle: SpiceHandle,
      tabnam: string,
      nrows: number,
      cnames: readonly string[],
      decls: readonly string[],
    ) => {
      assertSpiceInt32(nrows, "ekifld(nrows)", { min: 1 });
      return native.ekifld(handles.lookup(handle, EK_ONLY, "ekifld").nativeHandle, tabnam, nrows, cnames, decls);
    },

    ekacli: (
      handle: SpiceHandle,
      segno: number,
      column: string,
      ivals: readonly number[],
      entszs: readonly number[],
      nlflgs: readonly boolean[],
      rcptrs: readonly number[],
    ) => {
      assertSpiceInt32NonNegative(segno, "ekacli(segno)");
      native.ekacli(
        handles.lookup(handle, EK_ONLY, "ekacli").nativeHandle,
        segno,
        column,
        ivals,
        entszs,
        nlflgs,
        rcptrs,
      );
    },

    ekacld: (
      handle: SpiceHandle,
      segno: number,
      column: string,
      dvals: readonly number[],
      entszs: readonly number[],
      nlflgs: readonly boolean[],
      rcptrs: readonly number[],
    ) => {
      assertSpiceInt32NonNegative(segno, "ekacld(segno)");
      native.ekacld(
        handles.lookup(handle, EK_ONLY, "ekacld").nativeHandle,
        segno,
        column,
        dvals,
        entszs,
        nlflgs,
        rcptrs,
      );
    },

    ekaclc: (
      handle: SpiceHandle,
      segno: number,
      column: string,
      cvals: readonly string[],
      entszs: readonly number[],
      nlflgs: readonly boolean[],
      rcptrs: readonly number[],
    ) => {
      assertSpiceInt32NonNegative(segno, "ekaclc(segno)");
      native.ekaclc(
        handles.lookup(handle, EK_ONLY, "ekaclc").nativeHandle,
        segno,
        column,
        cvals,
        entszs,
        nlflgs,
        rcptrs,
      );
    },

    ekffld: (handle: SpiceHandle, segno: number, rcptrs: readonly number[]) => {
      assertSpiceInt32NonNegative(segno, "ekffld(segno)");
      native.ekffld(handles.lookup(handle, EK_ONLY, "ekffld").nativeHandle, segno, rcptrs);
    },
  } satisfies EkApi;

  return api;
}
