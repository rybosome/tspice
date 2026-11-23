import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSpiceHandleRegistry } from "@rybosome/tspice-core";
import { expect, it, vi } from "vitest";
import { createFileIoApi } from "../src/domains/file-io.js";
import { getNativeAddon, type NativeAddon } from "../src/native.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";
const fixture = new URL(
  "../../py-parity-checking/fixtures/kernels/audit-two-segment.bsp",
  import.meta.url,
);
function setup() {
  const handles = createSpiceHandleRegistry(),
    h = handles.register("DAF", 11);
  const mock = {
    dafac: vi.fn(),
    dafdc: vi.fn(),
    dafrs: vi.fn(),
    dafcls: vi.fn(),
    dafec: vi.fn((..._args: unknown[]) => ({
      n: 1,
      done: true,
      bytes: Uint8Array.of(32, 65, 0, 0),
    })),
  };
  return {
    handles,
    h,
    mock,
    api: createFileIoApi(mock as unknown as NativeAddon, handles, {
      resolvePathForSpice: (p) => p,
    }),
  };
}
it("snapshots each caller row once and retains a partial unaligned summary view", () => {
  const { api, h, mock } = setup();
  const reads = new Map<PropertyKey, number>();
  const rows = new Proxy([" A", ""], {
    get(target, k, receiver) {
      reads.set(k, (reads.get(k) ?? 0) + 1);
      return Reflect.get(target, k, receiver);
    },
  });
  api.dafac(h, rows);
  expect(mock.dafac.mock.calls[0]).toEqual([
    11,
    2,
    3,
    Uint8Array.of(32, 65, 0, 32, 0, 0),
  ]);
  for (const k of ["length", "0", "1"]) expect(reads.get(k)).toBe(1);
  const backing = Uint8Array.from({ length: 42 }, (_, i) => i);
  api.dafrs(h, backing.subarray(1, 41));
  backing.fill(0);
  expect(mock.dafrs.mock.calls[0]?.[1]).toEqual(
    Uint8Array.from({ length: 40 }, (_, i) => i + 1),
  );
  const result = api.dafec(h, 2, 4);
  mock.dafec.mock.results[0]!.value.bytes.fill(9);
  expect(result).toEqual({ n: 1, lines: [" A"], done: true });
});
it("validates closed, foreign and wrong-kind DAF references after resolving caller-supplied data", () => {
  const { api, h, mock, handles } = setup();
  for (const bad of [
    handles.register("SPK", 11),
    createSpiceHandleRegistry().register("DAF", 11),
  ]) {
    expect(() => api.dafac(bad, ["row"])).toThrow();
    expect(() => api.dafdc(bad)).toThrow();
    expect(() => api.dafec(bad, 1)).toThrow();
    expect(() => api.dafrs(bad, new Uint8Array(8))).toThrow();
  }
  const rows = ["one"];
  Object.defineProperty(rows, 0, {
    get() {
      api.dafcls(h);
      return "one";
    },
  });
  expect(() => api.dafac(h, rows)).toThrow();
  expect(mock.dafac).not.toHaveBeenCalled();
  expect(mock.dafdc).not.toHaveBeenCalled();
  expect(mock.dafec).not.toHaveBeenCalled();
  expect(mock.dafrs).not.toHaveBeenCalled();
});
it("rejects malformed, short, oversized and invalid UTF-8 native page results", () => {
  const { api, h, mock } = setup();
  for (const result of [
    { n: 1, done: true, bytes: Uint8Array.of(65, 65, 65, 65) },
    { n: 1, done: true, bytes: Uint8Array.of(0xff, 0, 0, 0) },
    { n: 2, done: false, bytes: Uint8Array.of(0, 0, 0, 0) },
    { n: 0, done: true, bytes: Uint8Array.of(0) },
  ]) {
    mock.dafec.mockReturnValueOnce(result);
    expect(() => api.dafec(h, 1, 4)).toThrow();
  }
  expect(() => api.dafec(h, 2147483647, 2)).toThrow();
  expect(mock.dafec).toHaveBeenCalledTimes(4);
});
const actual = it.runIf(nodeAddonAvailable());
actual(
  "checks native integer and byte extents before entering the scientific operation and recovers on valid scratch storage",
  () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "c03-addon-")),
      file = path.join(dir, "scratch.bsp"),
      raw = getNativeAddon();
    try {
      fs.copyFileSync(fixture, file);
      const h = raw.dafopw(file);
      try {
        for (const op of ["dafac", "dafdc", "dafec", "dafrs"] as const)
          expect(() => Reflect.apply(raw[op], raw, [])).toThrow();
        expect(() => raw.dafac(h, 2, 5, new Uint8Array(6))).toThrow();
        expect(() => raw.dafac(h, 1, 4, Uint8Array.of(65, 65, 65, 65))).toThrow(
          /terminator/,
        );
        expect(() => raw.dafec(h, 134217729, 2)).toThrow(/256 MiB/);
        expect(() => raw.dafec(h, 2 ** 31, 2)).toThrow();
        raw.dafac(h, 1, 3, Uint8Array.of(120, 0, 0));
        const page = raw.dafec(h, 1, 3);
        expect([page.n, page.done, page.bytes[0], page.bytes[1]]).toEqual([
          1,
          true,
          120,
          0,
        ]);
        raw.dafbfs(h);
        expect(raw.daffna(h)).toBe(true);
        expect(() => raw.dafrs(h, new Uint8Array(8))).toThrow(/file format/);
        raw.dafrs(h, raw.dafgs(h));
        raw.dafdc(h);
        expect(raw.dafec(h, 1, 2)).toEqual({
          n: 0,
          done: true,
          bytes: new Uint8Array(),
        });
      } finally {
        raw.dafcls(h);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);
