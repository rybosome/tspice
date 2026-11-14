import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { createNodeBackend } from "@rybosome/tspice-backend-node";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";
const test = it.runIf(nodeAddonAvailable());
const file = (name: string) =>
  fileURLToPath(
    new URL(
      `../../py-parity-checking/fixtures/kernels/${name}`,
      import.meta.url,
    ),
  );
const v = [10, 1, 0.25] as const,
  d = [-1, 0, 0] as const;
test("DSKX02 respects handle ownership and validates the descriptor and individual finite components", () => {
  const a = createNodeBackend(),
    b = createNodeBackend(),
    h = a.raw.dasopr(file("audit-geometry.bds"));
  const s = a.raw.dlabfs(h);
  if (!s.found) throw new Error("Missing DLA");
  try {
    expect(() => b.raw.dskx02(h, s.descr, v, d)).toThrow();
    expect(() =>
      a.raw.dskx02(h, { ...s.descr, ibase: s.descr.ibase + 1 }, v, d),
    ).toThrow(/descriptor/);
    expect(() => a.raw.dskx02(h, s.descr, [1, NaN, 3], d)).toThrow(/finite/);
    expect(a.raw.dskx02(h, s.descr, v, d)).toEqual({
      found: true,
      plid: 1,
      xpt: [0.75, 1, 0.25],
    });
  } finally {
    a.raw.dascls(h);
  }
  expect(() => a.raw.dskx02(h, s.descr, v, d)).toThrow();
});
test("DSK batch snapshots validate dimensions before reads and consume each component once", () => {
  const a = createNodeBackend(),
    raw = a.raw;
  const once = <T extends unknown[]>(array: T) => {
    const keys = new Set<PropertyKey>();
    return new Proxy(array, {
      get(target, key) {
        if (keys.has(key)) throw new Error("Repeated read");
        keys.add(key);
        return Reflect.get(target, key);
      },
    });
  };
  try {
    raw.furnsh(file("audit-geometry.tf"));
    raw.furnsh(file("audit-geometry.bds"));
    const vs = once([once<[number, number, number]>([10, 1, 0.25])]),
      ds = once([once<[number, number, number]>([-1, 0, 0])]);
    expect(
      raw.dskxv(
        false,
        "100101",
        once([101]),
        0,
        "AUDIT_GEOMETRY_FIXED",
        vs,
        ds,
      ),
    ).toEqual([{ found: true, xpt: [0.75, 1, 0.25] }]);
    const excess = new Proxy<readonly [number, number, number][]>([], {
      get(_t, key) {
        if (key === "length") return 11184811;
        throw new Error("Unexpected row read");
      },
    });
    expect(() =>
      raw.dskxv(false, "100101", [], 0, "AUDIT_GEOMETRY_FIXED", excess, []),
    ).toThrow(/buffer bound/);
    expect(() => raw.dskxsi(false, "100101", [], 0, "\ud800", v, d)).toThrow(
      /UTF-16/,
    );
    expect(() => raw.dskgtl(1.5)).toThrow();
    expect(() => raw.dskstl(1, Infinity)).toThrow(/finite/);
    expect(() => raw.dskxsi(false, "100101\0", [], 0, "J2000", v, d)).toThrow(
      /NUL/,
    );
    expect(() =>
      raw.dskxsi(false, "100101", [2147483648], 0, "J2000", v, d),
    ).toThrow();
  } finally {
    raw.kclear();
  }
});
