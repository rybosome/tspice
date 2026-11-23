import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSpiceHandleRegistry } from "@rybosome/tspice-core";
import { expect, it, vi } from "vitest";
import { createFileIoApi } from "../src/domains/file-io.js";
import { createVirtualOutputStager } from "../src/runtime/virtual-output-staging.js";
import { getNativeAddon, type NativeAddon } from "../src/runtime/addon.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";
function setup() {
  const handles = createSpiceHandleRegistry(),
    h = handles.register("DAS", 11);
  const mock = {
    dasac: vi.fn(),
    dasdc: vi.fn(),
    dascls: vi.fn(),
    dasec: vi.fn((..._args: unknown[]) => ({
      n: 1,
      done: true,
      bytes: Uint8Array.of(32, 65, 0, 0),
    })),
  };
  return {
    handles,
    h,
    mock,
    api: createFileIoApi(
      mock as unknown as NativeAddon,
      handles,
      {
        resolvePathForSpice: (p) => p,
      },
      createVirtualOutputStager(),
    ),
  };
}
it("snapshots each caller row once and returns owned decoded rows", () => {
  const { api, h, mock } = setup();
  const reads = new Map<PropertyKey, number>();
  const rows = new Proxy([" A", ""], {
    get(target, k, receiver) {
      reads.set(k, (reads.get(k) ?? 0) + 1);
      return Reflect.get(target, k, receiver);
    },
  });
  api.dasac(h, rows);
  expect(mock.dasac.mock.calls[0]).toEqual([
    11,
    2,
    3,
    Uint8Array.of(32, 65, 0, 32, 0, 0),
  ]);
  for (const k of ["length", "0", "1"]) expect(reads.get(k)).toBe(1);
  const result = api.dasec(h, 2, 4);
  mock.dasec.mock.results[0]!.value.bytes.fill(9);
  expect(result).toEqual({ n: 1, lines: [" A"], done: true });
});
it("validates closed, foreign and wrong-kind DAS references after resolving caller-supplied data", () => {
  const { api, h, mock, handles } = setup();
  for (const bad of [
    handles.register("SPK", 11),
    createSpiceHandleRegistry().register("DAS", 11),
  ]) {
    expect(() => api.dasac(bad, ["row"])).toThrow();
    expect(() => api.dasdc(bad)).toThrow();
    expect(() => api.dasec(bad, 1)).toThrow();
  }
  const rows = ["one"];
  Object.defineProperty(rows, 0, {
    get() {
      api.dascls(h);
      return "one";
    },
  });
  expect(() => api.dasac(h, rows)).toThrow();
  expect(mock.dasac).not.toHaveBeenCalled();
  expect(mock.dasdc).not.toHaveBeenCalled();
  expect(mock.dasec).not.toHaveBeenCalled();
});
it("rejects malformed, short, oversized and invalid UTF-8 native page results", () => {
  const { api, h, mock } = setup();
  for (const result of [
    { n: 1, done: true, bytes: Uint8Array.of(65, 65, 65, 65) },
    { n: 1, done: true, bytes: Uint8Array.of(0xff, 0, 0, 0) },
    { n: 2, done: false, bytes: Uint8Array.of(0, 0, 0, 0) },
    { n: 0, done: true, bytes: Uint8Array.of(0) },
  ]) {
    mock.dasec.mockReturnValueOnce(result);
    expect(() => api.dasec(h, 1, 4)).toThrow();
  }
  expect(() => api.dasec(h, 2147483647, 2)).toThrow();
  expect(mock.dasec).toHaveBeenCalledTimes(4);
});
const actual = it.runIf(nodeAddonAvailable);
actual(
  "checks native integer and byte extents before entering the scientific operation and recovers on valid scratch storage",
  () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "c06-addon-")),
      file = path.join(dir, "scratch.bds"),
      raw = getNativeAddon();
    try {
      const h = raw.dasonw(file, "C06", "C06 WIDTH TEST", 0);
      try {
        for (const op of ["dasac", "dasdc", "dasec"] as const)
          expect(() => Reflect.apply(raw[op], raw, [])).toThrow();
        expect(() => raw.dasac(h, 2, 5, new Uint8Array(6))).toThrow();
        expect(() => raw.dasac(h, 1, 4, Uint8Array.of(65, 65, 65, 65))).toThrow(
          /terminator/,
        );
        expect(() => raw.dasec(h, 134217729, 2)).toThrow(/256 MiB/);
        expect(() => raw.dasec(h, 2 ** 31, 2)).toThrow();
        raw.dasac(h, 1, 3, Uint8Array.of(120, 0, 0));
        const page = raw.dasec(h, 1, 3);
        expect([page.n, page.done, page.bytes[0], page.bytes[1]]).toEqual([
          1,
          true,
          120,
          0,
        ]);
        raw.dasdc(h);
        expect(raw.dasec(h, 1, 2)).toEqual({
          n: 0,
          done: true,
          bytes: new Uint8Array(),
        });
      } finally {
        raw.dascls(h);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);
