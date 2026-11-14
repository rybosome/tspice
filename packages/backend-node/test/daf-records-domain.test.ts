import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSpiceHandleRegistry } from "@rybosome/tspice-core";
import { expect, it, vi } from "vitest";
import { getNativeAddon, type NativeAddon } from "../src/native.js";
import { createFileIoApi } from "../src/domains/file-io.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";
const file = fileURLToPath(
  new URL(
    "../../py-parity-checking/fixtures/kernels/audit-two-segment.bsp",
    import.meta.url,
  ),
);
const stager = { resolvePathForSpice: (s: string) => s };
function singleRead(values: number[], used: number) {
  const seen = new Set<string>();
  return new Proxy(values, {
    get(t, k, r) {
      if (typeof k === "string" && (k === "length" || /^\d+$/.test(k))) {
        if (seen.has(k) || (k !== "length" && Number(k) >= used))
          throw new Error("Extra DAF argument read: " + k);
        seen.add(k);
      }
      return Reflect.get(t, k, r);
    },
  });
}
function setup() {
  const handles = createSpiceHandleRegistry(),
    h = handles.register("DAF", 17);
  const mock = {
    dafps: vi.fn((..._args: unknown[]) => new Uint8Array(16)),
    dafus: vi.fn((..._args: unknown[]) => ({ dc: [-0], ic: [-1] })),
    dafgsr: vi.fn((..._args: unknown[]) => ({
      found: true,
      data: Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 8),
    })),
    dafrfr: vi.fn((..._args: unknown[]) => ({
      nd: 2,
      ni: 6,
      ifname: Uint8Array.of(0xef, 0xbb, 0xbf, 65, 9),
      fward: 2,
      bward: 2,
      free: 400,
    })),
    dafrda: vi.fn((..._args: unknown[]) => new Uint8Array(8)),
    dafgda: vi.fn((..._args: unknown[]) => [NaN]),
    dafcls: vi.fn(),
  };
  const api = createFileIoApi(mock as unknown as NativeAddon, handles, stager);
  return { api, mock, handles, h };
}
it("captures only effective component prefixes and decodes a private unaligned byte view", () => {
  const { api, mock } = setup();
  const result = api.dafps(
    1,
    1,
    singleRead([-0, NaN], 1),
    singleRead([-1, NaN], 1),
  );
  expect(mock.dafps.mock.calls[0]).toEqual([1, 1, [-0], [-1]]);
  result[0] = 99;
  expect(mock.dafps.mock.results[0]?.value[0]).toBe(0);
  const data = new Uint8Array(19);
  data[1] = 128;
  const view = data.subarray(1, 19),
    u = api.dafus(view, 1, 1);
  expect(mock.dafus.mock.calls[0]?.[0]).toEqual(view.slice(0, 16));
  data.fill(9);
  expect(mock.dafus.mock.calls[0]?.[0]).not.toEqual(view.slice(0, 16));
  u.dc[0] = 1;
  u.ic[0] = 1;
  expect(mock.dafus.mock.results[0]?.value).toEqual({ dc: [-0], ic: [-1] });
});
it("checks native record outputs and returns owned values including trailing name bytes", () => {
  const { api, h, mock } = setup();
  expect(api.dafrfr(h)).toEqual({
    nd: 2,
    ni: 6,
    ifname: "\ufeffA\t",
    fward: 2,
    bward: 2,
    free: 400,
  });
  const got = api.dafgsr(h, 7, 2, 2);
  expect(got.found).toBe(true);
  if (got.found) {
    got.data[0] = 99;
    expect(mock.dafgsr.mock.results[0]?.value.data[0]).toBe(1);
  }
  expect(api.dafgda(h, 385, 385)).toEqual([NaN]);
  const physical = api.dafrda(h, 257, 257);
  physical[0] = 99;
  expect(mock.dafrda.mock.results[0]?.value[0]).toBe(0);
  mock.dafrfr.mockReturnValueOnce({
    nd: 2,
    ni: 6,
    ifname: Uint8Array.of(0xc3),
    fward: 2,
    bward: 2,
    free: 400,
  });
  expect(() => api.dafrfr(h, 2)).toThrow(TypeError);
  mock.dafgsr.mockReturnValueOnce({
    found: false,
    get data(): never {
      throw Error("read undefined data");
    },
  });
  expect(api.dafgsr(h, 100, 1, 1)).toEqual({ found: false });
});
const methods = ["dafgsr", "dafrfr", "dafrda", "dafgda"] as const;
for (const op of methods)
  it(
    op +
      " rejects invalid, foreign, closed and wrong-kind DAF handles before native dispatch",
    () => {
      const { api, mock, handles } = setup(),
        closed = handles.register("DAF", 17);
      api.dafcls(closed);
      for (const bad of [
        closed,
        handles.register("DAS", 17),
        createSpiceHandleRegistry().register("DAF", 17),
        undefined,
      ])
        expect(() => Reflect.apply(api[op], api, [bad, 1, 1, 1])).toThrow();
      expect(mock[op]).not.toHaveBeenCalled();
    },
  );
