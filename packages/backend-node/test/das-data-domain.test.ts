import { expect, it } from "vitest";
import { createNodeBackend } from "@rybosome/tspice-backend-node";
import { getNativeAddon } from "../src/runtime/addon.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";
const test = it.runIf(nodeAddonAvailable());
test("snapshots numeric getters once outside the CSPICE lock, retaining IEEE and ordered integer input", () => {
  const { raw } = createNodeBackend(),
    h = raw.dasops();
  try {
    const read: number[] = [];
    const values = new Proxy([0, 1, 2, 3], {
      get(t, k, r) {
        if (k === "length") read.push(-1);
        if (typeof k === "string" && /^\d+$/.test(k)) {
          const i = Number(k);
          if (read.includes(i)) throw new Error("DAS input read twice");
          read.push(i);
          raw.daslla(h);
          return [-0, Infinity, -Infinity, NaN][i];
        }
        return Reflect.get(t, k, r);
      },
    });
    raw.dasadd(h, 4, values);
    expect(read).toEqual([-1, 0, 1, 2, 3]);
    expect(raw.dasrdd(h, 1, 4)).toEqual([-0, Infinity, -Infinity, NaN]);
    raw.dasadi(h, 2, [-2147483648, 2147483647]);
    const first = raw.dasrdi(h, 1, 2);
    first[0] = 0;
    expect(raw.dasrdi(h, 1, 2)).toEqual([-2147483648, 2147483647]);
  } finally {
    raw.dascls(h);
  }
});
test("enforces ownership, complete byte rows, actual record-boundary source advances and logical endpoints", () => {
  const { raw } = createNodeBackend(),
    other = createNodeBackend(),
    h = raw.dasops();
  try {
    expect(() => other.raw.dasadc(h, 1, 0, 0, 1, Uint8Array.of(5))).toThrow(
      /invalid|closed/,
    );
    expect(() => raw.dasadc(h, 2, 0, 0, 2, new Uint8Array(3))).toThrow(
      /complete/,
    );
    expect(() => raw.dasadc(h, 0, 0, 2147483647, 1, new Uint8Array(0))).toThrow(
      /index bounds/,
    );
    raw.dasadc(h, 1030, 0, 0, 1, new Uint8Array(1030).fill(87));
    expect(() =>
      raw.dasudc(h, 1024, 1027, 2, 3, 5, new Uint8Array(10)),
    ).toThrow(/additional source row/);
    const rows = Uint8Array.from({ length: 15 }, (_, i) => i);
    raw.dasudc(h, 1024, 1027, 2, 3, 5, rows);
    const dest = new Uint8Array(8).fill(77),
      out = raw.dasrdc(h, 1024, 1027, 1, 2, 4, dest);
    expect([...dest]).toEqual([77, 77, 77, 77, 77, 77, 77, 77]);
    expect([...out]).toEqual([77, 2, 7, 77, 77, 8, 12, 77]);
    expect(() => raw.dasrdc(h, 1030, 1031, 0, 0, 1, new Uint8Array(2))).toThrow(
      /DASNOSUCHADDRESS/,
    );
    expect([...raw.dasrdc(h, 1030, 1030, 0, 0, 1, Uint8Array.of(2))]).toEqual([
      87,
    ]);
  } finally {
    raw.dascls(h);
  }
  expect(() => raw.dasrdd(h, 1, 1)).toThrow(/invalid|closed/);
});
test("checks native scalar, numeric and typed-array boundaries before any data transfer", () => {
  const n = getNativeAddon(),
    h = n.dasops();
  try {
    expect(() => n.dasadi(h, 1, [NaN])).toThrow(/integer/);
    expect(() => n.dasadi(h, 1, [2147483648])).toThrow(/integer/);
    expect(() => n.dasadd(h, 3, [1, 2])).toThrow(/exceeds/);
    expect(() => n.dasadd(h, 1, new Array<number>(1))).toThrow(/numeric/);
    expect(() => n.dasrdd(h, 1, 2147483647)).toThrow(/limit/);
    expect(() => n.dasrdi(h, 2147483648, 0)).toThrow();
    expect(() =>
      Reflect.apply(n.dasadc, undefined, [h, 1, 0, 0, 1, new Uint16Array(1)]),
    ).toThrow(/Uint8Array/);
    n.dasadi(h, 2, [2, 3]);
    expect(() => n.dasudi(h, 1, 2, [5])).toThrow(/exceeds/);
    n.dasudi(h, 1, 1, [-19]);
    expect(n.dasrdi(h, 1, 2)).toEqual([-19, 3]);
  } finally {
    n.dascls(h);
  }
});
