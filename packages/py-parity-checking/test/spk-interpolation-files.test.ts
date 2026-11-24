import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { allCases } from "../src/cases/index.js";
import { runCaseInTspice } from "../src/run-tspice/index.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const segments = [
  [9, 1],
  [12, 1],
  [13, 1],
  [18, 0],
  [18, 1],
] as const;
const packageRoot = path.resolve(import.meta.dirname, "..");
function oracle(mode: "read" | "write", file: string) {
  const stdout = execFileSync(
    "uv",
    [
      "run",
      "--locked",
      "--project",
      "sidecars/spiceypy",
      "python",
      "test/_helpers/spk_interpolation_oracle.py",
      mode,
      file,
    ],
    { cwd: packageRoot, encoding: "utf8" },
  );
  return JSON.parse(stdout) as {
    metadata: number[];
    id: string;
    words: number[];
    states: number[][];
  }[];
}
function grid(kind: number) {
  return Array.from(
    { length: 102 },
    (_, i) => (i - 50) / 4 + (kind === 12 ? 0 : (i % 3) / 64),
  );
}
function components(t: number) {
  return {
    position: [3 + t * t, -9 + 2 * t, 2 - 0.25 * t * t],
    rate: [2 * t, 2, -0.5 * t],
    velocity: [100 + 3 * t + 0.125 * t * t, -30 + t, 17 - 0.5 * t * t],
    accel: [3 + 0.25 * t, 1, -t],
  };
}
function packet(kind: number, sub: number, t: number): number[] {
  const { position, rate, velocity, accel } = components(t);
  if (kind === 18 && sub === 0)
    return [...position, ...rate, ...velocity, ...accel];
  return [...position, ...(kind === 12 || kind === 13 ? rate : velocity)];
}
for (const backend of ["node", "wasm"] as const) {
  const run = it.runIf(backend === "wasm" || nodeBackendAvailable);
  run(
    backend +
      " exchanges five independently authored SPK segments with SpiceyPy and compares complete physical packet and epoch directories",
    async () => {
      const setup = await spiceClients.toSync({ backend }),
        { raw, kit } = setup.spice,
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-e05-"));
      try {
        const out = {
            kind: "virtual-output",
            path: "e05-results.bsp",
          } as const,
          h = raw.spkopn(out, "INTERP BACKEND", 0);
        for (const [i, [kind, sub]] of segments.entries()) {
          const e = grid(kind),
            rows = e.flatMap((t) => packet(kind, sub, t)),
            guarded = new Float64Array(rows.length + 2).fill(NaN),
            data = guarded.subarray(1, -1);
          data.set(rows);
          const pre = [
            196000 + i,
            0,
            "J2000",
            e[0]!,
            e.at(-1)!,
            "INTERP " + kind + "/" + sub,
            3,
          ] as const;
          if (kind === 18) raw.spkw18(h, sub, ...pre, data, e);
          else if (kind === 12) raw.spkw12(h, ...pre, data, e[0]!, 0.25);
          else raw[kind === 9 ? "spkw09" : "spkw13"](h, ...pre, data, e);
          data.fill(-999);
        }
        expect(() => kit.readVirtualOutput(out)).toThrow();
        raw.spkcls(h);
        const local = path.join(dir, "app.bsp"),
          ext = path.join(dir, "oracle.bsp");
        fs.writeFileSync(local, kit.readVirtualOutput(out));
        const produced = oracle("read", local);
        expect(oracle("write", ext)).toEqual(produced);
        raw.furnsh({
          path: "independent-spk.bsp",
          bytes: new Uint8Array(fs.readFileSync(ext)),
        });
        for (const [i, [kind, sub]] of segments.entries()) {
          const e = grid(kind),
            n = e.length,
            body = 196000 + i,
            obs = produced[i]!,
            record = raw.spksfs(body, 1);
          if (!record.found) throw Error("Missing independent segment " + i);
          const meta = raw.spkuds(record.descr);
          expect(record.ident).toBe("INTERP " + kind + "/" + sub);
          expect(obs.id).toBe(record.ident);
          expect(obs.metadata).toEqual([
            body,
            0,
            1,
            kind,
            e[0],
            e.at(-1),
            meta.baddr,
            meta.eaddr,
          ]);
          const tail =
            kind === 12
              ? [e[0], 0.25, 1, n]
              : [
                  ...e,
                  e[99],
                  ...(kind === 18
                    ? [sub, sub === 0 ? 2 : 4]
                    : [kind === 9 ? 3 : 1]),
                  n,
                ];
          expect(obs.words).toEqual([
            ...e.flatMap((t) => packet(kind, sub, t)),
            ...tail,
          ]);
          const et = [
            e[0]!,
            e[0]! + 0.046875,
            -1.6875,
            e[50]!,
            e[98]!,
            e[99]!,
            e.at(-1)! - 0.046875,
            e.at(-1)!,
          ];
          for (const [idx, t] of et.entries()) {
            const actual = raw.spkgeo(body, t, "J2000", 0).state,
              com = components(t);
            const expected = [
              ...com.position,
              ...(kind === 12 || kind === 13 ? com.rate : com.velocity),
            ];
            // The degree-three subtype-1 window has one packet on one side
            // and two on the other at these near-end epochs. Three nodes still
            // reproduce the authored quadratic exactly.
            for (let k = 0; k < 6; k++) {
              expect(actual[k]).toBeCloseTo(obs.states[idx]![k]!, 10);
              expect(actual[k]).toBeCloseTo(expected[k]!, 9);
            }
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
      " separates malformed storage from toolkit errors and keeps the writer usable",
    async () => {
      const setup = await spiceClients.toSync({ backend }),
        { raw } = setup.spice;
      try {
        const h = raw.spkopn(
            { kind: "virtual-output", path: "spk-retry.bsp" },
            "RETRY",
            0,
          ),
          pre = [195000, 0, "J2000", 0, 1, "TEST"] as const;
        const states = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13],
          e = [0, 1];
        for (const k of [9, 12, 13, 18] as const) {
          const write = (
            d: number,
            buf: readonly number[],
            ep: readonly number[] = e,
          ) =>
            k === 18
              ? raw.spkw18(h, 1, ...pre, d, buf, ep)
              : k === 12
                ? raw.spkw12(h, ...pre, d, buf, 0, 1)
                : raw[k === 9 ? "spkw09" : "spkw13"](h, ...pre, d, buf, ep);
          expect(() => write(1, [1])).toThrow(/Incomplete/);
          if (k !== 12)
            expect(() => write(1, states, [0])).toThrow(/Incomplete/);
          expect(() => write(1, [NaN, ...states.slice(1)])).toThrow(/finite/);
          expect(() => write(2147483647, states)).toThrow(
            k === 9 ? /INVALIDDEGREE/ : /window arithmetic/,
          );
          expect(() => write(0, states)).toThrow(/INVALIDDEGREE/);
          function once(values: readonly number[]) {
            const seen = new Set<PropertyKey>();
            return new Proxy(values, {
              get(v, key) {
                if (seen.has(key)) throw Error("read twice");
                seen.add(key);
                return Reflect.get(v, key);
              },
            });
          }
          write(1, once(states), once(e));
        }
        expect(() => raw.spkw18(h, 3, ...pre, 1, [], [])).toThrow(
          /INVALIDVALUE/,
        );
        raw.spkcls(h);
        expect(() => raw.spkw18(h, 1, ...pre, 1, states, e)).toThrow(/closed/);
      } finally {
        await setup.dispose();
      }
    },
  );
}
it("replays an authored file-writing workflow on one persistent worker backend", async () => {
  const setup = await spiceClients.toSync({ backend: "wasm" });
  try {
    for (const name of ["spkw09", "spkw12", "spkw13", "spkw18"]) {
      const c = allCases.find(
        (c) => c.caseId === "ephemeris-" + name + "-knots-and-off-grid",
      );
      if (!c) throw Error("Missing " + name);
      const a = runCaseInTspice(
          setup.spice,
          c,
          path.join(packageRoot, "fixtures"),
        ),
        b = runCaseInTspice(setup.spice, c, path.join(packageRoot, "fixtures"));
      expect(a.ok).toBe(true);
      expect(b).toEqual(a);
    }
  } finally {
    await setup.dispose();
  }
});
