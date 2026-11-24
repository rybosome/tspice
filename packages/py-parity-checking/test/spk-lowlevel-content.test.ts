import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
const fixture = fileURLToPath(
  new URL("../fixtures/kernels/audit-ephemeris.bsp", import.meta.url),
);
const source = {
  path: "source.bsp",
  bytes: new Uint8Array(fs.readFileSync(fixture)),
};
const sidecar = fileURLToPath(
  new URL("../sidecars/spiceypy/", import.meta.url),
);
function oracle(mode: "write" | "read", file: string) {
  const args = [
    "run",
    "--locked",
    "--project",
    sidecar,
    "python",
    path.join(sidecar, "tests/spk_subset_files.py"),
    mode,
    ...(mode === "write" ? [fixture, file] : [file]),
  ];
  return JSON.parse(execFileSync("uv", args, { encoding: "utf8" })) as {
    ident: string;
    fields: number[];
    summaries: number[][];
    states: { ref: number; state: number[]; center: number }[];
  };
}
for (const backend of ["node", "wasm"] as const) {
  const test = it.runIf(backend === "wasm" || nodeBackendAvailable);
  test(
    backend +
      " preserves defined coefficient extrapolation and bounds address conversion before extreme epochs",
    async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-e03-coeff-")),
        filename = path.join(dir, "type2.bsp");
      const c = await spiceClients.toSync({ backend });
      try {
        const args = [
          "run",
          "--locked",
          "--project",
          sidecar,
          "python",
          path.join(sidecar, "tests/spk_subset_files.py"),
          "coefficient",
          filename,
        ];
        const observations = JSON.parse(
          execFileSync("uv", args, { encoding: "utf8" }),
        ) as { ref: number; state: number[]; center: number }[];
        const r = c.spice.raw;
        r.furnsh({
          path: "coeff.bsp",
          bytes: new Uint8Array(fs.readFileSync(filename)),
        });
        const s = r.spksfs(-100011, 0);
        if (!s.found) throw Error("missing coefficient source");
        for (const [i, t] of [-10, -3.125, 10, 12].entries()) {
          const actual = r.spkpvn(s.handle, s.descr, t),
            expected = observations[i]!;
          expect([actual.ref, actual.center]).toEqual([
            expected.ref,
            expected.center,
          ]);
          for (let j = 0; j < 6; j++)
            expect(actual.state[j]).toBeCloseTo(expected.state[j]!, 11);
        }
        expect(() => r.spkpvn(s.handle, s.descr, Number.MAX_VALUE)).toThrow(
          /addressable/,
        );
        expect(() => r.spkpvn(s.handle, s.descr, -10000)).toThrow(
          /addressable/,
        );
        expect(r.spkpvn(s.handle, s.descr, 0).center).toBe(-100010);
        expect(r.failed()).toBe(false);
      } finally {
        await c.dispose();
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  );
  test(
    backend +
      " preserves genuine positive and negative IEEE overflow in selected coefficient states",
    async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-e03-ieee-")),
        filename = path.join(dir, "ieee.bsp");
      const c = await spiceClients.toSync({ backend });
      try {
        const args = [
          "run",
          "--locked",
          "--project",
          sidecar,
          "python",
          path.join(sidecar, "tests/spk_subset_files.py"),
          "ieee",
          filename,
        ];
        const observations = JSON.parse(
          execFileSync("uv", args, { encoding: "utf8" }),
        ) as { ref: number; state: (string | number)[]; center: number }[];
        const r = c.spice.raw;
        r.furnsh({
          path: "ieee.bsp",
          bytes: new Uint8Array(fs.readFileSync(filename)),
        });
        const s = r.spksfs(-100011, 0);
        if (!s.found) throw Error("missing coefficient source");
        const out = r.spkpvn(s.handle, s.descr, 10);
        const state = out.state.map((x) =>
          Number.isFinite(x)
            ? x
            : Number.isNaN(x)
              ? "NaN"
              : x > 0
                ? "+Infinity"
                : "-Infinity",
        );
        expect({ ...out, state }).toEqual(observations[0]);
        expect(state.slice(0, 2)).toEqual(["+Infinity", "-Infinity"]);
        expect(r.failed()).toBe(false);
      } finally {
        await c.dispose();
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  );
  test(
    backend +
      " preserves bounded type-10 extrapolation and limits only excessive resonant integration",
    async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-e03-relay-")),
        filename = path.join(dir, "relay.bsp");
      const lsk = fileURLToPath(
        new URL("../fixtures/kernels/naif0012.tls", import.meta.url),
      );
      const c = await spiceClients.toSync({ backend });
      try {
        const args = [
          "run",
          "--locked",
          "--project",
          sidecar,
          "python",
          path.join(sidecar, "tests/spk_subset_files.py"),
          "type10",
          filename,
          lsk,
        ];
        const observations = JSON.parse(
          execFileSync("uv", args, { encoding: "utf8" }),
        ) as { ref: number; state: number[]; center: number }[];
        const r = c.spice.raw;
        r.furnsh({
          path: "relay.bsp",
          bytes: new Uint8Array(fs.readFileSync(filename)),
        });
        const s = r.spksfs(-100011, 0);
        if (!s.found) throw Error("missing type-10 source");
        expect(() => r.spkpvn(s.handle, s.descr, 43200000000)).toThrow(
          /NOLEAPSECONDS/,
        );
        r.furnsh({
          path: "time.tls",
          bytes: new Uint8Array(fs.readFileSync(lsk)),
        });
        expect(() => r.spkpvn(s.handle, s.descr, 43200000000)).toThrow(
          /resonant interval/,
        );
        for (const [i, t] of [-120, 0, 120].entries()) {
          const actual = r.spkpvn(s.handle, s.descr, t),
            expected = observations[i]!;
          expect([actual.ref, actual.center]).toEqual([
            expected.ref,
            expected.center,
          ]);
          for (let j = 0; j < 6; j++)
            expect(actual.state[j]).toBeCloseTo(expected.state[j]!, 8);
        }
        expect(r.failed()).toBe(false);
      } finally {
        await c.dispose();
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  );
  test(
    backend +
      " exchanges genuine subset files in both directions and compares ordered descriptors and every state component",
    async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-e03-"));
      const c = await spiceClients.toSync({ backend });
      const { raw: r, kit } = c.spice;
      try {
        const independent = path.join(dir, "independent.bsp"),
          expectation = oracle("write", independent);
        r.furnsh(source);
        const h = r.spklef(source.path),
          output = { kind: "virtual-output", path: "product.bsp" } as const;
        try {
          const seg = r.spksfs(-100011, 1);
          if (!seg.found) throw Error("missing original");
          const writer = r.spkopn(output, "TEST OUTPUT", 0);
          expect(() =>
            r.spksub(h, seg.descr, "REVERSED", 10, -5, writer),
          ).toThrow(/SPKNOTASUBSET/);
          expect(r.failed()).toBe(false);
          r.spksub(h, seg.descr, "SYNTHETIC SUBSET", -5, 10, writer);
          r.spkcls(writer);
        } finally {
          r.spkuef(h);
        }
        const product = path.join(dir, "product.bsp");
        fs.writeFileSync(product, kit.readVirtualOutput(output));
        const observed = oracle("read", product);
        expect(observed).toEqual(expectation);
        expect(observed.summaries).toEqual([observed.fields]);
        expect(observed.fields.slice(0, 6)).toEqual([
          -100011, -100010, 1, 8, -5, 10,
        ]);
        expect(observed.fields[6]).toBeGreaterThan(0);
        expect(observed.fields[7]).toBeGreaterThan(observed.fields[6]!);
        r.furnsh({
          path: "independent.bsp",
          bytes: new Uint8Array(fs.readFileSync(independent)),
        });
        const s = r.spksfs(-100011, 1);
        if (!s.found) throw Error("missing independent segment");
        expect(s.ident).toBe(expectation.ident);
        const { body, center, frame, type, first, last, baddr, eaddr } =
          r.spkuds(s.descr);
        expect([body, center, frame, type, first, last, baddr, eaddr]).toEqual(
          expectation.fields,
        );
        for (const [i, t] of [-5, 0.125, 10].entries()) {
          const actual = r.spkpvn(s.handle, s.descr, t),
            expected = expectation.states[i]!;
          expect([actual.ref, actual.center]).toEqual([
            expected.ref,
            expected.center,
          ]);
          for (let j = 0; j < 6; j++)
            expect(actual.state[j]).toBeCloseTo(expected.state[j]!, 9);
        }
      } finally {
        await c.dispose();
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  );
  test(
    backend +
      " keeps DAF selection unchanged and rejects unrelated, fabricated, wrong-sized or expired descriptors",
    async () => {
      const c = await spiceClients.toSync({ backend });
      const r = c.spice.raw;
      try {
        r.furnsh(source);
        const h = r.spklef(source.path),
          same = r.spklef(source.path);
        expect(h).toBe(same);
        const d = r.dafopr(source.path),
          other = {
            path: "other.bsp",
            bytes: new Uint8Array(
              fs.readFileSync(
                new URL(
                  "../fixtures/kernels/audit-ephemeris-priority.bsp",
                  import.meta.url,
                ),
              ),
            ),
          };
        r.furnsh(other);
        const alternate = r.spklef(other.path);
        try {
          r.dafbfs(d);
          expect(r.daffna(d)).toBe(true);
          const words = r.dafgs(d),
            name = r.dafgn(d);
          const hold = r.spkpvn(d, words, -500);
          expect(hold.state).toHaveLength(6);
          expect(r.dafgh()).toBe(d);
          expect(r.dafgn(d)).toBe(name);
          expect(() => r.spkpvn(alternate, words, -500)).toThrow(
            /does not belong/,
          );
          const selected = r.spksfs(100001, -500);
          if (!selected.found) throw Error("missing source for tuple snapshot");
          const reads = new Map<string, number>();
          const tuple = new Proxy(selected.descr, {
            get(target, key, receiver) {
              if (typeof key === "string" && /^[0-4]$/.test(key)) {
                const count = (reads.get(key) ?? 0) + 1;
                reads.set(key, count);
                if (count > 1) throw Error("descriptor word was reread");
              }
              return Reflect.get(target, key, receiver);
            },
          });
          expect(r.spkpvn(selected.handle, tuple, -500)).toEqual(
            r.spkpvn(selected.handle, selected.descr, -500),
          );
          expect([...reads.values()]).toEqual([1, 1, 1, 1, 1]);
          const changed = new Uint8Array(words);
          changed[0] = changed[0]! ^ 1;
          expect(() => r.spkpvn(d, changed, -500)).toThrow(/does not belong/);
          expect(() => r.spkpvn(d, new Uint8Array(39), -500)).toThrow(/40/);
          expect(() => r.spkpvn(d, words, Number.MAX_VALUE)).toThrow(
            /TIMEOUTOFBOUNDS/,
          );
          expect(() => r.spkpvn(d, words, NaN)).toThrow(/finite/);
          const fabricated = r.spkpds(100001, 0, "J2000", 8, -1000, 0);
          expect(() => r.spkpvn(d, fabricated, -500)).toThrow(
            /does not belong/,
          );
          expect(r.spkpvn(h, words, -500)).toEqual(hold);
          expect(r.failed()).toBe(false);
          r.spkuef(h);
          expect(() => r.spkpvn(h, words, -500)).toThrow(/invalid|closed/);
          expect(r.spkpvn(d, words, -500)).toEqual(hold);
        } finally {
          r.spkuef(alternate);
          r.dafcls(d);
        }
      } finally {
        await c.dispose();
      }
    },
  );
  test(
    backend +
      " invalidates a borrowed generation when KEEPER unloads a file even if an independent DAF link keeps the physical handle",
    async () => {
      const c = await spiceClients.toSync({ backend });
      const r = c.spice.raw;
      try {
        r.furnsh(source);
        const d = r.dafopr(source.path),
          old = r.spklef(source.path);
        try {
          const s = r.spksfs(-100011, 2);
          if (!s.found) throw Error("missing original");
          r.unload(source.path);
          expect(() => r.spkpvn(s.handle, s.descr, 2)).toThrow(
            /no longer active/,
          );
          expect(() => r.spkpvn(old, s.descr, 2)).toThrow(/no longer active/);
          r.furnsh(source);
          const fresh = r.spklef(source.path);
          expect(old).not.toBe(fresh);
          r.spkuef(old);
          const next = r.spksfs(-100011, 2);
          if (!next.found) throw Error("replacement load was lost");
          expect(r.spkpvn(fresh, next.descr, 2).center).toBe(-100010);
          r.spkuef(fresh);
        } finally {
          r.dafcls(d);
        }
      } finally {
        await c.dispose();
      }
    },
  );
}
it.runIf(nodeBackendAvailable)(
  "native client disposal releases direct-only SPK loads across shared clients",
  async () => {
    const a = await spiceClients.toSync({ backend: "node" }),
      b = await spiceClients.toSync({ backend: "node" });
    try {
      const token = a.spice.raw.spklef(fixture),
        s = b.spice.raw.spksfs(-100011, 5);
      if (!s.found) throw Error("missing foreign-loaded file");
      expect(() => b.spice.raw.spkuef(token)).toThrow(/invalid|closed/);
      expect(b.spice.raw.spkpvn(s.handle, s.descr, 5).center).toBe(-100010);
      await a.dispose();
      expect(() => b.spice.raw.spkpvn(s.handle, s.descr, 5)).toThrow(
        /no longer active/,
      );
      expect(() => b.spice.raw.spksfs(-100011, 5)).toThrow(/NOLOADEDFILES/);
    } finally {
      await a.dispose();
      await b.dispose();
    }
  },
);
