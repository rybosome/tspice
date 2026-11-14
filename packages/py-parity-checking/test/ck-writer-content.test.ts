import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type { FramesApi } from "@rybosome/tspice-backend-contract";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const root = path.resolve(import.meta.dirname, ".."),
  fixture = path.join(root, "fixtures/kernels/audit-ck-writers.bc");
const inspect = String.raw`
import json,sys,spiceypy as sp
p=sys.argv[1];h=sp.dafopr(p);sp.dafbfs(h);segments=[];seen=[]
while sp.daffna():
    dc,ic=sp.dafus(sp.dafgs(5),2,6);seen.append(int(ic[0]));segments.append([sp.dafgn(),dc.tolist(),ic[:4].tolist(),sp.dafgda(h,int(ic[4]),int(ic[5])).tolist()])
sp.dafcls(h);h=sp.cklpf(p);observations=[]
for inst in seen:
    for tick in [1000,1005,1010]:
        with sp.no_found_check():
            m,a,t,found=sp.ckgpav(inst,tick,0,'J2000')
        observations.append(dict(inst=inst,tick=tick,found=bool(found),values=[*m.ravel().tolist(),*a.tolist(),float(t)] if found else []))
sp.ckupf(h);print(json.dumps(dict(segments=segments,observations=observations)))
`;
function oracle(file: string) {
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
        inspect,
        file,
      ],
      { encoding: "utf8" },
    ),
  ) as {
    segments: unknown[];
    observations: {
      inst: number;
      tick: number;
      found: boolean;
      values: number[];
    }[];
  };
}
function write(raw: FramesApi) {
  const output = { kind: "virtual-output", path: "test/own.bc" } as const;
  const w = raw.ckopn(output, "INDEPENDENT DUT", 100);
  expect(() => raw.ckcls(w)).toThrow(/NOSEGMENTSFOUND/);
  const t = [1000, 1010],
    q = [
      [1, 0, 0, 0],
      [0.98, 0.1, 0.1, 0.1],
    ],
    av = [
      [0.01, 0.02, 0.03],
      [0.04, 0.05, 0.06],
    ],
    dq = [
      [0, 0.004, 0.003, -0.002],
      [-0.001, 0.005, 0.002, -0.003],
    ],
    da = [
      [0.002, 0.003, -0.004],
      [0.001, -0.003, 0.006],
    ];
  raw.ckw01(
    w,
    1000,
    1010,
    -123000,
    "J2000",
    true,
    "DISCRETE",
    t,
    q.flat(),
    av.flat(),
  );
  raw.ckw02(
    w,
    1000,
    1010,
    -123001,
    "J2000",
    "CONSTANT",
    [1000],
    [1010],
    q[0]!,
    [0.001, 0.002, 0.003],
    [0.5],
  );
  raw.ckw03(
    w,
    1000,
    1010,
    -123002,
    "J2000",
    true,
    "INTERPOLATED",
    t,
    q.flat(),
    av.flat(),
    [1000],
  );
  for (const s of [0, 1, 2, 3]) {
    const words = q.flatMap((row, i) => [
      ...row,
      ...(s === 0 || s === 2 ? dq[i]! : []),
      ...(s >= 2 ? av[i]! : []),
      ...(s === 2 ? da[i]! : []),
    ]);
    raw.ckw05(
      w,
      s,
      s === 0 || s === 2 ? 3 : 1,
      1000,
      1010,
      -123003 - s,
      "J2000",
      true,
      "PACKETS" + s,
      t,
      words,
      0.5,
      [1000],
    );
    words.fill(99);
  }
  raw.ckcls(w);
  expect(() => raw.ckcls(w)).toThrow(/closed/);
  return output;
}
for (const backend of ["node", "wasm"] as const) {
  const test = it.runIf(backend === "wasm" || nodeBackendAvailable);
  test(`${backend} writes physical CK types 1/2/3 and all four type 5 subtypes for an independent DAF reader`, async () => {
    const client = await spiceClients.toSync({ backend });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-ck-"));
    try {
      const output = write(client.spice.raw);
      const bytes = client.spice.kit.readVirtualOutput(output);
      const pathOut = path.join(dir, "actual.bc");
      fs.writeFileSync(pathOut, bytes);
      bytes.fill(0);
      expect(
        new TextDecoder().decode(
          client.spice.kit.readVirtualOutput(output).subarray(0, 6),
        ),
      ).toBe("DAF/CK");
      const actual = oracle(pathOut),
        ref = oracle(fixture);
      expect(actual.segments).toEqual(ref.segments);
      expect(actual.observations).toEqual(ref.observations);
      expect(actual.segments).toHaveLength(7);
    } finally {
      await client.dispose();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
  test(`${backend} reads every independently written CK rotation and angular velocity with real returned ticks and misses`, async () => {
    const client = await spiceClients.toSync({ backend });
    const { raw } = client.spice;
    const name = "test/independent.bc";
    try {
      raw.furnsh({ path: name, bytes: fs.readFileSync(fixture) });
      raw.unload(name);
      const h = raw.cklpf(name);
      try {
        for (const obs of oracle(fixture).observations) {
          const o = raw.ckgpav(obs.inst, obs.tick, 0, "J2000");
          expect(o.found).toBe(obs.found);
          if (o.found) {
            const values = [...o.cmat, ...o.av, o.clkout];
            expect(values.length).toBe(obs.values.length);
            for (const [i, v] of values.entries())
              expect(v).toBeCloseTo(obs.values[i]!, 12);
          }
        }
      } finally {
        raw.ckupf(h);
      }
    } finally {
      await client.dispose();
    }
  });
}
