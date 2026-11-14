import fs from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { getNativeAddon, type NativeAddon } from "../src/runtime/addon.js";
import { createKernelPoolApi } from "../src/domains/kernel-pool.js";
import { createKernelStager } from "../src/runtime/kernel-staging.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

describe("kernel-pool operation boundaries", () => {
  it("holds the process-wide mutex through each shared call and structured error capture", () => {
    const source = fs.readFileSync(
      new URL("../native/src/domains/kernel_pool.cc", import.meta.url),
      "utf8",
    );
    for (const name of [
      "badkpv",
      "bodvcd",
      "bodvrd",
      "clpool",
      "dvpool",
      "ldpool",
      "lmpool",
      "stpool",
      "szpool",
    ]) {
      const handler = name.charAt(0).toUpperCase() + name.slice(1);
      const start = source.indexOf("static Napi::Value " + handler + "(");
      expect(start, name).toBeGreaterThanOrEqual(0);
      const body = source.slice(start, source.indexOf("\n}", start));
      const lock = body.indexOf(
        "\n  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);",
      );
      const call = body.indexOf("tspice_" + name + "(");
      const capture = body.indexOf("ThrowSpiceError(env,", call);
      expect(lock, name).toBeGreaterThanOrEqual(0);
      expect(call, name).toBeGreaterThan(lock);
      expect(capture, name).toBeGreaterThan(call);
    }
  });

  const rejected = [
    ["badkpv", ["APP", "X", "=", 0.5, 1, "C"]],
    ["badkpv", ["APP", "X", "=", 0, 1, "é"]],
    ["bodvcd", [2147483648, "RADII", 3]],
    ["bodvrd", ["EARTH", "R\0ADII", 3]],
    ["bodvrd", ["EARTH", "RADII", -2147483649]],
    ["clpool", [0]],
    ["dvpool", ["X\0Y"]],
    ["ldpool", ["X\0Y"]],
    ["lmpool", [[123]]],
    ["lmpool", [["A = 1", "\ud800"]]],
    ["stpool", ["X", 0, "//", 3.5]],
    ["stpool", ["X", 2147483648, "//", 4]],
    ["szpool", ["\udfff"]],
  ] as const;
  for (const [name, args] of rejected) {
    it.runIf(nodeAddonAvailable())(
      `validates direct addon ${name} arguments ${JSON.stringify(args)}`,
      () => {
        const addon = getNativeAddon();
        expect(() => Reflect.apply(addon[name], addon, args)).toThrow();
      },
    );
  }

  it.runIf(nodeAddonAvailable())(
    "preserves defined STPOOL prefixes and applies the guard only to visited rows",
    () => {
      const addon = getNativeAddon();
      try {
        addon.pcpool("TSP_B05_G", ["first", "X", "later"]);
        expect(addon.stpool("TSP_B05_G", 0, "ZZ", 48)).toEqual({
          found: true,
          nthstr: "first",
          size: 5,
        });
        expect(() => addon.stpool("TSP_B05_G", 1, "ZZ", 48)).toThrow(
          /continuation marker/,
        );
        expect(addon.stpool("TSP_B05_G", -1, "ZZ", 48)).toEqual({
          found: false,
        });
        expect(addon.stpool("TSP_B05_G", 1, "+", 48)).toEqual({
          found: true,
          nthstr: "X",
          size: 1,
        });
        addon.pcpool("TSP_B05_G", ["abZZ", "c", ""]);
        expect(() => addon.stpool("TSP_B05_G", 0, "ZZ  ", 48)).toThrow(
          /continuation marker/,
        );
        addon.pcpool("TSP_B05_G", ["abZZ", "cd", ""]);
        expect(addon.stpool("TSP_B05_G", 0, "ZZ  ", 48)).toEqual({
          found: true,
          nthstr: "abcd",
          size: 4,
        });
        expect(() => addon.stpool("TSP_B05_G", 1, "ZZ", 48)).toThrow(
          /continuation marker/,
        );
      } finally {
        addon.dvpool("TSP_B05_G");
      }
    },
  );

  it.runIf(nodeAddonAvailable())(
    "allows the full integer BODVCD ID and protects BODVRD from an unhashable pool mapping",
    () => {
      const addon = getNativeAddon();
      try {
        addon.pdpool("BODY-2147483648_X", [1.25]);
        expect(addon.bodvcd(-2147483648, "X", 1)).toEqual({
          dim: 1,
          values: [1.25],
        });
        addon.pcpool("NAIF_BODY_NAME", ["B05GUARD"]);
        addon.pdpool("NAIF_BODY_CODE", [-2147483647.5]);
        expect(() => addon.bodvrd("B05GUARD", "X", 1)).toThrow(
          /body hash range/,
        );
        addon.pdpool("NAIF_BODY_CODE", [-2147483647]);
        addon.pdpool("BODY-2147483647_X", [2]);
        expect(addon.bodvrd("B05GUARD", "X", 1)).toEqual({
          dim: 1,
          values: [2],
        });
      } finally {
        for (const name of [
          "NAIF_BODY_NAME",
          "NAIF_BODY_CODE",
          "BODY-2147483647_X",
          "BODY-2147483648_X",
        ])
          addon.dvpool(name);
      }
    },
  );

  it.runIf(nodeAddonAvailable())(
    "snapshots rows once in the native handler, preserving order and empty rows",
    () => {
      const addon = getNativeAddon();
      const lines = ["", "B05_E=1", "B05_E+=2"];
      const reads = vi.fn(() => "B05_E=1");
      Object.defineProperty(lines, 1, { get: reads });
      try {
        addon.lmpool(lines);
        expect(reads).toHaveBeenCalledTimes(1);
        expect(addon.gdpool("B05_E", 0, 2)).toEqual({
          found: true,
          values: [1, 2],
        });
      } finally {
        addon.dvpool("B05_E");
      }
    },
  );

  it("releases only its own byte-source file when the native loader throws", () => {
    let staged = "";
    const bytes = new Uint8Array([65, 66]);
    const call = vi.fn((file: string) => {
      staged = file;
      expect(Array.from(fs.readFileSync(file))).toEqual([65, 66]);
      throw new Error("parse error");
    });
    const api = createKernelPoolApi(
      { ldpool: call } as NativeAddon,
      createKernelStager(),
    );
    expect(() => api.ldpool({ path: "asset.tpc", bytes })).toThrow(
      "parse error",
    );
    expect(call).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(staged)).toBe(false);
  });

  it("returns a numeric vector independent from the native result and rejects an inconsistent dimension", () => {
    const values = [1, 2];
    const body = vi.fn(() => ({ dim: 2, values }));
    const api = createKernelPoolApi(
      { bodvcd: body } as NativeAddon,
      createKernelStager(),
    );
    const result = api.bodvcd(399, "X", 7);
    values[0] = 99;
    expect(result).toEqual({ dim: 2, values: [1, 2] });
    expect(() => api.bodvcd(399, "X", 1)).toThrow(/dimension/);
  });
});
