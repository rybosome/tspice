import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { allCases } from "../src/cases/index.js";
import { runCaseInTspice } from "../src/run-tspice/index.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const pkg = path.resolve(import.meta.dirname, "..");
const row1 = [2, 2, 1, 2, 4, -1, 9, 0.25, -3, 0.5, 8, 1, 2, -2],
  row2 = [8, 4, 11, 3, -2, 2, 1, 5, 3, 1, -4, 0.5, 6, 2];
const times = [0, 2, 3.5, 4, 8, 12];
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
        "test/_helpers/spk_streaming_oracle.py",
        mode,
        file,
      ],
      { cwd: pkg, encoding: "utf8" },
    ),
  ) as { ident: string; meta: number[]; words: number[]; states: number[][] }[];
}
function once(values: readonly number[]) {
  const seen = new Set<PropertyKey>();
  return new Proxy(values, {
    get(v, k) {
      if (seen.has(k)) throw Error("Caller entry read twice");
      seen.add(k);
      return Reflect.get(v, k);
    },
  });
}
for (const backend of ["node", "wasm"] as const) {
  const run = it.runIf(backend === "wasm" || nodeBackendAvailable);
  run(
    backend + " preserves repeated streaming calls on a cached transport",
    async () => {
      const setup = await spiceClients.caching({}).toSync({ backend });
      const { raw } = setup.spice;
      const dest = {
        kind: "virtual-output" as const,
        path: "cached/stream.bsp",
      };
      const handle = raw.spkopn(dest, "STREAM", 0);
      try {
        const begin = () =>
          raw.spk14b(handle, "STREAM", 196014, 0, "J2000", 0, 12, 1);
        const add = () => raw.spk14a(handle, 1, row1, [0]);
        begin();
        expect(begin).toThrow();
        add();
        expect(add).toThrow(/UNORDEREDREFS/);
        raw.spk14e(handle);
        expect(() => raw.spk14e(handle)).toThrow();
        begin();
        add();
        raw.spk14e(handle);
        raw.spkcls(handle);
        raw.furnsh({
          path: "cached-read.bsp",
          bytes: setup.spice.kit.readVirtualOutput(dest),
        });
        expect(raw.spkezr("196014", 2, "J2000", "NONE", "0").state).toEqual([
          1, 4, 9, -3, 8, 2,
        ]);
      } finally {
        await setup.dispose();
      }
    },
  );
  run(
    backend +
      " exchanges complete physical type 14 records with an independent bulk writer",
    async () => {
      const setup = await spiceClients.toSync({ backend }),
        { raw, kit } = setup.spice,
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-stream-"));
      try {
        const out = { kind: "virtual-output", path: "stream.bsp" } as const,
          h = raw.spkopn(out, "WRITER", 0);
        raw.spk14b(h, "INDEPENDENT", 196014, 0, "J2000", 0, 12, 1);
        raw.spk14a(h, 1, once(row1), once([0]));
        const backing = new Float64Array([NaN, ...row2, Infinity]);
        raw.spk14a(h, 1, backing.subarray(1, -1), [4]);
        backing.fill(-444);
        raw.spk14e(h);
        raw.spk14b(h, "EMPTY", 196015, 0, "J2000", 0, 12, 1);
        raw.spk14e(h);
        expect(() => kit.readVirtualOutput(out)).toThrow();
        raw.spkcls(h);
        const app = path.join(dir, "app.bsp"),
          ref = path.join(dir, "independent.bsp");
        fs.writeFileSync(app, kit.readVirtualOutput(out));
        const ours = oracle("read", app),
          ind = oracle("write", ref);
        expect(ours).toEqual(ind);
        const full = ours[0]!,
          empty = ours[1]!;
        expect(full.words).toEqual([
          2,
          0,
          ...row1,
          4,
          ...row2,
          0,
          4,
          0,
          1,
          33,
          0,
          3,
          31,
          2,
          0,
          0,
          0,
          1,
          2,
          0,
          0,
          14,
          1,
          17,
        ]);
        expect(empty.words).toEqual([
          2, 0, 1, 1, 0, 3, 1, 0, 0, 0, 0, 1, 0, 0, 0, 14, 1, 17,
        ]);
        raw.furnsh({
          path: "independent-stream.bsp",
          bytes: new Uint8Array(fs.readFileSync(ref)),
        });
        for (const [i, body] of [196014, 196015].entries()) {
          const match = raw.spksfs(body, 1);
          if (!match.found) throw Error("Missing independent stream");
          const d = raw.spkuds(match.descr);
          expect(match.ident).toBe(ours[i]!.ident);
          expect([
            d.body,
            d.center,
            d.frame,
            d.type,
            d.first,
            d.last,
            d.baddr,
            d.eaddr,
          ]).toEqual(ours[i]!.meta);
        }
        for (const [j, et] of times.entries()) {
          const row = et < 4 ? row1 : row2,
            u = (et - row[0]!) / row[1]!,
            manual = Array.from(
              { length: 6 },
              (_, i) => row[2 + 2 * i]! + u * row[3 + 2 * i]!,
            );
          expect(raw.spkgeo(196014, et, "J2000", 0).state).toEqual(manual);
          expect(full.states[j]).toEqual(manual);
        }
      } finally {
        raw.kclear();
        await setup.dispose();
        fs.rmSync(dir, { force: true, recursive: true });
      }
    },
  );
  run(
    backend +
      " interleaves two active files and a complete batch writer without corrupting packets, touches and ended handles",
    async () => {
      const setup = await spiceClients.toSync({ backend }),
        { raw, kit } = setup.spice;
      try {
        const files = ["a.bsp", "b.bsp", "c.bsp"].map((path) => ({
          kind: "virtual-output" as const,
          path,
        }));
        const ha = raw.spkopn(files[0]!, "FIRST", 0),
          hb = raw.spkopn(files[1]!, "SECOND", 0),
          hc = raw.spkopn(files[2]!, "OTHER", 0);
        raw.spk14b(ha, "FIRST", 101, 0, "J2000", 0, 12, 1);
        raw.spk14a(ha, 1, row1, [0]);
        raw.spk14b(hb, "SECOND", 102, 0, "J2000", 0, 12, 0);
        raw.spk14a(hb, 1, [6, 6, 77, 66, 55, 44, 33, 22], [0]);
        expect(() =>
          raw.spk14b(ha, "DUP", 101, 0, "J2000", 0, 12, 1),
        ).toThrow();
        expect(() =>
          raw.spk14b(hc, "A".repeat(41), 109, 0, "J2000", 0, 12, 1),
        ).toThrow();
        expect(() => raw.spk14a(hc, 1, row1, [0])).toThrow(/active/);
        expect(() => raw.spkcls(ha)).toThrow(/spk14e/);
        expect(() =>
          raw.spkw02(
            ha,
            103,
            0,
            "J2000",
            0,
            12,
            "OTHER",
            12,
            1,
            0,
            [1, 2, 3],
            0,
          ),
        ).toThrow(/spk14e/);
        raw.spkw02(hc, 103, 0, "J2000", 0, 12, "OTHER", 12, 1, 0, [1, 2, 3], 0);
        raw.spkcls(hc);
        raw.spk14a(ha, 1, row2, [4]);
        raw.spk14e(ha);
        expect(() => raw.spk14e(ha)).toThrow(/active/);
        raw.spkcls(ha);
        raw.spk14e(hb);
        raw.spkcls(hb);
        for (const f of files)
          raw.furnsh({
            path: "loaded-" + f.path,
            bytes: kit.readVirtualOutput(f),
          });
        expect(raw.spkgeo(101, 8, "J2000", 0).state).toEqual([
          11, -2, 1, 3, -4, 6,
        ]);
        expect(raw.spkgeo(102, 8, "J2000", 0).state).toEqual([
          77, 66, 55, 44, 33, 22,
        ]);
        expect(raw.spkgeo(103, 8, "J2000", 0).state).toEqual([
          1, 2, 3, 0, 0, 0,
        ]);
      } finally {
        raw.kclear();
        await setup.dispose();
      }
    },
  );
  run(
    backend +
      " preserves the active type 14 writer across rejected and completed type 10 writes",
    async () => {
      const setup = await spiceClients.toSync({ backend }),
        { raw, kit } = setup.spice;
      const c = [
          0.001082616, -2.53881e-6, -1.65597e-6, 0.0743669161, 120, 78,
          6378.135, 1,
        ],
        tle = [0, 0, 1e-5, 0.5, 0.2, 0.03, 0.4, 0.7, 0.06, 0];
      const files = ["type14.bsp", "type10.bsp"].map((path) => ({
        kind: "virtual-output" as const,
        path,
      }));
      try {
        const h14 = raw.spkopn(files[0]!, "STREAM", 0),
          h10 = raw.spkopn(files[1]!, "ANALYTIC", 0);
        const ten = (
          h: typeof h10,
          segid: string,
          frame = "J2000",
          elems = tle,
          epochs = [0],
        ) =>
          raw.spkw10(h, 196010, 0, frame, -300, 300, segid, c, elems, epochs);
        raw.spk14b(h14, "INTERLEAVED", 196014, 0, "J2000", 0, 12, 1);
        raw.spk14a(h14, 1, row1, [0]);
        expect(() => ten(h14, "TEN")).toThrow(/spk14e/);
        expect(() => ten(h10, "X".repeat(41))).toThrow(/generic segment ID/);
        expect(() => ten(h10, "TEN", "UNKNOWN FRAME")).toThrow(
          /INVALIDREFFRAME/,
        );
        expect(() =>
          ten(h10, "TEN", "J2000", [...tle, ...tle], [0, 0]),
        ).toThrow(/increase/);
        ten(h10, "TEN");
        raw.spkcls(h10);
        expect(() => raw.spk14a(h14, 1, row2, [0])).toThrow(/UNORDEREDREFS/);
        raw.spk14a(h14, 1, row2, [4]);
        raw.spk14e(h14);
        raw.spkcls(h14);
        raw.furnsh({
          path: "naif0012.tls",
          bytes: new Uint8Array(
            fs.readFileSync(path.join(pkg, "fixtures/kernels/naif0012.tls")),
          ),
        });
        for (const f of files)
          raw.furnsh({
            path: "loaded-" + f.path,
            bytes: kit.readVirtualOutput(f),
          });
        expect(raw.spkgeo(196014, 4, "J2000", 0).state).toEqual([
          8, -4, -4, 2, -4.5, 4,
        ]);
        const expected = [
          1799.8567270935998, 6215.242818000498, 3130.726122117202,
          -7.220329622418188, 1.4694546212623811, 1.5711550320662049,
        ];
        const measured = raw.spkgeo(196010, 1, "J2000", 0).state;
        for (const [i, x] of expected.entries())
          expect(measured[i]).toBeCloseTo(x, 8);
      } finally {
        raw.kclear();
        await setup.dispose();
      }
    },
  );
  run(
    backend +
      " keeps the stream open after rejected count, batch ordering, shape and nonfinite packet",
    async () => {
      const setup = await spiceClients.toSync({ backend }),
        { raw } = setup.spice;
      try {
        const out = { kind: "virtual-output", path: "retry.bsp" } as const,
          h = raw.spkopn(out, "RETRY", 0);
        expect(() =>
          raw.spk14b(h, "BAD", 101, 0, "J2000", 0, 12, 357913940),
        ).toThrow(/width/);
        raw.spk14b(h, "GOOD", 101, 0, "J2000", 0, 12, 1);
        raw.spk14a(h, 1, row1, [0]);
        expect(() => raw.spk14a(h, 0, [], [])).toThrow(/INVALIDARGUMENT/);
        expect(() => raw.spk14a(h, 1, row2, [0])).toThrow(/UNORDEREDREFS/);
        expect(() => raw.spk14a(h, 2, [...row2, ...row1], [4, 3])).toThrow(
          /UNORDEREDREFS/,
        );
        expect(() => raw.spk14a(h, 1, row2.slice(1), [4])).toThrow(
          /Incomplete/,
        );
        expect(() =>
          raw.spk14a(h, 1, [Infinity, ...row2.slice(1)], [4]),
        ).toThrow(/finite/);
        raw.spk14a(h, 1, row2, [4]);
        raw.spk14e(h);
        raw.spkcls(h);
        expect(() => raw.spk14e(h)).toThrow(/closed/);
      } finally {
        await setup.dispose();
      }
    },
  );
}
it("repeats terminal and successful streaming parity cases on one WASM client", async () => {
  const setup = await spiceClients.toSync({ backend: "wasm" });
  try {
    for (const name of [
      "spk14b-duplicate-begin",
      "spk14a-duplicate-in-batch",
      "spk14e-no-begin",
      "spk14a-two-batches",
    ]) {
      const c = allCases.find((c) => c.caseId === "ephemeris-" + name);
      if (!c) throw Error("Missing workflow " + name);
      const a = runCaseInTspice(setup.spice, c, path.join(pkg, "fixtures")),
        b = runCaseInTspice(setup.spice, c, path.join(pkg, "fixtures"));
      expect(a.ok).toBe(c.expectation.kind === "success");
      expect(b.ok).toBe(a.ok);
      if (a.ok || b.ok) {
        expect(b).toEqual(a);
      } else {
        // Each replay owns a fresh scratch directory. CSPICE embeds that path in its long message.
        const stable = (message: string) =>
          message.replace(
            /py-parity-ephemeris-spk14[a-z]-[a-z-]+-[a-zA-Z0-9]{6}\//g,
            "RUN/",
          );
        expect(stable(b.error.message)).toBe(stable(a.error.message));
        expect(b.outputs).toEqual(a.outputs);
        if (c.expectation.kind === "error")
          for (const text of c.expectation.errorMessageIncludes ?? [])
            expect(b.error.message).toContain(text);
      }
    }
  } finally {
    await setup.dispose();
  }
});
