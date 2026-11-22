import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { allCases } from "../src/cases/index.js";
import { runCaseInSidecar } from "../src/run-sidecar.js";
import { runCaseInTspice } from "../src/run-tspice.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const fixtures = path.resolve(import.meta.dirname, "../fixtures");
const sidecar = path.resolve(import.meta.dirname, "../sidecars/spiceypy");
const names = [
  "lstlec",
  "lstled",
  "lstlei",
  "lstltc",
  "lstltd",
  "lstlti",
] as const;
function independent(program: string): unknown {
  return JSON.parse(
    execFileSync(
      "uv",
      ["run", "--locked", "--project", sidecar, "python", "-c", program],
      { encoding: "utf8", timeout: 15_000 },
    ),
  );
}
function caseFor(suffix: string) {
  const c = allCases.find((c) => c.caseId === "coords-vectors-" + suffix);
  if (!c) throw new Error("Missing search case " + suffix);
  return c;
}
it("compares CSPICE's fixed-width character rows and verifies all six empty-array indices", () => {
  const observed = independent(`
import ctypes as c,json
import spiceypy as sp
from spiceypy.utils import support_types as st
from py_parity_sidecar.sorted_bounds_oracle import character_rows,numeric

sp.reset()
sp.kclear()
try:
    # Each middle row in LSTLEC is compared across width-1 bytes. Show the
    # actual representation difference on the same valid logical sequence.
    values=["A","B\\t","B","Z"]
    key="B\\t"
    width,rows=character_rows(key,values)
    encoded=st.list_to_char_array(rows,x_len=width,y_len=len(rows))
    padded=[f(key,len(rows),width,rows) for f in (sp.lstlec,sp.lstltc)]
    ordinary=[f(key,len(values),width,values) for f in (sp.lstlec,sp.lstltc)]
    empty_width,empty_rows=character_rows("",[])
    for pointer in [st.to_double_vector([]),st.to_int_vector([]),st.list_to_char_array_ptr([],x_len=empty_width,y_len=0)]:
        assert c.cast(pointer,c.c_void_p).value
    empty=[f("",0,empty_width,empty_rows) for f in (sp.lstlec,sp.lstltc)]
    empty.extend(f(0,0,[]) for f in (sp.lstled,sp.lstltd,sp.lstlei,sp.lstlti))
    blocked=0
    # These are wrapper guards. Do not call an actual search with unsorted rows.
    for validate in [lambda:character_rows("",["B","B\\t"]),lambda:character_rows("a\\0b",[]),lambda:character_rows("",["\\ud800"]),lambda:numeric(0,[2,1],integer=False),lambda:numeric(0,[1,float("nan")],integer=False),lambda:numeric(0,[2147483648],integer=True)]:
        try: validate()
        except ValueError: blocked+=1
        else: raise AssertionError("An unsupported array reached the oracle")
    print(json.dumps({"width":width,"rowBytes":bytes(encoded).hex(),"blankPadded":padded,"ordinary":ordinary,"empty":empty,"guarded":blocked}))
finally:
    sp.reset()
    sp.kclear()
`);
  expect(observed).toEqual({
    width: 3,
    rowBytes: "4120004209004220005a2000",
    blankPadded: [1, 0],
    ordinary: [2, 0],
    empty: [-1, -1, -1, -1, -1, -1],
    guarded: 6,
  });
}, 20_000);

