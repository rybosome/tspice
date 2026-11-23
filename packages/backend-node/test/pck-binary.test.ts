import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { createNodeBackend } from "@rybosome/tspice-backend-node";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";
const fixture = path.resolve(
  import.meta.dirname,
  "../../py-parity-checking/fixtures/kernels/audit-orientation.bpc",
);
const test = it.runIf(nodeAddonAvailable());
test("an old owner cannot unload a later PCK registration sharing a live DAF reader", () => {
  const a = createNodeBackend(),
    b = createNodeBackend();
  const reader = a.raw.dafopr(fixture);
  try {
    const first = a.raw.pcklof(fixture),
      second = b.raw.pcklof(fixture);
    expect(() => b.raw.pckuof(first)).toThrow(/closed/);
    a.raw.pckuof(first);
    const current = a.raw.pcklof(fixture);
    b.raw.pckuof(second);
    expect(a.raw.pxform("J2000", "ITRF93", -4)).toHaveLength(9);
    a.raw.pckuof(current);
  } finally {
    a.raw.dafcls(reader);
  }
});
test("PCK query destinations require an owned live integer set or window", () => {
  const a = createNodeBackend(),
    b = createNodeBackend();
  const ids = a.kit.newIntCell(8),
    win = a.kit.newWindow(4);
  try {
    expect(() => b.raw.pckfrm(fixture, ids)).toThrow(/owned/);
    expect(() => b.raw.pckcov(fixture, 3000, win)).toThrow(/owned/);
    a.raw.pckfrm(fixture, ids);
    a.raw.pckcov(fixture, 3000, win);
    expect(a.raw.card(ids)).toBe(2);
    expect(a.raw.wncard(win)).toBe(2);
  } finally {
    a.kit.freeCell(ids);
    a.kit.freeWindow(win);
  }
  expect(() => a.raw.pckfrm(fixture, ids)).toThrow(/owned/);
  expect(() => a.raw.pckcov(fixture, 3000, win)).toThrow(/owned/);
});
test("invalid degree, cardinality, nonfinite coefficients and zero-radius records leave a writer usable", () => {
  const a = createNodeBackend();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pck-native-"));
  const p = path.join(dir, "out.bpc");
  const w = a.raw.pckopn(p, "NATIVE", 0);
  const write = (degree: number, arr: readonly number[], interval = 2) =>
    a.raw.pckw02(
      w,
      3000,
      "J2000",
      0,
      interval,
      "SERIES",
      interval,
      1,
      degree,
      arr,
      0,
    );
  try {
    expect(() => write(42, [])).toThrow(/dimensions/);
    expect(() => write(1, [1, 2, 3])).toThrow(/dimensions/);
    expect(() => write(0, [NaN, 0, 0])).toThrow(/finite/);
    expect(() => write(0, [0, 0, 0], Number.MIN_VALUE)).toThrow(/reader range/);
    let seen = 0;
    const values = [0.3, 0.2, 0.1];
    Object.defineProperty(values, 0, {
      get() {
        if (++seen > 1) throw Error("read twice");
        return 0.3;
      },
    });
    write(0, values);
    expect(seen).toBe(1);
    a.raw.pckcls(w);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
