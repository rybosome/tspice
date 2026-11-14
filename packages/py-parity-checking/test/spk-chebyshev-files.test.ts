import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { allCases } from "../src/cases/index.js";
import { runCaseInTspice } from "../src/run-tspice/index.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const epochs = [0, 11111, 21600, 43200, 64531, 64800, 86400];
const kinds = [2, 3, 20] as const;
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
      "test/_helpers/spk_chebyshev_oracle.py",
      mode,
      file,
    ],
    { cwd: packageRoot, encoding: "utf8" },
  );
  return JSON.parse(stdout) as {
    id: string;
    metadata: number[];
    words: number[];
    states: number[][];
  }[];
}

function coefficients(kind: 2 | 3 | 20, j: number): number[] {
  const position = [100 + j, 2, 3, -200 - j, -4, 5, 33 + j, 6, -7];
  if (kind === 2) return position;
  if (kind === 3)
    return [...position, 7 + j, -2, 1, 8 + j, 4, -3, 9 + j, -6, 2];
  return [1 + j, 2, 10 + j, -2 - j, 3, 20 + j, 3 + j, -4, 30 + j];
}

// Independent analytic checks distinguish differentiation, independent velocities,
// and the velocity integral around a midpoint with separate distance/time scales.
function expectedState(kind: 2 | 3 | 20, et: number): number[] {
  const j = et < 43200 ? 0 : 1,
    radius = 21600,
    x = (et - (43200 * j + radius)) / radius;
  const record = coefficients(kind, j);
  if (kind === 20) {
    const pos = [],
      vel = [];
    for (let k = 0; k < 9; k += 3) {
      const a = record[k]!,
        b = record[k + 1]!,
        mid = record[k + 2]!;
      vel.push(0.5 * (a + b * x));
      pos.push(2 * mid + 0.5 * radius * (a * x + (b * x * x) / 2));
    }
    return [...pos, ...vel];
  }
  const value = (i: number) =>
    record[i]! + x * record[i + 1]! + (2 * x * x - 1) * record[i + 2]!;
  const slope = (i: number) =>
    (record[i + 1]! + 4 * x * record[i + 2]!) / radius;
  return [
    value(0),
    value(3),
    value(6),
    ...(kind === 2
      ? [slope(0), slope(3), slope(6)]
      : [value(9), value(12), value(15)]),
  ];
}

