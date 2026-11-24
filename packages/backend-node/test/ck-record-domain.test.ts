import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { createNodeBackend } from "@rybosome/tspice-backend-node";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

const test = it.runIf(nodeAddonAvailable());
const fixture = (name: string) =>
  fileURLToPath(
    new URL(
      `../../py-parity-checking/fixtures/kernels/${name}`,
      import.meta.url,
    ),
  );

test("CK segment reads require an owned live DAF claim and exact membership", () => {
  const a = createNodeBackend(),
    b = createNodeBackend(),
    h = a.raw.dafopr(fixture("audit-ck-records.bc")),
    other = a.raw.dafopr(fixture("audit-two-segment.bsp"));
  try {
    a.raw.dafbfs(h);
    a.raw.daffna(h);
    const d = a.raw.dafgs(h);
    expect(() => b.raw.cknr02(h, d)).toThrow();
    expect(() => a.raw.cknr02(other, d)).toThrow(/CK DAF/);
    expect(() => a.raw.ckgr02(h, d.subarray(1), 1)).toThrow(/byte length/);
    const copy = new Uint8Array(d);
    copy[0] = copy[0]! ^ 1;
    expect(() => a.raw.cknr02(h, copy)).toThrow(/does not belong/);
    expect(() => a.raw.ckgr02(h, d, 1.2)).toThrow();
    expect(a.raw.ckgr02(h, d, 1).start).toBe(1000);
  } finally {
    a.raw.dafcls(other);
    a.raw.dafcls(h);
  }
  expect(() => a.raw.cknr02(h, new Uint8Array(40))).toThrow();
});
test("CK frame boundaries preserve checked integer, finite ET and NUL-free selector inputs", () => {
  const a = createNodeBackend();
  expect(() => a.raw.ckmeta(2147483648, "SPK")).toThrow();
  expect(() => a.raw.ckmeta(1, "SCLK\0SPK")).toThrow();
  expect(() => a.raw.ckfrot(1, NaN)).toThrow();
  expect(() => a.raw.ckfxfm(1, Infinity)).toThrow();
  expect(a.raw.ckmeta(-123001, "SPK")).toBe(-123);
});
