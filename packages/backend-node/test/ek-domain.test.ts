import { describe, expect, it } from "vitest";

import { createEkApi } from "../src/domains/ek.js";
import type { NativeAddon } from "../src/runtime/addon.js";
import type { KernelStager } from "../src/runtime/kernel-staging.js";
import { createSpiceHandleRegistry } from "../src/runtime/spice-handles.js";

type EkNativeDeps = Pick<
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

function makeNativeDeps(overrides: Partial<EkNativeDeps>): EkNativeDeps {
  const notImplemented = (name: string) => {
    return () => {
      throw new Error(`Unexpected call to native.${name}() in test`);
    };
  };

  return {
    ekopr: notImplemented("ekopr"),
    ekopw: notImplemented("ekopw"),
    ekopn: notImplemented("ekopn"),
    ekcls: notImplemented("ekcls"),
    ekntab: notImplemented("ekntab"),
    ektnam: notImplemented("ektnam"),
    eknseg: notImplemented("eknseg"),
    ekfind: notImplemented("ekfind"),
    ekgc: notImplemented("ekgc"),
    ekgd: notImplemented("ekgd"),
    ekgi: notImplemented("ekgi"),
    ekifld: notImplemented("ekifld"),
    ekacli: notImplemented("ekacli"),
    ekacld: notImplemented("ekacld"),
    ekaclc: notImplemented("ekaclc"),
    ekffld: notImplemented("ekffld"),
    ...overrides,
  };
}

describe("backend-node ek domain wrapper", () => {
  it("resolves staged kernel paths for ekopr/ekopw/ekopn", () => {
    const seen: string[] = [];

    const native = makeNativeDeps({
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
    });

    const stager = {
      // Use a wrapper format rather than naive string concatenation so the test
      // asserts intent (the resolved value is passed through), not incidental
      // path-joining artifacts.
      resolvePath: (p: string) => `RESOLVED(${p})`,
    } satisfies Pick<KernelStager, "resolvePath">;

    const api = createEkApi(native, createSpiceHandleRegistry(), stager);

    api.ekopr("/kernels/a.ek");
    api.ekopw("kernels/b.ek");
    api.ekopn("c.ek", "IF", 0);

    expect(seen).toEqual([
      "ekopr:RESOLVED(/kernels/a.ek)",
      "ekopw:RESOLVED(kernels/b.ek)",
      "ekopn:RESOLVED(c.ek)",
    ]);
  });

  it("enforces ekntab() non-negative int32 postcondition", () => {
    const native = makeNativeDeps({
      ekntab: () => -1,
    });

    const api = createEkApi(native, createSpiceHandleRegistry());

    expect(() => api.ekntab()).toThrow(/non-negative|32-bit|integer/i);
  });

  it("enforces eknseg() non-negative int32 postcondition", () => {
    const native = makeNativeDeps({
      ekopr: (_p: string) => 123,
      eknseg: (_handle: number) => 1.5,
    });

    const api = createEkApi(native, createSpiceHandleRegistry());

    const handle = api.ekopr("/tmp/file.ek");
    expect(() => api.eknseg(handle)).toThrow(/non-negative|32-bit|integer/i);
  });

  it("rejects negative indices for ektnam", () => {
    const native = makeNativeDeps({
      ektnam: (_n: number) => "",
    });

    const api = createEkApi(native, createSpiceHandleRegistry());

    expect(() => api.ektnam(-1)).toThrow(/>=\s*0|non-negative/i);
  });

  it("closes EK handles and rejects closed handles", () => {
    const closed: number[] = [];

    const native = makeNativeDeps({
      ekopr: (_p: string) => 999,
      ekcls: (h: number) => closed.push(h),
    });

    const handles = createSpiceHandleRegistry();
    const api = createEkApi(native, handles);

    const handle = api.ekopr("/tmp/file.ek");
    expect(handles.size()).toBe(1);

    api.ekcls(handle);
    expect(closed).toEqual([999]);
    expect(handles.size()).toBe(0);

    // Still rejects unknown/closed handles.
    expect(() => api.ekcls(handle)).toThrow(/invalid|closed/i);
  });
});
