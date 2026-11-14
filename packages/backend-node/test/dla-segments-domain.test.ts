import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
import { createSpiceHandleRegistry } from "@rybosome/tspice-core";
import { createFileIoApi } from "../src/domains/file-io.js";
import { getNativeAddon, type NativeAddon } from "../src/runtime/addon.js";
import { createVirtualOutputStager } from "../src/runtime/virtual-output-staging.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

const descriptor = {
  bwdptr: 4,
  fwdptr: -1,
  ibase: 20,
  isize: -1,
  dbase: 2,
  dsize: -1,
  cbase: 3,
  csize: -1,
};
function setup() {
  const raw = {
    dlabbs: vi.fn((..._args: unknown[]) => ({
      found: true,
      descr: { ...descriptor },
    })),
    dlafps: vi.fn((..._args: unknown[]) => ({ found: false })),
    dlabns: vi.fn(),
    dlaens: vi.fn(),
    dascls: vi.fn(),
  };
  const handles = createSpiceHandleRegistry();
  const api = createFileIoApi(
    raw as unknown as NativeAddon,
    handles,
    { resolvePathForSpice: (p) => p },
    createVirtualOutputStager(),
  );
  return { raw, handles, api, h: handles.register("DLA", 13) };
}
it("delegates opaque handles, snapshots provisional descriptors and owns the returned words", () => {
  const { raw, api, h } = setup();
  api.dlabns(h);
  api.dlaens(h);
  expect(raw.dlabns).toHaveBeenCalledWith(13);
  expect(raw.dlaens).toHaveBeenCalledWith(13);
  const got = api.dlabbs(h);
  raw.dlabbs.mock.results[0]!.value.descr.isize = 12;
  expect(got).toEqual({ found: true, descr: descriptor });
  const reads = new Map<PropertyKey, number>();
  const input = new Proxy(
    { ...descriptor },
    {
      get(t, k, r) {
        reads.set(k, (reads.get(k) ?? 0) + 1);
        return Reflect.get(t, k, r);
      },
    },
  );
  expect(api.dlafps(h, input)).toEqual({ found: false });
  input.ibase = 999;
  expect(raw.dlafps.mock.calls[0]).toEqual([13, descriptor]);
  expect([...reads.values()]).toEqual(new Array(8).fill(1));
});
it("checks a descriptor-shaped caller once before resolving its live owner token", () => {
  const { raw, api, h, handles } = setup();
  for (const bad of [
    handles.register("DAF", 13),
    createSpiceHandleRegistry().register("DLA", 13),
  ]) {
    expect(() => api.dlabbs(bad)).toThrow();
    expect(() => api.dlabns(bad)).toThrow();
    expect(() => api.dlaens(bad)).toThrow();
    expect(() => api.dlafps(bad, descriptor)).toThrow();
  }
  for (const bad of [
    { ...descriptor, ibase: -1 },
    { ...descriptor, isize: -2 },
    { ...descriptor, bwdptr: 2 ** 31 },
  ]) {
    expect(() => api.dlafps(h, bad)).toThrow();
  }
  expect(() =>
    api.dlafps(h, {
      ...descriptor,
      get isize() {
        api.dascls(h);
        return -1;
      },
    }),
  ).toThrow(/invalid|closed/);
  expect(raw.dlafps).not.toHaveBeenCalled();
});
it("rejects invalid found flags and nonintegral or missing descriptor words", () => {
  const { raw, api, h } = setup();
  for (const invalid of [
    { found: 1 },
    { found: true, descr: { ...descriptor, csize: NaN } },
    { found: true, descr: {} },
  ]) {
    raw.dlabbs.mockReturnValueOnce(invalid as ReturnType<typeof raw.dlabbs>);
    expect(() => api.dlabbs(h)).toThrow();
  }
  expect(api.dlabbs(h)).toEqual({ found: true, descr: descriptor });
});
it.runIf(nodeAddonAvailable)(
  "checks actual addon argument widths, recovers from an empty DLA and returns only defined descriptors",
  () => {
    const native = getNativeAddon(),
      dir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-dla-addon-"));
    try {
      const h = native.dlaopn(path.join(dir, "file.dla"), "DATA", "C07", 0);
      try {
        for (const n of ["dlabbs", "dlabns", "dlaens", "dlafps"] as const)
          expect(() =>
            Reflect.apply(native[n], native, [
              2 ** 31,
              ...(n === "dlafps" ? [descriptor] : []),
            ]),
          ).toThrow(/32-bit/);
        expect(() =>
          native.dlafps(h, { ...descriptor, cbase: Infinity }),
        ).toThrow(/32-bit/);
        expect(native.dlabbs(h)).toEqual({ found: false });
        expect(() => native.dlaens(h)).toThrowError(
          expect.objectContaining({
            spiceShort: "SPICE(DASNOSUCHADDRESS)",
            spiceTrace: "dlaens_c --> DLAENS --> DASA2L",
          }),
        );
        native.dlabns(h);
        const actual = native.dlabbs(h);
        expect(actual).toMatchObject({
          found: true,
          descr: { bwdptr: -1, isize: -1, dsize: -1, csize: -1 },
        });
        native.dlaens(h);
        expect(native.dlafps(h, actual.descr!)).toEqual({ found: false });
      } finally {
        native.dascls(h);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);

it.runIf(nodeAddonAvailable)(
  "persists the generic DLA control triple and a completed segment with defined integer record padding",
  () => {
    const raw = getNativeAddon(),
      dir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-controls-")),
      file = path.join(dir, "generic.dla");
    try {
      const h = raw.dlaopn(file, "DATA", "first record", 0);
      try {
        raw.dlabns(h);
        raw.dlaens(h);
      } finally {
        raw.dascls(h);
      }
      const bytes = fs.readFileSync(file);
      const reader = raw.dasopr(file);
      try {
        expect(raw.dasrdi(reader, 1, 11)).toEqual([
          1000000, 4, 4, -1, -1, 11, 0, 0, 0, 0, 0,
        ]);
      } finally {
        raw.dascls(reader);
      }
      // No reserved/comment records and only one data type: the directory is
      // record 2, and the sole integer data record is record 3.
      expect(bytes.length).toBe(3072);
      const tail = bytes.subarray(2048 + 44, 3072);
      expect(tail.length).toBe(980);
      expect(tail.every((x) => x === 0)).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);
