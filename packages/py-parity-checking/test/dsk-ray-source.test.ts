import fs from "node:fs";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const target = "100101",
  frame = "AUDIT_GEOMETRY_FIXED";
const v = [10, 1, 0.25] as const,
  d = [-1, 0, 0] as const;
const fixture = (name: string) => ({
  path: name,
  bytes: fs.readFileSync(
    new URL(`../fixtures/kernels/${name}`, import.meta.url),
  ),
});
for (const backend of ["node", "wasm"] as const) {
  const test = it.runIf(backend === "wasm" || nodeBackendAvailable);
  test(`${backend}: the winning DSK source is the actual KEEPER file and agrees with all independently traversed descriptor fields and plate observables`, async () => {
    const client = await spiceClients.toSync({ backend }),
      raw = client.spice.raw;
    const inner = "audit-geometry.bds",
      outer = "audit-dsk-ray-outer.bds";
    try {
      for (const f of ["audit-geometry.tf", inner, outer])
        raw.furnsh(fixture(f));
      const h = raw.dasopr(outer);
      try {
        const first = raw.dlabfs(h),
          k = raw.kdata(1, "DSK"),
          hit = raw.dskxsi(false, target, [], 0, frame, v, d);
        if (!first.found || !k.found || !hit.found)
          throw new Error("Missing authored source");
        expect(hit.handle).toBe(k.handle);
        expect(hit.dladsc).toEqual(first.descr);
        expect(hit.dskdsc).toEqual(raw.dskgd(h, first.descr));
        expect(hit.dc).toEqual([]);
        expect(hit.ic).toEqual([1]);
        expect(hit.xpt).toEqual([3.75, 1, 0.25]);
        expect(raw.dskx02(h, hit.dladsc, v, d)).toEqual({
          found: true,
          plid: 1,
          xpt: hit.xpt,
        });
        const normal = raw.dskn02(h, first.descr, 1);
        for (const [i, a] of [1 / 6, 1 / 4, 1 / 2].entries())
          expect(normal[i]).toBeCloseTo(
            a / Math.hypot(1 / 6, 1 / 4, 1 / 2),
            13,
          );
        hit.xpt[0] = 999;
        hit.ic[0] = 999;
        hit.dskdsc.corpar[0] = 999;
        hit.dladsc.ibase = 999;
        const again = raw.dskxsi(
          false,
          target,
          [102],
          10,
          frame,
          v,
          d,
          2147483647,
          2147483647,
        );
        if (!again.found) throw new Error("Lost surface");
        expect(again.xpt).toEqual([3.75, 1, 0.25]);
        expect(again.ic).toEqual([1]);
        expect(again.dskdsc.corpar[0]).toBe(0);
        expect(again.dladsc).toEqual(first.descr);
        raw.unload(outer);
        expect(raw.dskx02(h, first.descr, v, d)).toEqual({
          found: true,
          plid: 1,
          xpt: [3.75, 1, 0.25],
        });
        const closer = raw.dskxsi(false, target, [], 0, frame, v, d);
        if (!closer.found) throw new Error("Missing inner geometry");
        expect(closer.dskdsc.surfce).toBe(101);
        expect(closer.xpt).toEqual([0.75, 1, 0.25]);
      } finally {
        raw.dascls(h);
      }
    } finally {
      raw.kclear();
      await client.dispose();
    }
  });
  test(`${backend}: shape checks and genuine SPICE errors leave ray ordering, callbacks, and later frame state usable`, async () => {
    const client = await spiceClients.toSync({ backend }),
      raw = client.spice.raw;
    try {
      raw.furnsh(fixture("audit-geometry.tf"));
      raw.furnsh(fixture("audit-geometry.bds"));
      expect(() => raw.dskxv(false, target, [], 0, frame, [v], [])).toThrow(
        /counts/,
      );
      expect(() => raw.dskxsi(true, target, [], 0, frame, v, d)).toThrow(
        /BADPRIORITYSPEC/,
      );
      expect(() => raw.dskxsi(false, target, [], 0, frame, v, d, 0, 1)).toThrow(
        /ARRAYTOOSMALL/,
      );
      expect(() => raw.dskxv(false, target, [], 0, frame, [], [])).toThrow(
        /INVALIDCOUNT/,
      );
      expect(raw.failed()).toBe(false);
      expect(raw.dskxsi(false, target, [], 0, frame, v, [1, 0, 0])).toEqual({
        found: false,
      });
      const out = raw.dskxv(
        false,
        target,
        [],
        0,
        frame,
        [v, v, v],
        [d, [1, 0, 0], d],
      );
      expect(out).toEqual([
        { found: true, xpt: [0.75, 1, 0.25] },
        { found: false },
        { found: true, xpt: [0.75, 1, 0.25] },
      ]);
      const a = out[0],
        b = out[2];
      if (!a?.found || !b?.found) throw new Error("Missing hits");
      a.xpt[1] = 999;
      expect(b.xpt[1]).toBe(1);
    } finally {
      raw.kclear();
      await client.dispose();
    }
  });
  test(`${backend}: all DSK tolerance changes survive kclear and are explicitly restored`, async () => {
    const client = await spiceClients.toSync({ backend }),
      raw = client.spice.raw;
    const saved = [1, 2, 3, 4].map((key) => raw.dskgtl(key));
    try {
      for (const [i, x] of saved.entries()) raw.dskstl(i + 1, x * 2);
      raw.kclear();
      expect([1, 2, 3, 4].map((key) => raw.dskgtl(key))).toEqual(
        saved.map((x) => x * 2),
      );
      expect(() => raw.dskstl(5, raw.dskgtl(5))).toThrow(/IMMUTABLEVALUE/);
      expect(() => raw.dskgtl(7)).toThrow(/INDEXOUTOFRANGE/);
    } finally {
      for (const [i, x] of saved.entries()) raw.dskstl(i + 1, x);
      await client.dispose();
    }
  });
}

