import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createNodeBackend } from "@rybosome/tspice-backend-node";
import { createSpiceHandleRegistry } from "@rybosome/tspice-core";
import { createFileIoApi } from "../src/domains/file-io.js";
import { getNativeAddon } from "../src/runtime/addon.js";
import { createKernelStager } from "../src/runtime/kernel-staging.js";
import { createVirtualOutputStager } from "../src/runtime/virtual-output-staging.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";
const test = it.runIf(nodeAddonAvailable);
describe("DAS lifecycle on the native addon", () => {
  test("preserves owned output through exclusive opens, both closes and exact physical read claims", () => {
    const a = createNodeBackend(),
      b = createNodeBackend(),
      target = { kind: "virtual-output", path: "nested/c04.das" } as const;
    const h = a.raw.dasonw(target, "aB12zzz", "Internal123", 2),
      physical = a.raw.dashfn(h);
    try {
      expect(path.isAbsolute(physical)).toBe(true);
      expect(fs.existsSync(physical)).toBe(true);
      expect(() => a.kit.readVirtualOutput(target)).toThrow(/open/);
      expect(() => b.raw.dashfs(h)).toThrow(/invalid|closed/);
      expect(() => a.raw.dasopw(target)).toThrow(/FILEOPENCONFLICT/);
      expect(a.raw.dasrfr(h, 6, 5)).toEqual({
        idword: "DAS/a",
        ifname: "Inte",
        nresvr: 0,
        nresvc: 0,
        ncomr: 2,
        ncomc: 0,
      });
      a.raw.daswbr(h);
    } finally {
      a.raw.dasllc(h);
    }
    const bytes = a.kit.readVirtualOutput(target);
    expect(Buffer.from(bytes.subarray(0, 8)).toString()).toBe("DAS/aB12");
    expect(() => a.raw.daslla(h)).toThrow(/invalid|closed/);
    const w = a.raw.dasopw(physical);
    try {
      expect(() => a.kit.readVirtualOutput(target)).toThrow(/open/);
    } finally {
      a.raw.dascls(w);
    }
    const r1 = a.raw.dasopr(physical),
      r2 = a.raw.dasopr(physical);
    try {
      expect(r2).not.toBe(r1);
      expect(a.raw.dashfn(r1)).toBe(physical);
      expect(() => a.raw.daswbr(r1)).toThrow(/SPICE/);
    } finally {
      a.raw.dasllc(r1);
      try {
        expect(a.raw.dasrfr(r2).ifname).toBe("Internal123");
      } finally {
        a.raw.dascls(r2);
      }
    }
  });
  test("keeps physical filenames and fixed-width byte boundaries distinct from decodable Unicode", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-das-test-")),
      file = path.join(root, "fixed.das"),
      a = createNodeBackend();
    try {
      const h = a.raw.dasonw(file, "abcd", "ABCDEFGHIJ" + "ñ", 0);
      try {
        expect(a.raw.dashfn(h, 3)).toBe(file.slice(0, 2));
        expect(a.raw.dasrfr(h, 2147483647, 2147483647).ifname).toBe(
          "ABCDEFGHIJñ",
        );
        expect(() => a.raw.dasrfr(h, 9, 12)).toThrow(/UTF-8/);
        expect(() => a.raw.dasrfr(h, 1, 61)).toThrow(/STRINGTOOSHORT/);
        expect(a.raw.daslla(h)).toEqual({ lastc: 0, lastd: 0, lasti: 0 });
      } finally {
        a.raw.dascls(h);
      }
      expect(() => a.raw.dasonw(file, "abcd", "unchanged", 0)).toThrow(/FILE/);
      expect(() =>
        a.raw.dasopw({ kind: "virtual-output", path: "alien.das" }),
      ).toThrow(/created/);
      expect(() =>
        a.raw.dasonw(path.join(root, "range.das"), "test", "Name", 2147483647),
      ).toThrow(/addressable/);
      expect(fs.existsSync(path.join(root, "range.das"))).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
  test("rolls back newly opened files when registry publication fails", () => {
    const registry = createSpiceHandleRegistry(),
      out = createVirtualOutputStager(),
      api = createFileIoApi(
        getNativeAddon(),
        registry,
        createKernelStager(),
        out,
      );
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-claim-test-")),
      file = path.join(root, "rollback.das");
    try {
      const reject = vi
        .spyOn(registry, "register")
        .mockImplementationOnce(() => {
          throw new Error("registration fault");
        });
      expect(() => api.dasonw(file, "Test", "rollback", 0)).toThrow(
        /registration fault/,
      );
      expect(registry.size()).toBe(0);
      reject.mockRestore();
      const h = api.dasopw(file);
      try {
        expect(api.dasrfr(h).ifname).toBe("rollback");
      } finally {
        api.dasllc(h);
      }
    } finally {
      out.dispose();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
  test("reports owner-local closed/wrong-kind tokens without forwarding them", () => {
    const registry = createSpiceHandleRegistry(),
      out = createVirtualOutputStager(),
      api = createFileIoApi(
        getNativeAddon(),
        registry,
        createKernelStager(),
        out,
      );
    const wrong = registry.register("DAF", 1);
    try {
      for (const n of [
        "daslla",
        "dashfs",
        "dashfn",
        "dasrfr",
        "dasllc",
        "daswbr",
      ] as const)
        expect(() => api[n](wrong)).toThrow(/kind DAF/);
    } finally {
      registry.close(wrong, ["DAF"], () => {}, "test");
      out.dispose();
    }
  });
  for (const n of [
    "dasonw",
    "dasops",
    "dasopw",
    "dashfn",
    "dashfs",
    "daslla",
    "dasllc",
    "dasrfr",
    "daswbr",
  ] as const) {
    test(
      n + " rejects a malformed direct-addon signature before any SPICE I/O",
      () => {
        const addon = getNativeAddon();
        expect(() =>
          Reflect.apply(addon[n], addon, [null, null, null, null, null, null]),
        ).toThrow(/expects/);
      },
    );
  }
});
