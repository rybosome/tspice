import { execFileSync } from "node:child_process";
import path from "node:path";
import { spiceClients, type SpiceSync } from "@rybosome/tspice";
import { expect, it } from "vitest";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const project = path.resolve(import.meta.dirname, "../sidecars/spiceypy");
const methods = ["cpos", "cposr", "ncpos", "ncposr", "pos", "posr"] as const;

function independent(program: string): unknown {
  const imports = `
import json,sys
import spiceypy as sp
from py_parity_sidecar import string_oracle as oracle
from unittest.mock import patch,Mock
names=("cpos","cposr","ncpos","ncposr","pos","posr")
sp.reset()
sp.kclear()
`;
  return JSON.parse(
    execFileSync(
      "uv",
      [
        "run",
        "--locked",
        "--project",
        project,
        "python",
        "-c",
        imports + program,
      ],
      { encoding: "utf8", timeout: 20_000 },
    ),
  );
}

async function withRaw(
  backend: "wasm" | "node",
  check: (raw: SpiceSync["raw"]) => void,
) {
  const { spice, dispose } = await spiceClients.toSync({ backend });
  try {
    spice.raw.reset();
    check(spice.raw);
  } finally {
    try {
      spice.raw.reset();
    } finally {
      await dispose();
    }
  }
}

it("uses safe canonical start operands and full NUL-terminated byte rows in the locked oracle", () => {
  const result = independent(`
try:
    guarded=0
    for name in names:
        # The real routine is unreachable at a nonrepresentable one-based start.
        routine=Mock(side_effect=AssertionError("unexpected canonical dispatch"))
        for start in (2**31-1,2**31,-2**31-1,1.5):
            try: oracle.search(routine,"ab","a",start)
            except ValueError: guarded+=1
            else: raise AssertionError("invalid direct oracle start")
        routine.assert_not_called()
    with patch.object(sp,"esrchc",wraps=sp.esrchc) as ordinary:
        ascii_row=oracle.esrchc(" A B ",["different","ab","AB"])
        ordinary.assert_called_once()
        ordinary.reset_mock()
        direct=[oracle.esrchc(k,rows) for k,rows in [("",[]),("",["",""]),(" ",["",""]),("🛰🚀",["a","🛰🚀"]),("É",["é","É"])]]
        ordinary.assert_not_called()
    with patch.object(oracle,"_esrchc",side_effect=AssertionError("unexpected row dispatch")) as canonical:
        for key,rows in [("X\\x00Z",["X"]),("X",["X\\x00Z"]),("X",["\\ud800"]),("\\udfff",["X"])]:
            try: oracle.esrchc(key,rows)
            except ValueError: guarded+=1
            else: raise AssertionError("malformed text reached oracle")
        canonical.assert_not_called()
    print(json.dumps([guarded,ascii_row,direct,sp.failed()]))
finally:
    sp.reset()
    sp.kclear()
`);
  expect(result).toEqual([28, 1, [-1, 0, -1, 1, 1], false]);
}, 25_000);

