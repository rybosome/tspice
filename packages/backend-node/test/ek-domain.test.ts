import { describe, expect, it } from "vitest";

import { createEkApi } from "../src/domains/ek.js";

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
    } as const;

    const api = createEkApi(native as any, {
      resolvePath: (p: string) => `/resolved${p}`,
    } as any);

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
    const api = createEkApi({
      ekntab: () => -1,
    } as any);

    expect(() => api.ekntab()).toThrow(/non-negative|32-bit|integer/i);
  });

  it("enforces eknseg() non-negative int32 postcondition", () => {
    const api = createEkApi({
      ekopr: (_p: string) => 123,
      eknseg: (_handle: number) => 1.5,
    } as any);

    const handle = api.ekopr("/tmp/file.ek");
    expect(() => api.eknseg(handle)).toThrow(/non-negative|32-bit|integer/i);
  });

  it("rejects negative indices for ektnam", () => {
    const api = createEkApi({
      ektnam: (_n: number) => "",
    } as any);

    expect(() => api.ektnam(-1)).toThrow(/>=\s*0|non-negative/i);
  });

  it("can bulk-close EK handles via internal teardown hook", () => {
    const closed: number[] = [];

    const api = createEkApi({
      ekopr: (_p: string) => 999,
      ekcls: (h: number) => closed.push(h),
    } as any) as any;

    const handle = api.ekopr("/tmp/file.ek");
    expect(api.__debugOpenHandleCount()).toBe(1);

    api.__debugCloseAllHandles();
    expect(closed).toEqual([999]);
    expect(api.__debugOpenHandleCount()).toBe(0);

    // Still rejects unknown/closed handles.
    expect(() => api.ekcls(handle)).toThrow(/invalid|closed/i);
  });
});
