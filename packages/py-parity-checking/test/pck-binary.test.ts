import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const root = path.resolve(import.meta.dirname, "..");
const fixture = path.join(root, "fixtures/kernels/audit-orientation.bpc");
const independent = String.raw`
import json, sys, spiceypy as sp
from spiceypy.utils.support_types import SPICEINT_CELL, SPICEDOUBLE_CELL
p=sys.argv[1]; ids=SPICEINT_CELL(8);win=SPICEDOUBLE_CELL(16)
sp.pckfrm(p,ids); sp.pckcov(p,3000,win)
h=sp.dafopr(p); sp.dafbfs(h); segments=[]
while sp.daffna():
    dc,ic=sp.dafus(sp.dafgs(5),2,5)
    segments.append(dict(name=sp.dafgn(),times=dc.tolist(),descriptor=ic[:3].tolist(),words=sp.dafgda(h,int(ic[3]),int(ic[4])).tolist()))
sp.dafcls(h); ph=sp.pcklof(p); t=float(sys.argv[2]); matrix=sp.pxform('J2000','ITRF93',t).ravel().tolist();state=sp.sxform('J2000','ITRF93',t).ravel().tolist();sp.pckuof(ph)
print(json.dumps(dict(ids=list(ids),coverage=list(win),segments=segments,matrix=matrix,state=state)))
`;
function readOracle(file: string, epoch: number) {
  return JSON.parse(
    execFileSync(
      "uv",
      [
        "run",
        "--locked",
        "--project",
        path.join(root, "sidecars/spiceypy"),
        "python",
        "-c",
        independent,
        file,
        String(epoch),
      ],
      { encoding: "utf8" },
    ),
  ) as {
    ids: number[];
    coverage: number[];
    segments: {
      name: string;
      times: number[];
      descriptor: number[];
      words: number[];
    }[];
    matrix: number[];
    state: number[];
  };
}
function eqMatrices(actual: readonly number[], expected: readonly number[]) {
  expect(actual.length).toBe(expected.length);
  for (const [i, x] of actual.entries())
    expect(x).toBeCloseTo(expected[i]!, 12);
}
for (const backend of ["wasm", "node"] as const) {
  const test = it.runIf(backend === "wasm" || nodeBackendAvailable);
  test(`${backend} exports complete physical PCK records for a separate SpiceyPy DAF and orientation reader`, async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-pck-records-"));
    const client = await spiceClients.toSync({ backend });
    const { raw, kit } = client.spice;
    const file = { kind: "virtual-output", path: "pck/owned.bpc" } as const;
    try {
      const w = raw.pckopn(file, "AUTHORED RECORDS", 1200);
      expect(() => raw.pckcls(w)).toThrow(/NOSEGMENTSFOUND/);
      expect(() => kit.readVirtualOutput(file)).toThrow(/open|close/i);
      const coeffs = [
        0.2, 0.03, 0.5, -0.02, 0.7, 0.04, 0.4, -0.01, 0.8, 0.01, 1.1, -0.06,
      ];
      const original = [...coeffs];
      raw.pckw02(
        w,
        3000,
        "J2000",
        1,
        19,
        "PHYSICAL RECORDS",
        10,
        2,
        1,
        coeffs,
        0,
      );
      coeffs.fill(17);
      raw.pckcls(w);
      expect(() =>
        raw.pckw02(w, 3000, "J2000", 1, 19, "CLOSED", 10, 2, 1, original, 0),
      ).toThrow(/closed/);
      const bytes = kit.readVirtualOutput(file);
      const physical = path.join(dir, "output.bpc");
      fs.writeFileSync(physical, bytes);
      bytes.fill(0);
      expect(
        new TextDecoder().decode(kit.readVirtualOutput(file).subarray(0, 7)),
      ).toBe("DAF/PCK");
      const ref = readOracle(physical, 12);
      expect(ref.ids).toEqual([3000]);
      expect(ref.coverage).toEqual([1, 19]);
      expect(ref.segments).toEqual([
        {
          name: "PHYSICAL RECORDS",
          times: [1, 19],
          descriptor: [3000, 1, 2],
          words: [
            5,
            5,
            ...original.slice(0, 6),
            15,
            5,
            ...original.slice(6),
            0,
            10,
            8,
            2,
          ],
        },
      ]);
      const h = raw.pcklof(file);
      try {
        eqMatrices(raw.pxform("J2000", "ITRF93", 12), ref.matrix);
        eqMatrices(raw.sxform("J2000", "ITRF93", 12), ref.state);
      } finally {
        raw.pckuof(h);
      }
    } finally {
      await client.dispose();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
  test(`${backend} reads an independently written PCK and preserves partial query contents and DAF ownership`, async () => {
    const ref = readOracle(fixture, -16);
    const client = await spiceClients.toSync({ backend });
    const { raw, kit } = client.spice;
    const id = "pck/reference.bpc";
    raw.furnsh({ path: id, bytes: fs.readFileSync(fixture) });
    raw.unload(id);
    const win = kit.newWindow(1),
      ids = kit.newIntCell(1);
    const h = raw.pcklof(id);
    try {
      expect(() => raw.pckcov(id, 3000, win)).toThrow(/WINDOWEXCESS/);
      expect(raw.card(win)).toBe(0);
      expect(raw.wncard(win)).toBe(1);
      expect(raw.wnfetd(win, 0)).toEqual([-20, 0]);
      expect(() => raw.pckfrm(id, ids)).toThrow(/SETEXCESS/);
      expect(raw.card(ids)).toBe(0);
      raw.scard(0, win);
      raw.scard(0, ids);
      raw.insrti(31, ids);
      expect(kit.cellGeti(ids, 0)).toBe(31);
      raw.pckcov(id, 301, win);
      expect(raw.wnfetd(win, 0)).toEqual([4, 8]);
      eqMatrices(raw.pxform("J2000", "ITRF93", -16), ref.matrix);
      eqMatrices(raw.sxform("J2000", "ITRF93", -16), ref.state);
      expect(raw.pcklof(id)).toBe(h);
    } finally {
      raw.pckuof(h);
      kit.freeWindow(win);
      kit.freeCell(ids);
      await client.dispose();
    }
  });
}
