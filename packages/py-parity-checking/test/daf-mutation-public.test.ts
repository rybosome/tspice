import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const project = path.resolve(import.meta.dirname, "../sidecars/spiceypy");
const fixture = fs.readFileSync(
  path.resolve(
    import.meta.dirname,
    "../fixtures/kernels/audit-two-segment.bsp",
  ),
);
const readWithSpiceyPy = `
import json, sys
import spiceypy as sp
h = sp.dafopr(sys.argv[1])
try:
    n, lines, done = sp.dafec(h, 9, 2200)
    sp.dafbfs(h)
    assert sp.daffna()
    dc, ic = sp.dafus(sp.dafgs(), 2, 6)
    print(json.dumps([n,list(lines[:n]),bool(done),dc.tolist(),ic.tolist(),
        sp.dafgda(h,int(ic[-2]),int(ic[-1])).tolist(),sp.dafgn()]))
finally:
    sp.dafcls(h)
`;
for (const backend of ["node", "wasm"] as const) {
  const test = it.runIf(backend === "wasm" || nodeBackendAvailable);
  test(
    backend +
      " independently reads every mutated comment, summary and untouched data word from the closed file",
    async () => {
      const dir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tspice-daf-mutation-"),
      );
      const physical = path.join(dir, "written.bsp");
      const out = {
        kind: "virtual-output",
        path: "mutate-writer.bsp",
      } as const;
      try {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        const raw = spice.raw;
        try {
          const h = raw.spkopn(
            backend === "node" ? physical : out,
            "C03 MUTATION",
            0,
          );
          const states = [1, 2, 3, 4, 5, 6, -8, -7, -6, -5, -4, -3];
          try {
            raw.spkw08(
              h,
              -777,
              -33,
              "J2000",
              -1,
              1,
              "PRESERVED NAME",
              1,
              states,
              -1,
              2,
            );
          } finally {
            raw.spkcls(h);
          }
          const writer = raw.dafopw(backend === "node" ? physical : out.path);
          const lines = [
            "  first",
            "",
            "word  between",
            "q".repeat(1131),
            "last",
          ];
          let addresses: number[];
          try {
            raw.dafac(writer, ["discard", "this"]);
            raw.dafdc(writer);
            raw.dafac(writer, [...lines, "ends with spaces   "]);
            raw.dafbfs(writer);
            expect(raw.daffna(writer)).toBe(true);
            addresses = raw.dafus(raw.dafgs(writer), 2, 6).ic.slice(-2);
            const bytes = raw.dafps(
              2,
              6,
              [-0.5, 0.75],
              [-888, -44, 1, 8, -123, 999],
            );
            const unaligned = new Uint8Array(41);
            unaligned.set(bytes, 1);
            raw.dafrs(writer, unaligned.subarray(1));
            unaligned.fill(0);
          } finally {
            raw.dafcls(writer);
          }
          if (backend === "wasm")
            fs.writeFileSync(physical, spice.kit.readVirtualOutput(out));
          const result: unknown = JSON.parse(
            execFileSync(
              "uv",
              [
                "run",
                "--locked",
                "--project",
                project,
                "python",
                "-c",
                readWithSpiceyPy,
                physical,
              ],
              { encoding: "utf8", timeout: 15000 },
            ),
          );
          expect(result).toEqual([
            6,
            [...lines, "ends with spaces"],
            true,
            [-0.5, 0.75],
            [-888, -44, 1, 8, ...addresses],
            [...states, -1, 2, 1, 2],
            "PRESERVED NAME",
          ]);
        } finally {
          await dispose();
        }
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  );
  test(
    backend +
      " preserves active cursors and owned pages across errors, alias closes and two interleaved files",
    async () => {
      const { spice, dispose } = await spiceClients.toSync({ backend }),
        raw = spice.raw;
      try {
        for (const p of ["one", "two"]) {
          raw.furnsh({ path: p + ".bsp", bytes: fixture });
          raw.unload(p + ".bsp");
          const h = raw.dafopw(p + ".bsp");
          try {
            raw.dafac(h, [p, "X".repeat(1401), "tail"]);
            expect(raw.dafec(h, 1, 4)).toEqual({
              n: 1,
              lines: [p],
              done: false,
            });
            expect(() => raw.dafac(h, ["blocked"])).toThrow(
              /active DAF comment extraction/,
            );
            expect(() => raw.dafdc(h)).toThrow(/active DAF comment extraction/);
          } finally {
            raw.dafcls(h);
          }
        }
        const a = raw.dafopr("one.bsp"),
          alias = raw.dafopr("one.bsp"),
          b = raw.dafopr("two.bsp");
        let open = true;
        try {
          const first = raw.dafec(a, 1, 4);
          expect(first).toEqual({ n: 1, lines: ["one"], done: false });
          expect(() => raw.dafdc(a)).toThrow(/DAFINVALIDACCESS/);
          expect(() => raw.dafac(a, ["valid"])).toThrow(/DAFINVALIDACCESS/);
          expect(raw.dafec(b, 1, 4).lines).toEqual(["two"]);
          expect(() => raw.dafec(alias, 2, 1301)).toThrow(/COMMENTTOOLONG/);
          expect(raw.failed()).toBe(false);
          raw.dafcls(a);
          open = false;
          expect(raw.dafec(alias, 1, 1402)).toEqual({
            n: 1,
            lines: ["X".repeat(1401)],
            done: false,
          });
          expect(raw.dafec(b, 2, 1402)).toEqual({
            n: 2,
            lines: ["X".repeat(1401), "tail"],
            done: true,
          });
          expect(raw.dafec(alias, 2, 5)).toEqual({
            n: 1,
            lines: ["tail"],
            done: true,
          });
          expect(raw.dafec(alias, 1, 4)).toEqual(first);
          first.lines[0] = "consumer mutation";
          expect(raw.dafec(b, 1, 4).lines).toEqual(["two"]);
        } finally {
          try {
            if (open) raw.dafcls(a);
          } finally {
            try {
              raw.dafcls(alias);
            } finally {
              raw.dafcls(b);
            }
          }
        }
        const h = raw.dafopr("one.bsp");
        try {
          expect(raw.dafec(h, 1, 4).lines).toEqual(["one"]);
        } finally {
          raw.dafcls(h);
        }
      } finally {
        try {
          raw.kclear();
        } finally {
          await dispose();
        }
      }
    },
  );
  test(
    backend +
      " releases repeated abandoned extracts on close for more than the pinned 5000-entry file table",
    async () => {
      const { spice, dispose } = await spiceClients.toSync({ backend }),
        raw = spice.raw;
      try {
        const name = "repeat.bsp";
        raw.furnsh({ path: name, bytes: fixture });
        raw.unload(name);
        const w = raw.dafopw(name);
        try {
          raw.dafac(w, ["first", "second"]);
        } finally {
          raw.dafcls(w);
        }
        for (let i = 0; i < 5001; i++) {
          const h = raw.dafopr(name);
          try {
            const page = raw.dafec(h, 1, 7);
            if (page.done || page.n !== 1 || page.lines[0] !== "first")
              throw Error("Unexpected cursor at reopen " + i);
          } finally {
            raw.dafcls(h);
          }
        }
        const h = raw.dafopr(name);
        try {
          expect(raw.dafec(h, 2, 7)).toEqual({
            n: 2,
            lines: ["first", "second"],
            done: true,
          });
        } finally {
          raw.dafcls(h);
        }
      } finally {
        try {
          raw.kclear();
        } finally {
          await dispose();
        }
      }
    },
    30000,
  );
}

it.runIf(nodeBackendAvailable)(
  "two native clients share one DAF cursor while retaining separate handle ownership and explicit closes",
  async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-shared-daf-")),
      file = path.join(dir, "shared.bsp");
    try {
      fs.writeFileSync(file, fixture);
      const left = await spiceClients.toSync({ backend: "node" });
      let leftDisposed = false;
      try {
        const writer = left.spice.raw.dafopw(file);
        try {
          left.spice.raw.dafac(writer, ["one", "two", "three"]);
        } finally {
          left.spice.raw.dafcls(writer);
        }
        const right = await spiceClients.toSync({ backend: "node" });
        try {
          const a = left.spice.raw.dafopr(file),
            b = right.spice.raw.dafopr(file);
          expect(() => right.spice.raw.dafec(a, 1, 10)).toThrow();
          expect(left.spice.raw.dafec(a, 1, 10)).toEqual({
            n: 1,
            lines: ["one"],
            done: false,
          });
          left.spice.raw.dafcls(a);
          await left.dispose();
          leftDisposed = true;
          expect(right.spice.raw.dafec(b, 1, 10)).toEqual({
            n: 1,
            lines: ["two"],
            done: false,
          });
          right.spice.raw.dafcls(b);
          const reopened = right.spice.raw.dafopr(file);
          try {
            expect(right.spice.raw.dafec(reopened, 3, 10)).toEqual({
              n: 3,
              lines: ["one", "two", "three"],
              done: true,
            });
          } finally {
            right.spice.raw.dafcls(reopened);
          }
        } finally {
          await right.dispose();
        }
      } finally {
        if (!leftDisposed) await left.dispose();
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);
