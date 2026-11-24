import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const project = path.resolve(import.meta.dirname, "../sidecars/spiceypy");
const fixture = fs.readFileSync(
  path.resolve(import.meta.dirname, "../fixtures/kernels/audit-multi-dsk.bds"),
);
const inspectFile = `
import json, sys
import spiceypy as sp
h=sp.dasopr(sys.argv[1])
try:
    result=[]
    while True:
        n,rows,done=sp.dasec(h,2,2200)
        result.extend(rows[:n])
        if done: break
    n,rows,done=sp.dasec(h,1,2200)
    print(json.dumps([result,rows[0],list(sp.dasrfr(h)),list(sp.daslla(h))]))
finally:
    sp.dascls(h)
`;
const dataDigest = `
import hashlib,json,sys
import spiceypy as sp
h=sp.dasopr(sys.argv[1])
try:
    lastc,lastd,lasti=sp.daslla(h)
    assert lastc==0 and lastd>0 and lasti>0
    digest=hashlib.sha256()
    digest.update(sp.dasrdd(h,1,lastd).astype("<f8").tobytes())
    digest.update(sp.dasrdi(h,1,lasti).astype("<i4").tobytes())
    print(json.dumps([lastd,lasti,digest.hexdigest()]))
finally:
    sp.dascls(h)
`;
const authorFile = `
import json,sys
import spiceypy as sp
h=sp.dasopw(sys.argv[1])
try:
    sp.dasdc(h)
    sp.dasac(h,["  independently authored", " ", "r"*1069, "finish"])
    last=sp.daslla(h)
    print(json.dumps(list(last)))
finally:
    sp.dascls(h)
`;
function oracle(script: string, file: string): unknown {
  return JSON.parse(
    execFileSync(
      "uv",
      ["run", "--locked", "--project", project, "python", "-c", script, file],
      { encoding: "utf8", timeout: 25000 },
    ),
  );
}
for (const backend of ["node", "wasm"] as const) {
  const test = it.runIf(backend === "wasm" || nodeBackendAvailable);
  test(
    backend +
      " writes a closed DAS independently read through the real SpiceyPy reader on two successive passes",
    async () => {
      const dir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tspice-comments-write-"),
      );
      const out = {
        kind: "virtual-output",
        path: "comment-output.das",
      } as const;
      try {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        try {
          const raw = spice.raw,
            h = raw.dasonw(out, "C06", "COMMENT RECORDS", 2);
          const lines = ["  first", "", "tile".repeat(365), "last"];
          try {
            raw.dasac(h, ["discard", "old"]);
            expect(raw.dasec(h, 2)).toEqual({
              n: 2,
              lines: ["discard", "old"],
              done: true,
            });
            raw.dasdc(h);
            raw.dasac(h, [...lines.slice(0, 3), "last  "]);
          } finally {
            raw.dascls(h);
          }
          const file = path.join(dir, "authored.das");
          fs.writeFileSync(file, spice.kit.readVirtualOutput(out));
          const used = lines.reduce((sum, line) => sum + line.length + 1, 0);
          expect(oracle(inspectFile, file)).toEqual([
            lines,
            lines[0],
            ["DAS/C06", "COMMENT RECORDS", 0, 0, Math.ceil(used / 1024), used],
            [0, 0, 0],
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
      " reads a SpiceyPy-authored comment area, relocates records and preserves every DSK segment descriptor and logical address",
    async () => {
      const dir = fs.mkdtempSync(
          path.join(os.tmpdir(), "tspice-comments-read-"),
        ),
        file = path.join(dir, "oracle.bds");
      try {
        fs.writeFileSync(file, fixture);
        const addresses = oracle(authorFile, file);
        const digest = oracle(dataDigest, file);
        const { spice, dispose } = await spiceClients.toSync({ backend });
        try {
          const raw = spice.raw;
          const target = {
            kind: "virtual-output",
            path: "independent.bds",
          } as const;
          // The WASM byte export uses a writer-owned path. Reserve this private
          // name before staging the independently prepared DSK at that path.
          if (backend === "wasm")
            raw.dascls(raw.dasonw(target, "C06", "STAGING", 0));
          raw.furnsh({ path: target.path, bytes: fs.readFileSync(file) });
          raw.unload("independent.bds");
          const w = raw.dasopw("independent.bds");
          const written = raw.dashfn(w);
          const descriptors = () => {
            let result = raw.dlabfs(w);
            const segments = [];
            while (result.found) {
              const d = result.descr;
              segments.push([d, raw.dskgd(w, d), raw.dskb02(w, d)]);
              result = raw.dlafns(w, d);
            }
            return segments;
          };
          try {
            const original = descriptors();
            expect(original.length).toBeGreaterThan(1);
            expect(raw.dasec(w, 4, 1200)).toEqual({
              n: 4,
              lines: [
                "  independently authored",
                "",
                "r".repeat(1069),
                "finish",
              ],
              done: true,
            });
            const { lastc, lastd, lasti } = raw.daslla(w);
            expect([lastc, lastd, lasti]).toEqual(addresses);
            raw.dasdc(w);
            expect(raw.dasrfr(w)).toMatchObject({ ncomc: 0, ncomr: 0 });
            raw.dasac(w, ["z".repeat(3187)]);
            expect(raw.dasec(w, 2, 3188)).toEqual({
              n: 1,
              lines: ["z".repeat(3187)],
              done: true,
            });
            expect(raw.daslla(w)).toEqual({ lastc, lastd, lasti });
            expect(descriptors()).toEqual(original);
          } finally {
            raw.dascls(w);
          }
          const exported = path.join(dir, "relocated.bds");
          if (backend === "wasm")
            fs.writeFileSync(exported, spice.kit.readVirtualOutput(target));
          else fs.copyFileSync(written, exported);
          expect(oracle(dataDigest, exported)).toEqual(digest);
        } finally {
          try {
            spice.raw.kclear();
          } finally {
            await dispose();
          }
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
          raw.furnsh({ path: p + ".bds", bytes: fixture });
          raw.unload(p + ".bds");
          const h = raw.dasopw(p + ".bds");
          try {
            raw.dasdc(h);
            raw.dasac(h, [p, "X".repeat(1401), "tail"]);
            expect(raw.dasec(h, 1, 4)).toEqual({
              n: 1,
              lines: [p],
              done: false,
            });
            expect(() => raw.dasac(h, ["blocked"])).toThrow(
              /active DAS comment extraction/,
            );
            expect(() => raw.dasdc(h)).toThrow(/active DAS comment extraction/);
          } finally {
            raw.dascls(h);
          }
        }
        const a = raw.dasopr("one.bds"),
          alias = raw.dasopr("one.bds"),
          b = raw.dasopr("two.bds");
        let open = true;
        try {
          const first = raw.dasec(a, 1, 4);
          expect(first).toEqual({ n: 1, lines: ["one"], done: false });
          expect(() => raw.dasdc(a)).toThrow(/DASINVALIDACCESS/);
          expect(() => raw.dasac(a, ["valid"])).toThrow(/DASINVALIDACCESS/);
          expect(raw.dasec(b, 1, 4).lines).toEqual(["two"]);
          expect(() => raw.dasec(alias, 2, 1301)).toThrowError(
            expect.objectContaining({
              spiceShort: "SPICE(COMMENTTOOLONG)",
              spiceLong:
                "The output buffer line length (1300) was not long enough to contain a comment line with length 1.",
              spiceTrace: "dasec_c --> DASEC",
            }),
          );
          expect(raw.failed()).toBe(false);
          raw.dascls(a);
          open = false;
          expect(raw.dasec(alias, 1, 1402)).toEqual({
            n: 1,
            lines: ["X".repeat(1401)],
            done: false,
          });
          expect(raw.dasec(b, 2, 1402)).toEqual({
            n: 2,
            lines: ["X".repeat(1401), "tail"],
            done: true,
          });
          expect(raw.dasec(alias, 2, 5)).toEqual({
            n: 1,
            lines: ["tail"],
            done: true,
          });
          expect(raw.dasec(alias, 1, 4)).toEqual(first);
          first.lines[0] = "consumer mutation";
          expect(raw.dasec(b, 1, 4).lines).toEqual(["two"]);
        } finally {
          try {
            if (open) raw.dascls(a);
          } finally {
            try {
              raw.dascls(alias);
            } finally {
              raw.dascls(b);
            }
          }
        }
        const h = raw.dasopr("one.bds");
        try {
          expect(raw.dasec(h, 1, 4).lines).toEqual(["one"]);
        } finally {
          raw.dascls(h);
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
        const name = "repeat.bds";
        raw.furnsh({ path: name, bytes: fixture });
        raw.unload(name);
        const w = raw.dasopw(name);
        try {
          raw.dasdc(w);
          raw.dasac(w, ["first", "second"]);
        } finally {
          raw.dascls(w);
        }
        for (let i = 0; i < 5001; i++) {
          const h = raw.dasopr(name);
          try {
            const page = raw.dasec(h, 1, 7);
            if (page.done || page.n !== 1 || page.lines[0] !== "first")
              throw Error("Unexpected cursor at reopen " + i);
          } finally {
            raw.dascls(h);
          }
        }
        const h = raw.dasopr(name);
        try {
          expect(raw.dasec(h, 2, 7)).toEqual({
            n: 2,
            lines: ["first", "second"],
            done: true,
          });
        } finally {
          raw.dascls(h);
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
  "two native clients share one DAS cursor while retaining separate handle ownership and explicit closes",
  async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-shared-daf-")),
      file = path.join(dir, "shared.bds");
    try {
      fs.writeFileSync(file, fixture);
      const left = await spiceClients.toSync({ backend: "node" });
      let leftDisposed = false;
      try {
        const writer = left.spice.raw.dasopw(file);
        try {
          left.spice.raw.dasdc(writer);
          left.spice.raw.dasac(writer, ["one", "two", "three"]);
        } finally {
          left.spice.raw.dascls(writer);
        }
        const right = await spiceClients.toSync({ backend: "node" });
        try {
          const a = left.spice.raw.dasopr(file),
            b = right.spice.raw.dasopr(file);
          expect(() => right.spice.raw.dasec(a, 1, 10)).toThrow();
          expect(left.spice.raw.dasec(a, 1, 10)).toEqual({
            n: 1,
            lines: ["one"],
            done: false,
          });
          left.spice.raw.dascls(a);
          await left.dispose();
          leftDisposed = true;
          expect(right.spice.raw.dasec(b, 1, 10)).toEqual({
            n: 1,
            lines: ["two"],
            done: false,
          });
          right.spice.raw.dascls(b);
          const reopened = right.spice.raw.dasopr(file);
          try {
            expect(right.spice.raw.dasec(reopened, 3, 10)).toEqual({
              n: 3,
              lines: ["one", "two", "three"],
              done: true,
            });
          } finally {
            right.spice.raw.dascls(reopened);
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

// An unnamed DAS created before any named file can retain an uninitialized
// architecture ID in N0067. Observe its documented header error on isolated
// runtimes so previous named opens cannot supply the missing ID word.
const firstScratchPython = `
import json
import spiceypy as sp
from spiceypy.utils.exceptions import SpiceyError
from py_parity_sidecar import das_comment_oracle as oracle
h=sp.dasops()
try:
    result=[]
    for call in [lambda: sp.dasac(h, ["row"]), lambda: oracle.extract(h,1,12)]:
        try: call()
        except SpiceyError as e: result.append([e.short,e.traceback])
    print(json.dumps([result,sp.failed()]))
finally: sp.dascls(h)
`;
const firstScratchJavaScript = `
import {spiceClients} from "@rybosome/tspice";
const client=await spiceClients.toSync({backend:process.argv[1]});
try {
  const raw=client.spice.raw, h=raw.dasops(), result=[];
  try {
    for (const call of [()=>raw.dasac(h,["row"]),()=>raw.dasec(h,1,12)]) {
      try {call();} catch (e) {result.push([e.spiceShort,e.spiceTrace]);}
    }
    console.log(JSON.stringify([result,raw.failed()]));
  } finally {raw.dascls(h);}
} finally {await client.dispose();}
`;
for (const backend of ["node", "wasm"] as const) {
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    backend +
      " preserves the actual primary call tree for an unnamed scratch header error",
    () => {
      const expected = oracle(firstScratchPython, "");
      expect(expected).toEqual([
        [
          [
            "SPICE(UNKNOWNFILARC)",
            "dasac_c --> DASAC --> DASRFR --> ZZDASRFR --> ZZDDHPPF",
          ],
          [
            "SPICE(UNKNOWNFILARC)",
            "dasec_c --> DASEC --> DASRFR --> ZZDASRFR --> ZZDDHPPF",
          ],
        ],
        false,
      ]);
      const actual = execFileSync(
        process.execPath,
        ["--input-type=module", "-e", firstScratchJavaScript, backend],
        {
          encoding: "utf8",
          cwd: path.resolve(import.meta.dirname, ".."),
          timeout: 15000,
        },
      );
      expect(JSON.parse(actual)).toEqual(expected);
    },
  );
}
