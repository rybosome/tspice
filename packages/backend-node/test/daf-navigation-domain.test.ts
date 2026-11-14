import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { expect, it, vi } from "vitest";
import {
  createSpiceHandleRegistry,
  dafPathByteLength,
  dafSummaryFormat,
} from "@rybosome/tspice-core";
import { createNodeBackend } from "../src/index.js";
import { createFileIoApi } from "../src/domains/file-io.js";
import type { NativeAddon } from "../src/native.js";
import { getNativeAddon } from "../src/native.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

const fixture = new URL(
  "../../py-parity-checking/fixtures/kernels/audit-two-segment.bsp",
  import.meta.url,
);
const names = [
  "dafbbs",
  "dafcs",
  "daffpa",
  "dafgn",
  "dafgs",
  "dafhsf",
] as const;
function adapter() {
  const handles = createSpiceHandleRegistry();
  const raw = {
    dafbbs: vi.fn(),
    dafcs: vi.fn(),
    daffpa: vi.fn(() => true),
    dafgh: vi.fn(() => -19),
    dafgn: vi.fn(() => Uint8Array.of(0xef, 0xbb, 0xbf, 65, 9)),
    dafgs: vi.fn(() => Uint8Array.of(0, 1, 2, 3, 4, 5, 6, 7)),
    dafhsf: vi.fn(() => ({ nd: 2, ni: 6 })),
    dafopw: vi.fn(() => -19),
    dafcls: vi.fn(),
  };
  // Only these eight adapter entrypoints and writer cleanup are used in this fixture.
  const api = createFileIoApi(raw as unknown as NativeAddon, handles, {
    resolvePathForSpice: (id) => "/resolved/" + id,
  });
  return { handles, raw, api };
}

it("binds DAF calls to registered native claims, resolves staged paths and owns returned bytes", () => {
  const { handles, raw, api } = adapter();
  const writer = api.dafopw("scratch.bsp"),
    alias = handles.register("DAF", -19);
  expect(raw.dafopw).toHaveBeenCalledWith("/resolved/scratch.bsp");
  api.dafbbs(alias);
  api.dafcs(alias);
  expect(api.daffpa(alias)).toBe(true);
  expect(api.dafgh()).toBe(writer);
  expect(api.dafgn(alias, 2147483647)).toBe("\uFEFFA\t");
  expect(raw.dafgn).toHaveBeenCalledWith(-19, 1001);
  const src = Uint8Array.from([255, 254, 253, 252, 251, 250, 249, 248]);
  raw.dafgs.mockReturnValue(src);
  const packed = api.dafgs(alias);
  expect(packed).toEqual(src);
  packed[0] = 1;
  expect(src[0]).toBe(255);
  expect(api.dafhsf(alias)).toEqual({ nd: 2, ni: 6 });
  for (const name of ["dafbbs", "dafcs", "daffpa", "dafgs", "dafhsf"] as const)
    expect(raw[name]).toHaveBeenCalledWith(-19);
  api.dafcls(writer);
  expect(raw.dafcls).toHaveBeenCalledWith(-19);
  expect(api.dafgh()).toBe(alias);
  api.dafcls(alias);
  expect(() => api.dafgh()).toThrow(/no live handle owned/);
});

for (const method of names)
  it(
    method +
      " rejects wrong-kind, foreign and closed claims before native dispatch",
    () => {
      const { handles, raw, api } = adapter();
      const closed = handles.register("DAF", 12);
      api.dafcls(closed);
      const wrong = handles.register("DAS", 12),
        foreign = createSpiceHandleRegistry().register("DAF", 12);
      for (const bad of [closed, wrong, foreign])
        expect(() => api[method](bad)).toThrow();
      expect(raw[method]).not.toHaveBeenCalled();
    },
  );

