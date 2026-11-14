import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const kernel = (which: string) => ({
  path: which,
  bytes: fs.readFileSync(
    new URL("../fixtures/kernels/" + which, import.meta.url),
  ),
});
const t = 125.25;
const acc = [0.0006, -0.0004, 0.0003] as const;
function close(a: number, b: number, tolerance: number) {
  expect(Math.abs(a - b)).toBeLessThanOrEqual(tolerance);
}
function vector(a: readonly number[], b: readonly number[], tolerance: number) {
  expect(a).toHaveLength(b.length);
  for (const [i, expected] of b.entries()) close(a[i]!, expected, tolerance);
}
for (const backend of ["node", "wasm"] as const) {
  const run = it.runIf(backend === "wasm" || nodeBackendAvailable);
  run(
    backend +
      " differentiates the light-time and stellar-corrected position on an independently authored moving observer",
    async () => {
      const setup = await spiceClients.toSync({ backend }),
        raw = setup.spice.raw;
      try {
        raw.furnsh(kernel("audit-ephemeris.bsp"));
        raw.furnsh(kernel("audit-ephemeris-observer.bsp"));
        const state = raw.spkssb(100002, t, "J2000");
        for (const [flag, dir] of [
          ["CN+S", "<-"],
          ["XCN+S", "->"],
        ] as const) {
          const result = raw.spkacs(100001, t, "J2000", flag, 100002);
          const supplied = raw.spkaps(100001, t, "J2000", flag, state, acc);
          vector(supplied.state, result.state, 2e-11);
          close(supplied.lt, result.lt, 2e-13);
          close(supplied.dlt, result.dlt, 2e-14);
          const h = 0.05,
            lo = raw.spkacs(100001, t - h, "J2000", flag, 100002),
            hi = raw.spkacs(100001, t + h, "J2000", flag, 100002);
          for (let k = 0; k < 3; k++)
            close(
              result.state[k + 3]!,
              (hi.state[k]! - lo.state[k]!) / (2 * h),
              4e-9,
            );
          close(result.dlt, (hi.lt - lo.lt) / (2 * h), 3e-14);
          const signal = raw.ltime(t, 100002, dir, 100001);
          close(signal.elapsd, result.lt, 2e-13);
          close(signal.ettarg, t + (dir === "->" ? 1 : -1) * result.lt, 3e-13);
          const legacy = raw.spkapp(100001, t, "J2000", state, flag),
            plain = raw.spkapp(100001, t, "J2000", state, flag.slice(0, -2));
          vector(
            legacy.state.slice(0, 3),
            raw.spkapo(100001, t, "J2000", state, flag).pos,
            1e-10,
          );
          vector(legacy.state.slice(3), plain.state.slice(3), 0);
          expect(Math.abs(legacy.state[3] - result.state[3])).toBeGreaterThan(
            1e-7,
          );
          const light = raw.spkltc(100001, t, "J2000", flag, state),
            without = raw.spkltc(100001, t, "J2000", flag.slice(0, -2), state);
          expect(light).toEqual(without);
        }
      } finally {
        raw.kclear();
        await setup.dispose();
      }
    },
  );
  run(
    backend + " preserves correction selection after equivalent long spellings",
    async () => {
      const setup = await spiceClients.toSync({ backend }),
        raw = setup.spice.raw;
      try {
        raw.furnsh(kernel("audit-ephemeris.bsp"));
        raw.furnsh(kernel("audit-ephemeris-observer.bsp"));
        const state = raw.spkssb(100002, t, "J2000");
        const methods = [
          (flag: string) =>
            raw.spkacs(100001, t, "J2000", flag, 100002).state[0],
          (flag: string) =>
            raw.spkaps(100001, t, "J2000", flag, state, acc).state[0],
          (flag: string) =>
            raw.spkapp(100001, t, "J2000", state, flag).state[0],
          (flag: string) => raw.spkapo(100001, t, "J2000", state, flag).pos[0],
        ];
        for (const query of methods) {
          const plain = query("LT"),
            stellar = query("LT+S");
          expect(Math.abs(stellar - plain)).toBeGreaterThan(1e-5);
          expect(query("LT   +S")).toBe(stellar);
          expect(query("LT")).toBe(plain);
        }
      } finally {
        raw.kclear();
        await setup.dispose();
      }
    },
  );
  run(
    backend +
      " applies each correction across an inherited SPKEZR call and a later SPKACS call",
    async () => {
      const project = fileURLToPath(
        new URL("../sidecars/spiceypy/", import.meta.url),
      );
      const fixtures = fileURLToPath(
        new URL("../fixtures/kernels/", import.meta.url),
      );
      const expected = JSON.parse(
        execFileSync(
          "uv",
          [
            "run",
            "--locked",
            "--project",
            project,
            "python",
            "-c",
            `
from pathlib import Path
import json, sys, spiceypy as sp
for name in ("audit-ephemeris.bsp","audit-ephemeris-observer.bsp"):
    sp.furnsh(str(Path(sys.argv[1]) / name))
out=[]
for option in ("LT","LT+S"):
    state,lt,dlt=sp.spkacs(100001,125.25,"J2000",option,100002)
    out.append([*state,lt,dlt])
try:
    sp.spkezr("100001",125.25,"J2000","     ","100002")
except sp.utils.exceptions.SpiceyError as error:
    out.extend([error.short,error.traceback])
else:
    raise AssertionError("expected a blank correction diagnostic")
print(json.dumps(out,allow_nan=False))
`,
            fixtures,
          ],
          { encoding: "utf8", timeout: 30000 },
        ),
      ) as [number[], number[], string, string];
      const setup = await spiceClients.toSync({ backend });
      const raw = setup.spice.raw;
      try {
        raw.furnsh(kernel("audit-ephemeris.bsp"));
        raw.furnsh(kernel("audit-ephemeris-observer.bsp"));
        const query = (flag: string) =>
          raw.spkacs(100001, t, "J2000", flag, 100002);
        const inherited = (flag: string) =>
          raw.spkezr("100001", t, "J2000", flag, "100002");
        const plain = query("LT");
        const stellar = query("LT+S");
        for (const [actual, values] of [
          [plain, expected[0]],
          [stellar, expected[1]],
        ] as const) {
          vector([...actual.state, actual.lt, actual.dlt], values, 1e-10);
        }
        expect(Math.abs(plain.state[0] - stellar.state[0])).toBeGreaterThan(
          1e-5,
        );

        const expectedStellar = inherited("LT+S");
        expect(inherited("LT   +S")).toEqual(expectedStellar);
        expect(query("LT")).toEqual(plain);
        expect(inherited("      LT+S")).toEqual(expectedStellar);
        expect(() => inherited("     ")).toThrowError(
          expect.objectContaining({
            spiceShort: expected[2],
            spiceTrace: expected[3],
          }),
        );
        expect(raw.failed()).toBe(false);
        expect(query("LT")).toEqual(plain);
        expect(inherited("LT       ").state).toEqual(plain.state);
        expect(query("LT+S")).toEqual(stellar);
      } finally {
        raw.kclear();
        await setup.dispose();
      }
    },
  );
  run(
    backend +
      " preserves primary missing-data traces, balanced caller scope and new calls after recovery",
    async () => {
      const setup = await spiceClients.toSync({ backend }),
        raw = setup.spice.raw;
      try {
        raw.furnsh(kernel("audit-ephemeris.bsp"));
        raw.chkin("CORRECTION_CALLER");
        const attempts = [
          [
            () => raw.spkacs(0, 100, "J2000", "CN+S", 100001),
            "SPKINSUFFDATA",
            "SPKACS",
            "SPKGEO",
          ],
          [
            () =>
              raw.spkaps(
                0,
                t,
                "J2000",
                "LT+S",
                [-1, 0, 0, 0, 299792.458, 0],
                acc,
              ),
            "DIVIDEBYZERO",
            "SPKAPS",
            "ZZSTELAB",
          ],
          [
            () => raw.spkapp(0, t, "J2000", [-1, 0, 0, 0, 300000, 0], "XCN+S"),
            "VALUEOUTOFRANGE",
            "SPKAPP",
            "STELAB",
          ],
          [
            () => raw.ltime(0, 0, "->", 778899),
            "SPKINSUFFDATA",
            "LTIME",
            "SPKGEO",
          ],
        ] as const;
        for (const [invoke, code, frame, inner] of attempts) {
          let failure: unknown;
          try {
            invoke();
          } catch (error) {
            failure = error;
          }
          expect(failure).toMatchObject({
            spiceShort: "SPICE(" + code + ")",
            spiceTrace: expect.stringContaining("CORRECTION_CALLER"),
          });
          const trace = String(Reflect.get(Object(failure), "spiceTrace"));
          expect(trace).toContain(frame);
          expect(trace).toContain(inner);
          expect(raw.failed()).toBe(false);
        }
        raw.chkout("CORRECTION_CALLER");
        expect(raw.spkltc(0, 0, "J2000", "NONE", [0, 0, 0, 0, 0, 0])).toEqual({
          state: [0, 0, 0, 0, 0, 0],
          lt: 0,
          dlt: 0,
        });
      } finally {
        raw.kclear();
        await setup.dispose();
      }
    },
  );
  run(
    backend +
      " preserves each IEEE result against the locked library and its three-word acceleration ABI",
    async () => {
      const project = fileURLToPath(
        new URL("../sidecars/spiceypy/", import.meta.url),
      );
      const program = `
import json, math, sys, spiceypy as sp
from py_parity_sidecar import correction_oracle as co
def tag(x):
    return "NaN" if math.isnan(x) else ("+Inf" if x > 0 else "-Inf") if math.isinf(x) else x
def row(out):
    return [tag(x) for x in [*out[0], *out[1:]]]
out=[]
for m in (sys.float_info.max, 512.):
    s=[-m,-m,0,-m,-m,0]
    args=(0,0.,"J2000")
    modern=co.spkaps(*args,"NONE",s,[1.,-2.,3.])
    padded=sp.spkaps(*args,"NONE",s,[1.,-2.,3.,9.,8.,7.])
    assert row(modern)==row(padded)
    out.append([row(sp.spkltc(*args,"NONE",s)),row(modern),row(sp.spkapp(*args,s,"NONE")),row(sp.spkapo(*args,s,"NONE"))])
assert not sp.failed()
print(json.dumps(out,allow_nan=False))
`;
      const expected: unknown = JSON.parse(
        execFileSync(
          "uv",
          ["run", "--locked", "--project", project, "python", "-c", program],
          {
            encoding: "utf8",
            timeout: 30000,
            env: {
              ...process.env,
              PYTHONPATH: fileURLToPath(
                new URL("../sidecars/spiceypy/src", import.meta.url),
              ),
            },
          },
        ),
      );
      const setup = await spiceClients.toSync({ backend }),
        raw = setup.spice.raw;
      const tag = (x: number) =>
        Number.isNaN(x)
          ? "NaN"
          : Number.isFinite(x)
            ? x
            : x > 0
              ? "+Inf"
              : "-Inf";
      try {
        const observations = [];
        for (const m of [Number.MAX_VALUE, 512]) {
          const s = [-m, -m, 0, -m, -m, 0] as const;
          const light = raw.spkltc(0, 0, "J2000", "NONE", s),
            modern = raw.spkaps(0, 0, "J2000", "NONE", s, [1, -2, 3]),
            legacy = raw.spkapp(0, 0, "J2000", s, "NONE"),
            pos = raw.spkapo(0, 0, "J2000", s, "NONE");
          observations.push(
            [
              [...light.state, light.lt, light.dlt],
              [...modern.state, modern.lt, modern.dlt],
              [...legacy.state, legacy.lt],
              [...pos.pos, pos.lt],
            ].map((v) => v.map(tag)),
          );
        }
        expect(observations).toEqual(expected);
      } finally {
        await setup.dispose();
      }
    },
  );
  for (const transport of ["sync", "async"] as const)
    run(
      backend +
        " " +
        transport +
        " cached transport follows SPK replacement and unload for all six kernel readers",
      async () => {
        const builder = spiceClients.caching({ maxEntries: 128, ttlMs: null });
        const setup =
            transport === "sync"
              ? await builder.toSync({ backend })
              : await builder.toAsync({ backend }),
          raw = setup.spice.raw;
        try {
          const state = [-40182, -14980, 27990, -1.43, 0.2, -0.06] as const;
          const observe = async () => [
            (await raw.spkacs(100001, t, "J2000", "CN+S", 100002)).state[0],
            (await raw.spkapo(100001, t, "J2000", state, "XLT+S")).pos[0],
            (await raw.spkapp(100001, t, "J2000", state, "XLT+S")).state[0],
            (await raw.spkaps(100001, t, "J2000", "CN+S", state, acc)).state[0],
            (await raw.spkltc(100001, t, "J2000", "LT", state)).state[0],
            (await raw.ltime(t, 100002, "->", 100001)).ettarg,
          ];
          await raw.furnsh(kernel("audit-ephemeris.bsp"));
          await raw.furnsh(kernel("audit-ephemeris-observer.bsp"));
          const before = await observe();
          await raw.furnsh(kernel("audit-ephemeris-priority.bsp"));
          const changed = await observe();
          for (let i = 0; i < 6; i++)
            expect(Math.abs(changed[i]! - before[i]!)).toBeGreaterThan(
              i === 5 ? 0.1 : 90000,
            );
          await raw.unload("audit-ephemeris-priority.bsp");
          expect(await observe()).toEqual(before);
        } finally {
          await raw.kclear();
          await setup.dispose();
        }
      },
    );
}
