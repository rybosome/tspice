import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { allCases } from "../src/cases/index.js";
import { runCaseInTspice } from "../src/run-tspice/index.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const root = path.resolve(import.meta.dirname, "..");
const gm = 398600.4418,
  r = 7000,
  speed = Math.sqrt(gm / r),
  rate = speed / r;
const constants = [
  0.001082616, -2.53881e-6, -1.65597e-6, 0.0743669161, 120, 78, 6378.135, 1,
];
const elements = [0, 0, 0.00001, 0.5, 0.2, 0.03, 0.4, 0.7, 0.06, 0];
const eq = [r, 0, 0, 0, 0, 0, 0, rate, 0];
const kinds = [5, 10, 15, 17] as const;
const times = [-300, -120.5, 0, 1, 300];
function oracle(mode: "read" | "write", file: string) {
  return JSON.parse(
    execFileSync(
      "uv",
      [
        "run",
        "--locked",
        "--project",
        "sidecars/spiceypy",
        "python",
        "test/_helpers/spk_analytic_oracle.py",
        mode,
        file,
      ],
      { cwd: root, encoding: "utf8" },
    ),
  ) as {
    id: string;
    metadata: number[];
    words: number[];
    states: number[][];
  }[];
}
function once<T extends readonly number[]>(input: T): T {
  const seen = new Set<PropertyKey>();
  return new Proxy(input, {
    get(v, key) {
      if (seen.has(key)) throw Error("Repeated access " + String(key));
      seen.add(key);
      return Reflect.get(v, key);
    },
  });
}
for (const backend of ["node", "wasm"] as const) {
  const run = it.runIf(backend === "wasm" || nodeBackendAvailable);
  run(
    backend +
      " exchanges all four analytic SPK representations with an independent writer and DAF reader",
    async () => {
      const s = await spiceClients.toSync({ backend }),
        { raw, kit } = s.spice,
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "analytic-spk-"));
      try {
        const file = { kind: "virtual-output", path: "models.bsp" } as const,
          h = raw.spkopn(file, "MODELS", 0);
        for (const kind of kinds) {
          const pre = [
            h,
            196000 + kind,
            0,
            "J2000",
            -300,
            300,
            "TYPE " + kind,
          ] as const;
          if (kind === 5)
            raw.spkw05(...pre, gm, once([r, 0, 0, 0, speed, 0]), once([0]));
          else if (kind === 10) {
            const storage = new Float64Array([NaN, ...elements, NaN]),
              view = storage.subarray(1, -1);
            raw.spkw10(...pre, once(constants), view, once([0]));
            view.fill(-1);
          } else if (kind === 15)
            raw.spkw15(
              ...pre,
              0,
              once([0, 0, 3] as const),
              once([2, 0, 0] as const),
              7000,
              0.1,
              3,
              once([0, 0, 2] as const),
              gm,
              0.001,
              6378,
            );
          else raw.spkw17(...pre, 0, once(eq), -Math.PI / 2, Math.PI / 2);
        }
        raw.spkw10(h, 196099, 0, "J2000", -10, 10, "EMPTY", constants, [], []);
        expect(() => kit.readVirtualOutput(file)).toThrow();
        raw.spkcls(h);
        const local = path.join(dir, "local.bsp"),
          ext = path.join(dir, "independent.bsp");
        fs.writeFileSync(local, kit.readVirtualOutput(file));
        const app = oracle("read", local),
          ind = oracle("write", ext);
        raw.furnsh({
          path: "timing.tls",
          bytes: new Uint8Array(
            fs.readFileSync(path.join(root, "fixtures/kernels/naif0012.tls")),
          ),
        });
        raw.furnsh({
          path: "independent.bsp",
          bytes: new Uint8Array(fs.readFileSync(ext)),
        });
        for (const [i, kind] of [...kinds, 99].entries()) {
          const a = app[i]!,
            b = ind[i]!,
            body = 196000 + kind,
            search = raw.spksfs(body, 0);
          expect(a.id).toBe(b.id);
          expect(a.metadata).toEqual(b.metadata);
          if (!search.found) throw Error("Missing independent orbit " + kind);
          const meta = raw.spkuds(search.descr);
          expect(search.ident).toBe(b.id);
          expect([
            meta.body,
            meta.center,
            meta.frame,
            meta.type,
            meta.first,
            meta.last,
            meta.baddr,
            meta.eaddr,
          ]).toEqual(b.metadata);
          expect(a.words.length).toBe(b.words.length);
          for (const [index, word] of a.words.entries()) {
            // Type 10 computes four nutation terms while writing. The other physical fields are copies or axis normalizations.
            if (kind === 10 && index >= 19 && index <= 22)
              expect(word).toBeCloseTo(b.words[index]!, 17);
            else expect(word).toBe(b.words[index]);
          }
          if (kind === 99) {
            expect(a.words.length).toBe(25);
            expect(a.words.slice(0, 8)).toEqual(constants);
            expect(a.states).toEqual([]);
            continue;
          }
          if (kind === 5)
            expect(a.words).toEqual([r, 0, 0, 0, speed, 0, 0, gm, 1]);
          if (kind === 10) {
            expect(a.words.slice(0, 19)).toEqual([
              ...constants,
              0,
              ...elements,
            ]);
            expect(a.words.length).toBe(41);
          }
          if (kind === 15)
            expect(a.words).toEqual([
              0,
              0,
              0,
              1,
              1,
              0,
              0,
              7000,
              0.1,
              3,
              0,
              0,
              1,
              gm,
              0.001,
              6378,
            ]);
          if (kind === 17)
            expect(a.words).toEqual([0, ...eq, -Math.PI / 2, Math.PI / 2]);
          for (const [j, et] of times.entries()) {
            const result = raw.spkgeo(body, et, "J2000", 0).state;
            const angle = rate * et,
              c = Math.cos(angle),
              sin = Math.sin(angle),
              circular = [r * c, r * sin, 0, -speed * sin, speed * c, 0];
            for (let k = 0; k < 6; k++) {
              expect(a.states[j]![k]!).toBeCloseTo(b.states[j]![k]!, 9);
              expect(result[k]).toBeCloseTo(b.states[j]![k]!, 8);
              if (kind === 5 || kind === 17)
                expect(result[k]).toBeCloseTo(circular[k]!, 8);
            }
          }
        }
      } finally {
        raw.kclear();
        await s.dispose();
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  );
  run(
    backend +
      " compares tightly spaced osculating-state blends with independent propagation and the circular solution",
    async () => {
      const setup = await spiceClients.toSync({ backend }),
        { raw, kit } = setup.spice,
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "dense-conic-"));
      try {
        const epochs = Array.from({ length: 101 }, (_, i) => i - 50);
        const orbit = (et: number) => {
          const a = rate * et;
          return [
            r * Math.cos(a),
            r * Math.sin(a),
            0,
            -speed * Math.sin(a),
            speed * Math.cos(a),
            0,
          ];
        };
        const file = { kind: "virtual-output", path: "dense.bsp" } as const,
          h = raw.spkopn(file, "DENSE", 0);
        raw.spkw05(
          h,
          196005,
          0,
          "J2000",
          -50,
          50,
          "DENSE DIRECTORY",
          gm,
          epochs.flatMap(orbit),
          epochs,
        );
        raw.spkcls(h);
        const bytes = kit.readVirtualOutput(file),
          local = path.join(dir, "dense.bsp");
        fs.writeFileSync(local, bytes);
        const expected = JSON.parse(
          execFileSync(
            "uv",
            [
              "run",
              "--locked",
              "--project",
              "sidecars/spiceypy",
              "python",
              "-c",
              "import spiceypy as s,sys,json;s.furnsh(sys.argv[1]);h,d,_=s.spksfs(196005,0,41);m=s.spkuds(d);print(json.dumps([s.dafgda(h,m[7]-2,m[7]).tolist(),*[s.spkgeo(196005,x,'J2000',0)[0].tolist() for x in (47.5,49,49.75,50)]]))",
              local,
            ],
            { cwd: root, encoding: "utf8" },
          ),
        ) as number[][];
        expect(expected[0]).toEqual([49, gm, 101]);
        raw.furnsh({ path: "physical-dense.bsp", bytes });
        for (const [j, t] of [47.5, 49, 49.75, 50].entries()) {
          const actual = raw.spkgeo(196005, t, "J2000", 0).state,
            analytic = orbit(t);
          for (let i = 0; i < 6; i++) {
            // SPKE05 multiplies the difference of two propagated positions by the
            // derivative of the blend. At one-second spacing this exposes last-bit position errors in velocity.
            expect(Math.abs(actual[i]! - expected[j + 1]![i]!)).toBeLessThan(
              i < 3 ? 2e-10 : 1e-11,
            );
            expect(Math.abs(actual[i]! - analytic[i]!)).toBeLessThan(
              i < 3 ? 2e-10 : 1e-11,
            );
          }
        }
      } finally {
        raw.kclear();
        await setup.dispose();
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  );
  run(
    backend +
      " rejects incomplete storage and a type 10 ordering failure without contaminating the open writer",
    async () => {
      const s = await spiceClients.toSync({ backend }),
        { raw } = s.spice;
      try {
        const h = raw.spkopn(
            { kind: "virtual-output", path: "recovery.bsp" },
            "RECOVERY",
            0,
          ),
          pre = [h, 200001, 0, "J2000", 0, 1, "RECOVERY"] as const;
        expect(() => raw.spkw05(...pre, gm, [1], [0])).toThrow(/length/);
        expect(() =>
          raw.spkw05(...pre, gm, [Infinity, 0, 0, 0, 1, 0], [0]),
        ).toThrow(/finite/);
        expect(() =>
          raw.spkw10(...pre, constants, [...elements, ...elements], [1, 0]),
        ).toThrow(/increase/);
        expect(() =>
          raw.spkw10(...pre, constants, [...elements, ...elements], [0, 0]),
        ).toThrow(/increase/);
        expect(() =>
          raw.spkw15(
            ...pre,
            0,
            [0, 0, 1],
            [1, 0, 0],
            1,
            0,
            2 ** 31,
            [0, 0, 1],
            gm,
            0,
            0,
          ),
        ).toThrow(/signed/);
        expect(() => raw.spkw17(...pre, 0, eq.slice(1), 0, 1)).toThrow(
          /length/,
        );
        expect(() => raw.spkw17(...pre, 0, [0, ...eq.slice(1)], 0, 1)).toThrow(
          /BADSEMIAXIS/,
        );
        raw.spkw10(...pre, constants, elements, [0]);
        raw.spkw05(...pre, gm, [r, 0, 0, 0, speed, 0], [0]);
        raw.spkcls(h);
        expect(() => raw.spkw10(...pre, constants, elements, [0])).toThrow(
          /closed/,
        );
      } finally {
        await s.dispose();
      }
    },
  );
}
it("repeats all analytic scratch-file workflows on one persistent WASM client", async () => {
  const setup = await spiceClients.toSync({ backend: "wasm" });
  try {
    for (const n of ["05", "10", "15", "17"]) {
      const c = allCases.find(
        (v) => v.caseId === "ephemeris-spkw" + n + "-orbit",
      );
      if (!c) throw Error("Missing orbit");
      const a = runCaseInTspice(setup.spice, c, path.join(root, "fixtures")),
        b = runCaseInTspice(setup.spice, c, path.join(root, "fixtures"));
      expect(a.ok).toBe(true);
      expect(b).toEqual(a);
    }
  } finally {
    await setup.dispose();
  }
});

it("observes the canonical type 10 partial write and blocked retry in an independent process", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "type10-order-"));
  try {
    const out = execFileSync(
      "uv",
      [
        "run",
        "--locked",
        "--project",
        "sidecars/spiceypy",
        "python",
        "test/_helpers/spk_analytic_oracle.py",
        "order",
        path.join(dir, "order.bsp"),
      ],
      { cwd: root, encoding: "utf8" },
    );
    expect(JSON.parse(out)).toEqual([
      "SPICE(UNORDEREDREFS)",
      "SPICE(CALLEDOUTOFORDER)",
      [196001],
    ]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
