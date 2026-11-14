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
test("requires the original owned DAS claim and physical segment and returns detached mutable rows", () => {
  const a = createNodeBackend(),
    b = createNodeBackend(),
    h = a.raw.dasopr(file("audit-legacy-plates.bds"));
  const d = a.raw.dlabfs(h);
  if (!d.found) throw new Error("Missing authored segment");
  try {
    expect(() => b.raw.llgrid_pl02(h, d.descr, [])).toThrow();
    expect(() =>
      a.raw.llgrid_pl02(h, { ...d.descr, dbase: d.descr.dbase + 1 }, []),
    ).toThrow(/descriptor/);
    expect(() =>
      a.raw.illum_pl02(h, d.descr, "100101", 0, "NONE", "100102", [1, NaN, 0]),
    ).toThrow(/finite/);
    expect(() =>
      a.raw.limb_pl02(
        h,
        d.descr,
        "100101",
        0,
        "J2000",
        "NONE",
        "100102",
        11184810,
      ),
    ).toThrow(/bound/);
    const grid: [number, number] = [0.3, 0.2],
      seen = new Set<PropertyKey>();
    const row = new Proxy(grid, {
      get(target, key) {
        if (seen.has(key)) throw new Error("Repeated coordinate access");
        seen.add(key);
        return Reflect.get(target, key);
      },
    });
    const a1 = a.raw.llgrid_pl02(h, d.descr, [row]),
      saved = a1.srfpts[0]![0];
    a1.srfpts[0]![0] = 999;
    a1.pltids[0] = 999;
    const a2 = a.raw.llgrid_pl02(h, d.descr, [grid]);
    expect(a2.srfpts[0]![0]).toBe(saved);
    expect(a2.pltids).toEqual([1]);
  } finally {
    a.raw.dascls(h);
  }
  expect(() => a.raw.llgrid_pl02(h, d.descr, [])).toThrow();
});