for (const backend of ["node", "wasm"] as const) {
  const run = it.runIf(backend === "wasm" || nodeBackendAvailable);
  run(
    backend +
      " writes files independently read by the locked toolkit and reads independently written SPKs",
    async () => {
      const setup = await spiceClients.toSync({ backend }),
        { raw, kit } = setup.spice;
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-e04-"));
      try {
        const output = {
          kind: "virtual-output",
          path: "e04-produced.bsp",
        } as const;
        const h = raw.spkopn(output, "E04 BACKEND", 0);
        for (const kind of kinds) {
          const data = [...coefficients(kind, 0), ...coefficients(kind, 1)];
          const backing = new Float64Array(data.length + 4).fill(NaN),
            view = backing.subarray(2, -2);
          view.set(data);
          const fixed = [
            h,
            195000 + kind,
            0,
            "J2000",
            0,
            86400,
            "E04 TYPE " + kind,
          ] as const;
          if (kind === 20)
            raw.spkw20(...fixed, 0.5, 2, 1, view, 2, 4, 2451545, 0);
          else
            raw[kind === 2 ? "spkw02" : "spkw03"](
              ...fixed,
              43200,
              2,
              2,
              view,
              0,
            );
          view.fill(-123);
        }
        expect(() => kit.readVirtualOutput(output)).toThrow();
        raw.spkcls(h);
        const ours = path.join(tmp, "ours.bsp"),
          theirs = path.join(tmp, "theirs.bsp");
        fs.writeFileSync(ours, kit.readVirtualOutput(output));
        const readOurs = oracle("read", ours),
          readTheirs = oracle("write", theirs);
        expect(readOurs).toEqual(readTheirs);
        raw.furnsh({
          path: "e04-external.bsp",
          bytes: new Uint8Array(fs.readFileSync(theirs)),
        });
        for (const [idx, kind] of kinds.entries()) {
          const body = 195000 + kind,
            obs = readOurs[idx]!;
          const desc = raw.spksfs(body, 11111);
          if (!desc.found) throw Error("Independent segment missing");
          expect(desc.ident).toBe("E04 TYPE " + kind);
          expect(obs.id).toBe(desc.ident);
          const md = raw.spkuds(desc.descr);
          expect(obs.metadata).toEqual([
            body,
            0,
            1,
            kind,
            0,
            86400,
            md.baddr,
            md.eaddr,
          ]);
          const d0 = coefficients(kind, 0),
            d1 = coefficients(kind, 1);
          expect(obs.words).toEqual(
            kind === 20
              ? [...d0, ...d1, 2, 4, 2451545, 0, 0.5, 9, 2]
              : [
                  21600,
                  21600,
                  ...d0,
                  64800,
                  21600,
                  ...d1,
                  0,
                  43200,
                  d0.length + 2,
                  2,
                ],
          );
          for (const [k, et] of epochs.entries()) {
            const fromTheirs = raw.spkgeo(body, et, "J2000", 0).state;
            const expected = expectedState(kind, et);
            for (let i = 0; i < 6; i++) {
              expect(fromTheirs[i]!).toBeCloseTo(obs.states[k]![i]!, 9);
              expect(fromTheirs[i]!).toBeCloseTo(expected[i]!, 9);
            }
          }
        }
      } finally {
        raw.kclear();
        await setup.dispose();
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    },
  );
  run(
    backend +
      " recovers the same writer after every layout, validation, and toolkit error",
    async () => {
      const setup = await spiceClients.toSync({ backend }),
        { raw, kit } = setup.spice;
      try {
        const output = {
            kind: "virtual-output",
            path: "recover-e04.bsp",
          } as const,
          h = raw.spkopn(output, "RECOVER", 0);
        const args = [h, 195999, 0, "J2000", 0, 1, "VALID"] as const;
        for (const k of kinds) {
          const name = k === 2 ? "spkw02" : k === 3 ? "spkw03" : "spkw20";
          const run = (data: readonly number[], n = 1, degree = 0) =>
            k === 20
              ? raw.spkw20(...args, 1, n, degree, data, 1, 1, 2451545, 0)
              : raw[k === 2 ? "spkw02" : "spkw03"](
                  ...args,
                  1,
                  n,
                  degree,
                  data,
                  0,
                );
          expect(() => run([], 0)).toThrow(
            k === 20 ? /INVALIDCOUNT/ : /NUMCOEFFSNOTPOS/,
          );
          expect(() => run([], 1, -1)).toThrow(/INVALIDDEGREE/);
          expect(() => run([0], 1)).toThrow(/coefficient length/);
          const length = k === 2 ? 3 : 6,
            values = Array.from({ length }, (_, i) => i + 1);
          expect(() => run([...values.slice(1), Infinity])).toThrow(/finite/);
          const reads = new Set<PropertyKey>();
          const observed = new Proxy(values, {
            get(target, key) {
              if (
                key === "length" ||
                (typeof key === "string" && /^\d+$/.test(key))
              ) {
                if (reads.has(key)) throw Error(name + " input read twice");
                reads.add(key);
              }
              return Reflect.get(target, key);
            },
          });
          run(observed);
          expect(reads.size).toBe(length + 1);
        }
        raw.spkcls(h);
        expect(kit.readVirtualOutput(output).length).toBeGreaterThan(1024);
        expect(() => raw.spkw02(...args, 1, 1, 0, [1, 2, 3], 0)).toThrow(
          /closed/,
        );
      } finally {
        await setup.dispose();
      }
    },
  );
}

it("a reusable WASM client can repeat the same authored physical SPK workflow", async () => {
  const setup = await spiceClients.toSync({ backend: "wasm" });
  try {
    for (const name of ["spkw02", "spkw03", "spkw20"]) {
      const c = allCases.find(
        (v) => v.caseId === "ephemeris-" + name + "-two-record-boundaries",
      );
      if (!c) throw Error("Missing case " + name);
      const fixtures = path.join(packageRoot, "fixtures");
      const a = runCaseInTspice(setup.spice, c, fixtures),
        b = runCaseInTspice(setup.spice, c, fixtures);
      expect(a.ok).toBe(true);
      expect(b).toEqual(a);
    }
  } finally {
    await setup.dispose();
  }
});