it("rejects invalid dimensions and insufficient storage before the addon call", () => {
  const { api, h, mock } = setup();
  for (const axis of [2 ** 31, 0.5, NaN])
    expect(() => api.dafps(axis, 2, [], [])).toThrow();
  expect(() => api.dafps(1, 2, [2], [2 ** 31, 0])).toThrow();
  expect(() => api.dafus(new Uint8Array(7), 0, 1)).toThrow();
  expect(() => api.dafgda(h, 1, 33554433)).toThrow();
  expect(() => api.dafrfr(h, 0)).toThrow();
  for (const name of ["dafps", "dafus", "dafgda", "dafrfr"] as const)
    expect(mock[name]).not.toHaveBeenCalled();
});
const actual = it.runIf(nodeAddonAvailable());
actual("validates all six native callback widths and signed axes", () => {
  const raw = getNativeAddon();
  for (const n of [
    "dafps",
    "dafus",
    "dafgsr",
    "dafrfr",
    "dafrda",
    "dafgda",
  ] as const)
    expect(() => Reflect.apply(raw[n], raw, [])).toThrow();
  for (const n of ["dafrda", "dafgda"] as const)
    expect(() => raw[n](1, 1, 33554433)).toThrow(/range/);
  expect(() => raw.dafps(2, 2, [1], [1, 2])).toThrow();
  expect(() => raw.dafps(0, 1, [], [2 ** 31])).toThrow();
  expect(() => raw.dafus(new Uint8Array(7), 0, 1)).toThrow();
  expect(() => raw.dafgsr(1, 2 ** 31, 1, 1)).toThrow();
  expect(() => raw.dafrfr(1, -1)).toThrow();
});
actual(
  "retains defined IEEE values, packed mantissa bits and clears the unused half after an earlier call",
  () => {
    const raw = getNativeAddon();
    raw.dafps(0, 2, [], [0x12345678, -123456789]);
    const odd = raw.dafps(0, 1, [], [0x12345678]);
    expect([...odd.slice(4)]).toEqual([0, 0, 0, 0]);
    const packed = raw.dafps(
      4,
      2,
      [-0, NaN, Infinity, -Infinity],
      [0x12345678, -1],
    );
    expect(raw.dafus(packed, 4, 2)).toEqual({
      dc: [-0, NaN, Infinity, -Infinity],
      ic: [0x12345678, -1],
    });
    const backing = new Uint8Array(packed.length + 1);
    backing.set(packed, 1);
    expect(raw.dafus(backing.subarray(1), 4, 2).ic).toEqual([0x12345678, -1]);
    const dc = Array.from({ length: 125 }, (_, i) => i + 0.5),
      full = raw.dafps(2147483647, 2147483647, dc, []);
    expect(full.byteLength).toBe(1000);
    expect(raw.dafus(full, 2147483647, 2147483647)).toEqual({ dc, ic: [] });
    expect(raw.dafps(-1, -3, [], [])).toHaveLength(0);
    expect(raw.dafus(new Uint8Array(), -1, 0)).toEqual({ dc: [], ic: [] });
  },
);
actual(
  "reads actual header and physical record bits, clipped empty records, native LP64 high EOF and recovers after an address error",
  () => {
    const raw = getNativeAddon(),
      h = raw.dafopr(file);
    try {
      const { fward } = raw.dafrfr(h, 61);
      expect(raw.dafrfr(h, 1).ifname).toHaveLength(0);
      expect(raw.dafgsr(h, fward, 2147483647, -2147483648)).toEqual({
        found: true,
        data: new Uint8Array(),
      });
      const physical = raw.dafrda(h, (fward - 1) * 128 + 1, fward * 128);
      expect(physical).toEqual(
        new Uint8Array(
          fs.readFileSync(file).subarray((fward - 1) * 1024, fward * 1024),
        ),
      );
      expect(raw.dafgsr(h, fward, -2147483648, 2147483647)).toEqual({
        found: true,
        data: physical,
      });
      expect(raw.dafgsr(h, 2147483647, 1, 3)).toEqual({ found: false });
      expect(raw.dafrda(h, 2147483647, 2147483647)).toEqual(new Uint8Array(8));
      expect(raw.dafgda(h, 2147483647, 2147483647)).toEqual([0]);
      expect(() => raw.dafgda(h, 0, -1)).toThrow(/DAFNEGADDR/);
      expect(() => raw.dafrda(h, 100, 1)).toThrow(/DAFBEGGTEND/);
      expect(raw.dafrfr(h, 2147483647).fward).toBe(fward);
    } finally {
      raw.dafcls(h);
    }
  },
);

actual(
  "checks a foreign summary count in bounded storage before invoking the packed record translator",
  () => {
    const source = new URL(
      "../../py-parity-checking/fixtures/kernels/mgs_hga_hinge_v2.bc",
      import.meta.url,
    );
    const raw = getNativeAddon(),
      original = raw.dafopr(fileURLToPath(source));
    let rec: number;
    try {
      rec = raw.dafrfr(original, 61).fward;
    } finally {
      raw.dafcls(original);
    }
    const copy = fs.readFileSync(source);
    copy.writeDoubleBE(127, 1024 * (rec - 1) + 16);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-daf-records-")),
      out = path.join(dir, "bad-count.bc");
    try {
      fs.writeFileSync(out, copy);
      const h = raw.dafopr(out);
      try {
        expect(() => raw.dafgsr(h, rec, 1, 3)).toThrow(
          /Invalid non-native DAF summary record count/,
        );
        expect(raw.dafrfr(h, 61).fward).toBe(rec);
      } finally {
        raw.dafcls(h);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);
