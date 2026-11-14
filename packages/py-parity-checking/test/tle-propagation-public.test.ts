import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import fixture from "../fixtures/audit-tle.json" with { type: "json" };
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

function pair(rows: string[]): [string, string] {
  if (rows.length !== 2) throw new Error("Expected TLE pair");
  return [rows[0]!, rows[1]!];
}
const [j2, j3, j4, ke, qo, so, er, ae] = fixture.geophs;
const constants = [j2!, j3!, j4!, ke!, qo!, so!, er!, ae!] as const;
const lsk = new URL("../fixtures/kernels/naif0012.tls", import.meta.url);
const sidecar = fileURLToPath(new URL("../sidecars/spiceypy", import.meta.url));
const probe = `
import json,sys,spiceypy as sp
q=json.load(sys.stdin)
sp.furnsh(q["kernel"])
try:
    for name in ("survey","relay","mid","halfday"):
        lines=q["fixture"]["lines"][name]
        epoch, elements=sp.getelm(1957,70,lines)
        delta=43200000060 if name in ("survey","mid") else 86721
        elements[2]=0
        out=sp.evsgp4(epoch+delta,q["fixture"]["geophs"],elements)
        sp.check_for_spice_error(None)
        print(json.dumps(out.tolist(),allow_nan=False))
finally:
    sp.kclear()
`;
function closeWords(actual: number[], ref: number[], tolerance: number) {
  expect(actual.length).toEqual(ref.length);
  for (const [i, value] of ref.entries())
    expect(Math.abs(actual[i]! - value)).toBeLessThan(
      tolerance * Math.max(1, Math.abs(value)),
    );
}