for (const backend of ["node", "wasm"] as const) {
  for (const mode of ["toSync", "toAsync"] as const) {
    it.runIf(backend === "wasm" || nodeBackendAvailable)(
      `${backend} ${mode}: cached clients observe DSK tolerance writes, segment replacement and handle closure`,
      async () => {
        const client = await spiceClients
          .caching({ maxEntries: 100 })
          [mode]({ backend });
        const raw = client.spice.raw;
        const original = await raw.dskgtl(1);
        try {
          await raw.dskstl(1, 0.000001);
          expect(await raw.dskgtl(1)).toBe(0.000001);
          await raw.dskstl(1, original);
          expect(await raw.dskgtl(1)).toBe(original);
          await raw.dskstl(1, 0.000001);
          expect(await raw.dskgtl(1)).toBe(0.000001);

          await raw.dskstl(1, original);
          const inner = "audit-geometry.bds";
          const outer = "audit-dsk-ray-outer.bds";
          for (const file of ["audit-geometry.tf", inner, outer]) {
            await raw.furnsh(fixture(file));
          }
          const source = () => raw.dskxsi(false, target, [], 0, frame, v, d);
          const batch = () => raw.dskxv(false, target, [], 0, frame, [v], [d]);
          const first = await source();
          if (!first.found) throw new Error("Missing outer DSK hit");
          expect(first.dskdsc.surfce).toBe(102);
          expect(await batch()).toEqual([
            { found: true, xpt: [3.75, 1, 0.25] },
          ]);
          await raw.unload(outer);
          const next = await source();
          if (!next.found) throw new Error("Missing inner DSK hit");
          expect(next.dskdsc.surfce).toBe(101);
          expect(next.handle).not.toEqual(first.handle);
          expect(await batch()).toEqual([
            { found: true, xpt: [0.75, 1, 0.25] },
          ]);

          const claim = await raw.dasopr(inner);
          const descriptor = await raw.dlabfs(claim);
          if (!descriptor.found) throw new Error("Missing inner segment");
          const direct = () => raw.dskx02(claim, descriptor.descr, v, d);
          try {
            expect(await direct()).toEqual({
              found: true,
              plid: 1,
              xpt: [0.75, 1, 0.25],
            });
          } finally {
            await raw.dascls(claim);
          }
          await expect(async () => direct()).rejects.toThrow(/handle/i);
        } finally {
          try {
            await raw.dskstl(1, original);
            await raw.kclear();
          } finally {
            await client.dispose();
          }
        }
      },
    );
  }
}