for (const backend of ["wasm", "node"] as const) {
  const run = backend === "node" ? it.runIf(nodeBackendAvailable) : it;
  run(
    `${backend} returns independently observed rightmost indices for repeated bounds`,
    async () => {
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        for (const n of names) {
          const c = caseFor(n + "-duplicates-at-beginning-interior-and-end"),
            ref = await runCaseInSidecar(c, fixtures),
            actual = runCaseInTspice(spice, c, fixtures);
          if (!ref.ok) throw new Error(ref.error.message);
          if (!actual.ok) throw new Error(actual.error.message);
          expect(actual.outputs).toEqual(ref.outputs);
          expect(actual.outputs[0]?.value).toBe(-1);
        }
        const rows = Object.freeze([-5, -5, -1, 2, 2, 2, 7, 11, 11]);
        const keys = [-6, -5, 2, 11, 12];
        for (const n of ["lstlei", "lstled"] as const)
          expect(keys.map((k) => spice.raw[n](k, rows))).toEqual([
            -1, 1, 5, 8, 8,
          ]);
        for (const n of ["lstlti", "lstltd"] as const)
          expect(keys.map((k) => spice.raw[n](k, rows))).toEqual([
            -1, -1, 2, 6, 8,
          ]);
        const t = Number.MIN_VALUE;
        expect(spice.raw.lstled(t, [-t, 0, t, t, 2 * t])).toBe(3);
        expect(spice.raw.lstltd(t, [-t, 0, t, t, 2 * t])).toBe(1);
      } finally {
        await dispose();
      }
    },
    25_000,
  );

  run(
    `${backend} preserves trailing-blank equivalence, lower control bytes, and UTF-8 row order`,
    async () => {
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        const rows = ["A", "B\t", "B", "Z"];
        for (const n of ["lstlec", "lstltc"] as const) {
          for (const suffix of [
            "control-byte-before-padding",
            "utf8-byte-order",
            "all-equal-with-trailing-blanks",
          ]) {
            const c = caseFor(n + "-" + suffix),
              ref = await runCaseInSidecar(c, fixtures),
              actual = runCaseInTspice(spice, c, fixtures);
            if (!ref.ok) throw new Error(ref.error.message);
            if (!actual.ok) throw new Error(actual.error.message);
            expect(actual.outputs).toEqual(ref.outputs);
          }
        }
        const raw = spice.raw;
        expect(raw.lstlec("B\t", rows)).toBe(1);
        expect(raw.lstltc("B\t", rows)).toBe(0);
        expect(raw.lstlec("", ["", " ", "  ", "A"])).toBe(2);
        expect(raw.lstltc("  ", ["", " ", "  ", "A"])).toBe(-1);
        expect(raw.lstlec("𐀀", ["\ue000", "𐀀", "😀"])).toBe(1);
        expect(raw.lstltc("𐀀", ["\ue000", "𐀀", "😀"])).toBe(0);
        const wide = "雪".repeat(1111);
        expect(
          raw.lstlec(wide + " ", ["!", wide, wide + " ", wide + "!"]),
        ).toBe(2);
        expect(
          raw.lstltc(wide + " ", ["!", wide, wide + " ", wide + "!"]),
        ).toBe(0);
        expect(rows).toEqual(["A", "B\t", "B", "Z"]);
      } finally {
        await dispose();
      }
    },
    25_000,
  );

  run(
    `${backend} preserves signed zero and ordered infinite double keys and rows`,
    async () => {
      const reference = independent(`
import json,spiceypy as sp
sp.reset();sp.kclear()
try:
    rows=[-float("inf"),-float("inf"),-1,-0.0,0.0,1,float("inf"),float("inf")]
    keys=[-float("inf"),-0.0,0.0,float("inf")]
    print(json.dumps([[f(key,len(rows),rows) for key in keys] for f in [sp.lstled,sp.lstltd]]))
finally:
    sp.reset();sp.kclear()
`);
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        const rows = [-Infinity, -Infinity, -1, -0, 0, 1, Infinity, Infinity],
          keys = [-Infinity, -0, 0, Infinity];
        const actual = [spice.raw.lstled, spice.raw.lstltd].map((fn) =>
          keys.map((key) => fn(key, rows)),
        );
        expect(actual).toEqual(reference);
        expect(actual).toEqual([
          [1, 4, 4, 7],
          [-1, 2, 2, 5],
        ]);
      } finally {
        await dispose();
      }
    },
    20_000,
  );

  run(
    `${backend} snapshots each caller row once and keeps sorted inputs intact`,
    async () => {
      const { spice, dispose } = await spiceClients.toSync({ backend });
      const raw = spice.raw;
      try {
        for (const n of names) {
          const rows = n.endsWith("c") ? ["A", "B", "B", "Z"] : [1, 2, 2, 7],
            length = rows.length,
            reads = rows.map(() => 0);
          let lengthReads = 0;
          const input = new Proxy([...rows], {
            get(target, key, receiver) {
              if (key === "length") {
                if (++lengthReads > 1) throw new Error("Caller length reread");
                return length;
              }
              if (key === Symbol.iterator)
                throw new Error("Caller iterator used");
              if (typeof key === "string" && /^\d+$/.test(key)) {
                const i = Number(key);
                if (i >= length || reads[i] !== 0)
                  throw new Error("Caller row reread");
                reads[i] = 1;
              }
              return Reflect.get(target, key, receiver);
            },
          });
          expect(
            Reflect.apply(raw[n], raw, [n.endsWith("c") ? "B" : 2, input]),
          ).toBe(n.startsWith("lstle") ? 2 : 0);
          expect(lengthReads).toBe(1);
          expect(reads).toEqual([1, 1, 1, 1]);
          expect(rows).toEqual(
            n.endsWith("c") ? ["A", "B", "B", "Z"] : [1, 2, 2, 7],
          );
        }
      } finally {
        await dispose();
      }
    },
  );

  run(
    `${backend} validates keys, element types and count limits before a search`,
    async () => {
      const { spice, dispose } = await spiceClients.toSync({ backend });
      const raw = spice.raw;
      try {
        const oversized = new Proxy<number[]>([], {
          get(t, k, r) {
            if (k === "length") return 2147483648;
            if (typeof k === "string" && /^\d+$/.test(k))
              throw new Error("Oversized search read");
            return Reflect.get(t, k, r);
          },
        });
        for (const n of names) {
          const chars = n.endsWith("c"),
            integer = n.endsWith("i"),
            key = chars ? "B" : 2,
            rows = chars ? ["A", "B", "C"] : [1, 2, 3];
          const invoke = (x: unknown, values: unknown) =>
            Reflect.apply(raw[n], raw, [x, values]);
          for (const invalid of [null, {}, 0, "[]", new Float64Array(3)])
            expect(() => invoke(key, invalid)).toThrow();
          for (const invalid of chars
            ? [0, null, "a\0b", "\ud800", "\udfff"]
            : integer
              ? [2147483648, -2147483649, 1.5, NaN, Infinity, "1", null]
              : [NaN, "1", null]) {
            expect(() => invoke(invalid, rows)).toThrow();
            for (let i = 0; i < rows.length; i++) {
              const copy: unknown[] = [...rows];
              copy[i] = invalid;
              expect(() => invoke(key, copy)).toThrow();
            }
          }
          expect(() => invoke(key, oversized)).toThrow(RangeError);
          expect(invoke(key, [])).toBe(-1);
        }
        expect(raw.failed()).toBe(false);
      } finally {
        await dispose();
      }
    },
  );
}