for (const backend of ["wasm", "node"] as const) {
  const run = backend === "node" ? it.runIf(nodeBackendAvailable) : it;
  run(
    `${backend} matches every byte start and both safe signed-domain endpoints`,
    async () => {
      const reference = independent(`
try:
    text="é🚀éZ"
    rows=[]
    for name in names:
        needle="©" if "cpos" in name else "é"
        routine=getattr(sp,name)
        # The maximum signed JS start is compared with an already-past-end,
        # representable start. No C call on this path receives INT_MAX.
        starts=[-2**31,*range(-1,len(text.encode())+2),2**31-2]
        rows.append([routine(text,needle,i) for i in starts])
    print(json.dumps(rows))
finally:
    sp.reset()
    sp.kclear()
`);
      await withRaw(backend, (raw) => {
        const text = "é🚀éZ";
        const starts = [
          -2147483648,
          ...Array.from(
            { length: Buffer.byteLength(text) + 3 },
            (_, i) => i - 1,
          ),
          2147483646,
        ];
        const rows = methods.map((name) => {
          const needle = name.includes("cpos") ? "©" : "é";
          const observed = starts.map((i) => raw[name](text, needle, i));
          expect(raw[name](text, needle, 2147483647)).toBe(observed.at(-1));
          return observed;
        });
        expect(rows).toEqual(reference);
        expect(rows.map((row) => row.at(-1))).toEqual([-1, 7, -1, 8, -1, 6]);
        expect(raw.failed()).toBe(false);
      });
    },
    25_000,
  );

  run(
    `${backend} preserves first equivalent UTF-8 rows, whitespace and empty-row boundaries`,
    async () => {
      const keys = [
        "a b",
        "AB",
        "é",
        "É",
        "🛰🚀",
        "",
        " ",
        "\t",
        "\ufeffab",
        "\u00a0AB",
        "X",
      ];
      const rows = Object.freeze([
        "junk",
        "  a\tB",
        "AB",
        "é",
        "É",
        "🛰🚀",
        "",
        " \t",
        "\ufeffAB",
      ]);
      const reference = independent(`
try:
    keys=["a b","AB","é","É","🛰🚀",""," ","\\t","\\ufeffab","\\u00a0AB","X"]
    rows=["junk","  a\\tB","AB","é","É","🛰🚀",""," \\t","\\ufeffAB"]
    print(json.dumps([oracle.esrchc(key,rows) for key in keys]))
finally:
    sp.reset()
    sp.kclear()
`);
      await withRaw(backend, (raw) => {
        expect(keys.map((key) => raw.esrchc(key, rows))).toEqual(reference);
        expect(raw.esrchc("AB", rows)).toBe(1);
        expect(raw.esrchc("", rows)).toBe(6);
        expect(raw.esrchc(" ", rows)).toBe(7);
        expect(raw.esrchc("anything", [])).toBe(-1);
        expect(raw.esrchc("", ["", ""])).toBe(0);
        const seen = new Set<PropertyKey>();
        const tracked = new Proxy([...rows], {
          get(target, key, receiver) {
            if (key === Symbol.iterator || seen.has(key))
              throw new Error("Repeated row access");
            seen.add(key);
            return Reflect.get(target, key, receiver);
          },
        });
        expect(raw.esrchc("🛰🚀", tracked)).toBe(5);
        expect(seen).toEqual(
          new Set(["length", ...rows.map((_, i) => String(i))]),
        );
        expect(raw.failed()).toBe(false);
      });
    },
    25_000,
  );

  run(
    `${backend} rejects malformed C strings and invalid starts, then recovers from a genuine toolkit error`,
    async () => {
      await withRaw(backend, (raw) => {
        for (const method of methods) {
          for (const bad of ["a\0b", "\ud800", "\udfff"]) {
            expect(() => raw[method](bad, "b", 0)).toThrow();
            expect(() => raw[method]("abc", bad, 0)).toThrow();
          }
          for (const bad of [
            NaN,
            Infinity,
            -Infinity,
            1.5,
            -2147483649,
            2147483648,
          ])
            expect(() => raw[method]("abc", "b", bad)).toThrow();
        }
        for (const bad of ["x\0y", "\ud800", "\udfff"]) {
          expect(() => raw.esrchc(bad, ["x"])).toThrow();
          expect(() => raw.esrchc("x", ["x", bad])).toThrow();
        }
        expect(raw.failed()).toBe(false);
        // This error belongs to the existing matching operation. Searches on
        // well-formed strings, including empty and all-miss cases, return indices.
        expect(() => raw.matchw("", "x", "*", "?")).toThrow(/EMPTYSTRING/);
        expect(raw.failed()).toBe(false);
        for (const name of methods) expect(raw[name]("", "x", 0)).toBe(-1);
        expect(raw.pos("ababa", "aba", 1)).toBe(2);
        expect(raw.ncpos("xxx", "x", 0)).toBe(-1);
        expect(raw.esrchc(" recovered ", ["x", "RECOVERED"])).toBe(1);
        expect(raw.failed()).toBe(false);
      });
    },
  );
}