it("rejects unrepresentable names, lengths and summary formats without altering a live token", () => {
  const { api, raw, handles } = adapter();
  const h = handles.register("DAF", 77);
  for (const len of [NaN, Infinity, 1.5, 2147483648, -2147483649])
    expect(() => api.dafgn(h, len)).toThrow();
  expect(raw.dafgn).not.toHaveBeenCalled();
  raw.dafgn.mockReturnValue(Uint8Array.of(0xc3));
  expect(() => api.dafgn(h, 2)).toThrow(TypeError);
  raw.dafgs.mockReturnValue(new Uint8Array(1008));
  expect(() => api.dafgs(h)).toThrow(/size/);
  for (const [nd, ni] of [
    [-1, 2],
    [0, 251],
    [124, 3],
    [2.5, 6],
    [0, 0],
  ] as const) {
    raw.dafhsf.mockReturnValue({ nd, ni });
    expect(() => api.dafhsf(h)).toThrow(/format/);
  }
  expect(dafSummaryFormat(0, 250)).toEqual({ nd: 0, ni: 250 });
  expect(dafSummaryFormat(124, 2)).toEqual({ nd: 124, ni: 2 });
  expect(dafPathByteLength("α🚀", 6)).toBe(6);
  expect(() => dafPathByteLength("α🚀", 5)).toThrow(/byte limit/);
  for (const p of ["a\0b", "bad\ud800"])
    expect(() => api.dafopw(p)).toThrow(TypeError);
  expect(raw.dafopw).not.toHaveBeenCalled();
  expect(handles.size()).toBe(1);
});

const itNative = it.runIf(nodeAddonAvailable());
itNative(
  "shares a per-file cursor and maps process-global current files only to surviving local claims",
  () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-c01-owners-"));
    const left = createNodeBackend().raw,
      right = createNodeBackend().raw;
    const a = path.join(dir, "a.bsp"),
      b = path.join(dir, "b.bsp");
    fs.copyFileSync(fixture, a);
    fs.copyFileSync(fixture, b);
    const opened: Array<() => void> = [];
    const open = (api: typeof left, file: string) => {
      const h = api.dafopr(file);
      let live = true;
      const close = () => {
        if (live) {
          api.dafcls(h);
          live = false;
        }
      };
      opened.push(close);
      return { h, close };
    };
    try {
      const first = open(left, a),
        second = open(left, a),
        theirs = open(right, a),
        foreign = open(right, b);
      left.dafbbs(second.h);
      expect(left.daffpa(second.h)).toBe(true);
      expect(right.dafgh()).toBe(theirs.h);
      expect(left.dafgh()).toBe(first.h);
      const last = left.dafgn(second.h);
      expect(right.daffpa(theirs.h)).toBe(true);
      expect(left.dafgn(first.h)).not.toBe(last);
      first.close();
      expect(left.dafgh()).toBe(second.h);
      right.dafbbs(foreign.h);
      expect(() => left.dafgh()).toThrow(/no live handle owned/);
      expect(() => left.dafcs(foreign.h)).toThrow(/invalid or closed/);
      left.dafcs(second.h);
      expect(right.dafgh()).toBe(theirs.h);
      second.close();
      expect(() => left.dafgh()).toThrow(/no live handle owned/);
      const reopened = open(left, a);
      left.dafbbs(reopened.h);
      expect(left.dafgh()).toBe(reopened.h);
      expect(reopened.h).not.toBe(second.h);
    } finally {
      try {
        for (const close of opened.reverse()) close();
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  },
);

itNative(
  "releases a real writer if owner registration fails, then reopens the scratch file",
  () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-c01-rollback-"));
    const file = path.join(dir, "rollback.bsp");
    fs.copyFileSync(fixture, file);
    try {
      const addon = getNativeAddon();
      const refuse = {
        ...createSpiceHandleRegistry(),
        register: () => {
          throw Error("issuer exhausted");
        },
      };
      const api = createFileIoApi(addon, refuse, {
        resolvePathForSpice: (p) => p,
      });
      expect(() => api.dafopw(file)).toThrow(/issuer exhausted/);
      const raw = createNodeBackend().raw;
      const reader = raw.dafopr(file);
      try {
        expect(raw.dafhsf(reader)).toEqual({ nd: 2, ni: 6 });
      } finally {
        raw.dafcls(reader);
      }
      for (const method of names)
        expect(() => Reflect.apply(addon[method], addon, [])).toThrow(
          /argument count/,
        );
      for (const value of [1.5, 2147483648, NaN])
        expect(() => addon.dafgn(value, 10)).toThrow(/32-bit/);
      for (const bad of ["bad\0path", "bad\ud800"])
        expect(() => addon.dafopw(bad)).toThrow();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);
