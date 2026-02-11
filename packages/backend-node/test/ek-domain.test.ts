import { describe, expect, it } from "vitest";

import { createEkApi } from "../src/domains/ek.js";
import type { NativeAddon } from "../src/runtime/addon.js";
import type { KernelStager } from "../src/runtime/kernel-staging.js";

describe("backend-node ek domain wrapper", () => {
  it("resolves staged kernel paths for ekopr/ekopw/ekopn", () => {
    const seen: string[] = [];

    const native = {
      ekopr: (p: string) => {
        seen.push(`ekopr:${p}`);
        return 1;
      },
      ekopw: (p: string) => {
        seen.push(`ekopw:${p}`);
        return 2;
      },
      ekopn: (p: string, _ifname: string, _ncomch: number) => {
        seen.push(`ekopn:${p}`);
        return 3;
      },
      ekcls: (_handle: number) => {},
      ekntab: () => 0,
      ektnam: (_n: number) => "",
      eknseg: (_handle: number) => 0,
    } as const satisfies Pick<
      NativeAddon,
      "ekopr" | "ekopw" | "ekopn" | "ekcls" | "ekntab" | "ektnam" | "eknseg"
    >;

    const stager = {
      resolvePath: (p: string) => `/resolved${p}`,
    } satisfies Pick<KernelStager, "resolvePath">;

    const api = createEkApi(
      native as unknown as NativeAddon,
      stager as unknown as KernelStager,
    );

    api.ekopr("/kernels/a.ek");
    api.ekopw("kernels/b.ek");
    api.ekopn("c.ek", "IF", 0);

    expect(seen).toEqual([
      "ekopr:/resolved/kernels/a.ek",
      "ekopw:/resolvedkernels/b.ek",
      "ekopn:/resolvedc.ek",
    ]);
  });

  it("enforces ekntab() non-negative int32 postcondition", () => {
    const native = {
      ekntab: () => -1,
    } satisfies Pick<NativeAddon, "ekntab">;

    const api = createEkApi(native as unknown as NativeAddon);

    expect(() => api.ekntab()).toThrow(/non-negative|32-bit|integer/i);
  });

  it("enforces eknseg() non-negative int32 postcondition", () => {
    const native = {
      ekopr: (_p: string) => 123,
      eknseg: (_handle: number) => 1.5,
    } satisfies Pick<NativeAddon, "ekopr" | "eknseg">;

    const api = createEkApi(native as unknown as NativeAddon);

    const handle = api.ekopr("/tmp/file.ek");
    expect(() => api.eknseg(handle)).toThrow(/non-negative|32-bit|integer/i);
  });

  it("rejects negative indices for ektnam", () => {
    const native = {
      ektnam: (_n: number) => "",
    } satisfies Pick<NativeAddon, "ektnam">;

    const api = createEkApi(native as unknown as NativeAddon);

    expect(() => api.ektnam(-1)).toThrow(/>=\s*0|non-negative/i);
  });

  it("can bulk-close EK handles via internal teardown hook", () => {
    const closed: number[] = [];

    type EkApiDebug = {
      __debugOpenHandleCount(): number;
      __debugCloseAllHandles(): void;
    };

    const native = {
      ekopr: (_p: string) => 999,
      ekcls: (h: number) => closed.push(h),
    } satisfies Pick<NativeAddon, "ekopr" | "ekcls">;

    const api = createEkApi(native as unknown as NativeAddon) as unknown as ReturnType<
      typeof createEkApi
    > &
      EkApiDebug;

    const handle = api.ekopr("/tmp/file.ek");
    expect(api.__debugOpenHandleCount()).toBe(1);

    api.__debugCloseAllHandles();
    expect(closed).toEqual([999]);
    expect(api.__debugOpenHandleCount()).toBe(0);

    // Still rejects unknown/closed handles.
    expect(() => api.ekcls(handle)).toThrow(/invalid|closed/i);
  });
});