it("verifies both fixed-width checksums on every synthetic civil record", () => {
  for (const rows of Object.values(fixture.lines))
    for (const line of rows) {
      expect(line.length).toBe(69);
      let sum = 0;
      for (const char of line.slice(0, 68)) {
        if (char === "-") sum++;
        else if (char >= "0" && char <= "9") sum += Number(char);
      }
      expect(Number(line[68])).toBe(sum % 10);
    }
});
for (const backend of ["node", "wasm"] as const) {
  const test = it.runIf(backend === "wasm" || nodeBackendAvailable);
  describe(backend, () => {
    test("composes parsed TLEs with actual states and preserves independent scientific outputs", async () => {
      const client = await spiceClients.toSync({ backend });
      const raw = client.spice.raw;
      try {
        raw.kclear();
        const rows = pair(fixture.lines.survey);
        expect(() => raw.getelm(1957, rows)).toThrow(/NOLEAPSECONDS/);
        raw.furnsh({ path: "kernels/naif0012.tls", bytes: readFileSync(lsk) });
        const { epoch, elems } = raw.getelm(1957, rows);
        expect(epoch).toBe(raw.str2et("2024-02-29T06:00:00"));
        expect(elems[9]).toBe(epoch);
        const scale = (2 * Math.PI) / 1440;
        expect(Math.abs((elems[0] * 1440) / scale - -0.00001234)).toBeLessThan(
          1e-18,
        );
        expect(
          Math.abs((elems[1] * 1440 ** 2) / scale - 2.3456e-7),
        ).toBeLessThan(1e-20);
        expect(elems[2]).toBeCloseTo(-0.0000125, 16);
        const a = raw.evsgp4(epoch, constants, elems),
          original = [...a];
        const b = raw.evsgp4(epoch + 10, constants, elems);
        const c = raw.evsgp4(epoch - 10, constants, elems);
        expect(a).not.toBe(b);
        expect(a).toEqual(original);
        for (let i = 0; i < 3; i++)
          expect(Math.abs((b[i]! - c[i]!) / 20 - a[i + 3]!)).toBeLessThan(
            0.003,
          );
        const q = raw.getelm(1957, pair(fixture.lines.relay));
        expect(q.elems).not.toBe(elems);
        expect(raw.evsgp4(epoch, constants, elems)).toEqual(original);
        raw.kclear();
        expect(() => raw.evsgp4(epoch, constants, elems)).toThrow(
          /NOLEAPSECONDS/,
        );
        expect(raw.failed()).toBe(false);
      } finally {
        try {
          raw.kclear();
        } finally {
          await client.dispose();
        }
      }
    });
    test("bounds resonance work while preserving actual nonresonant states beyond the threshold", async () => {
      const check = spawnSync(
        "uv",
        ["run", "--locked", "--project", sidecar, "python", "-c", probe],
        {
          input: JSON.stringify({ kernel: fileURLToPath(lsk), fixture }),
          encoding: "utf8",
        },
      );
      expect(check.status, check.stderr).toBe(0);
      const expected = check.stdout
        .trim()
        .split("\n")
        .map((s) => JSON.parse(s) as number[]);
      const client = await spiceClients.toSync({ backend }),
        raw = client.spice.raw;
      try {
        raw.kclear();
        raw.furnsh({ path: "kernels/naif0012.tls", bytes: readFileSync(lsk) });
        for (const [i, key] of (
          ["survey", "relay", "mid", "halfday"] as const
        ).entries()) {
          const { epoch, elems } = raw.getelm(1957, pair(fixture.lines[key]));
          const words = [...elems] as [
            number,
            number,
            number,
            number,
            number,
            number,
            number,
            number,
            number,
            number,
          ];
          words[2] = 0;
          const resonant = key === "relay" || key === "halfday";
          if (resonant)
            for (const sign of [-1, 1])
              expect(() =>
                raw.evsgp4(epoch + sign * 43200000000, constants, words),
              ).toThrow(/million integration steps/);
          const state = raw.evsgp4(
            epoch + (resonant ? 86721 : 43200000060),
            constants,
            words,
          );
          // A millennium-scale control is solely a work-bound regression. Independent
          // arithmetic may accumulate phase error; one part per million still resolves
          // each component, sign and orientation. Registered physical epochs use 1e-12.
          closeWords(state, expected[i]!, resonant ? 1e-12 : 1e-6);
        }
        const relay = raw.getelm(1957, pair(fixture.lines.relay));
        raw.kclear();
        expect(() =>
          raw.evsgp4(relay.epoch + 43200000000, constants, relay.elems),
        ).toThrow(/NOLEAPSECONDS/);
        raw.furnsh({ path: "kernels/naif0012.tls", bytes: readFileSync(lsk) });
        expect(raw.evsgp4(relay.epoch, constants, relay.elems)).toHaveLength(6);
        expect(raw.failed()).toBe(false);
      } finally {
        try {
          raw.kclear();
        } finally {
          await client.dispose();
        }
      }
    });
    test("owns read-once inputs and preserves error priority for extreme calendar operands", async () => {
      const client = await spiceClients.toSync({ backend }),
        raw = client.spice.raw;
      try {
        raw.kclear();
        raw.furnsh({ path: "kernels/naif0012.tls", bytes: readFileSync(lsk) });
        function readOnce<T extends readonly unknown[]>(v: T): T {
          const seen = new Set<string>();
          return new Proxy(v, {
            get(target, key, receiver) {
              if (
                typeof key === "string" &&
                (key === "length" || /^\d+$/.test(key))
              ) {
                if (seen.has(key)) throw new Error("Read caller input twice");
                seen.add(key);
              }
              return Reflect.get(target, key, receiver);
            },
          });
        }
        const rows = pair(fixture.lines.survey),
          { epoch, elems } = raw.getelm(1957, readOnce(rows));
        expect(
          raw.evsgp4(epoch, readOnce(constants), readOnce(elems)),
        ).toHaveLength(6);
        const dayOutside: [string, string] = [
          rows[0].slice(0, 20) + "  1.00000E40" + rows[0].slice(32),
          rows[1],
        ];
        expect(() => raw.getelm(1957, dayOutside)).toThrow(
          /calendar day range/,
        );
        expect(() => raw.getelm(2147483647, rows)).toThrow(
          /calendar day range/,
        );
        expect(() =>
          raw.getelm(2147483647, [rows[0], pair(fixture.lines.mid)[1]]),
        ).toThrow(/BADTLE/);
        expect(() =>
          raw.getelm(1957, [dayOutside[0], pair(fixture.lines.mid)[1]]),
        ).toThrow(/BADTLE/);
        expect(() => raw.getelm(1957, ["a\x00b", rows[1]])).toThrow(/ASCII/);
        const huge = [...elems] as [
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
        ];
        huge[9] = 1e26;
        expect(() => raw.evsgp4(0, constants, huge)).toThrow(
          /calendar day range/,
        );
        expect(raw.failed()).toBe(false);
        expect(raw.getelm(1957, rows).epoch).toBe(epoch);
      } finally {
        try {
          raw.kclear();
        } finally {
          await client.dispose();
        }
      }
    });
  });
}
