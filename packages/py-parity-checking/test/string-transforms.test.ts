import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type { ParityCase, WorkflowStep } from "../src/case-types.js";
import { stringsCases } from "../src/cases/index.js";
import { runCaseInSidecar } from "../src/run-sidecar.js";
import { runCaseInTspice } from "../src/run-tspice.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const fixtures = path.resolve(import.meta.dirname, "../fixtures");
const sidecar = path.resolve(import.meta.dirname, "../sidecars/spiceypy");
function independent(program: string) {
  return execFileSync(
    "uv",
    ["run", "--locked", "--project", sidecar, "python", "-c", program],
    { encoding: "utf8", timeout: 15_000 },
  );
}
function workflowCase(suffix: string, workflow: WorkflowStep[]): ParityCase {
  return {
    caseId: "string-observation-" + suffix,
    description: "Full live string and scalar outputs.",
    workflow,
    expectation: { kind: "success" },
  };
}
// SpiceyPy strips trailing whitespace and ignores malformed UTF-8 in its
// string conversion. Inspect the actual C outputs before converting them.
it("observes exact C result buffers that the high-level Python conversion loses", () => {
  const stdout = independent(`
import json
import spiceypy as sp
from py_parity_sidecar import string_oracle as o
sp.reset()
sp.kclear()
try:
    results = []
    for text, cap in [("Ab  ",5), ("A\\t\\r\\n",5), ("",2), ("éX",2), ("😀X",4), ("\\ufeffA",4)]:
        results.append([o.case_bytes(text,cap,upper=False).hex(), o.case_bytes(text,cap,upper=True).hex(), o.compressed_bytes(":",1,text,cap).hex()])
    high_level = [sp.lcase("A  ",4), sp.ucase("a  ",4), sp.cmprss(":",1,"A  ",4)]
    assert not sp.failed()
    print(json.dumps({"results":results,"highLevel":high_level}))
finally:
    sp.reset()
    sp.kclear()
`);
  expect(JSON.parse(stdout)).toEqual({
    results: [
      ["61622020", "41422020", "41622020"],
      ["61090d0a", "41090d0a", "41090d0a"],
      ["", "", ""],
      ["c3", "c3", "c3"],
      ["f09f98", "f09f98", "f09f98"],
      ["efbbbf", "efbbbf", "efbbbf"],
    ],
    highLevel: ["a", "A", "A"],
  });
}, 20_000);

describe("public raw string transforms", () => {
  for (const backend of ["wasm", "node"] as const) {
    const run = backend === "node" ? it.runIf(nodeBackendAvailable) : it;
    run(
      `${backend} preserves the complete independent strings across long inputs and exact capacities`,
      async () => {
        // Longer than SpiceyPy's implicit output length and a fixed 2 KiB buffer.
        const text = "\ufeff" + "Ab::é𝄞 ".repeat(512) + "Z\t\r\n  ",
          size = Buffer.byteLength(text, "utf8") + 1;
        const c = workflowCase("long-values", [
          { op: "strings.lcase", input: text },
          { op: "strings.ucase", input: text },
          { op: "strings.cmprss", delim: ":", n: 1, input: text },
          { op: "strings.lcase", input: text, lenout: size },
          { op: "strings.ucase", input: text, lenout: 2147483647 },
          {
            op: "strings.cmprss",
            delim: "\0",
            n: 0,
            input: text,
            lenout: 2147483647,
          },
          { op: "strings.lastnb", input: text },
          { op: "strings.eqstr", a: text, b: text },
          { op: "strings.iswhsp", input: text },
          {
            op: "strings.matchi",
            input: text,
            template: "*z\t\r\n",
            wstr: "*",
            wchr: "?",
          },
          {
            op: "strings.matchw",
            input: text,
            template: "*z\t\r\n",
            wstr: "*",
            wchr: "?",
          },
        ]);
        const oracle = await runCaseInSidecar(c, fixtures);
        if (!oracle.ok) throw new Error(oracle.error.message);
        const { spice, dispose } = await spiceClients.toSync({ backend });
        try {
          const actual = runCaseInTspice(spice, c, fixtures);
          if (!actual.ok) throw new Error(actual.error.message);
          expect(actual.outputs).toEqual(oracle.outputs);
          const strings = actual.outputs.slice(0, 6).map((o) => o.value);
          for (const s of strings) {
            if (typeof s !== "string")
              throw new Error("Missing public raw text");
            expect(Buffer.byteLength(s)).toBeGreaterThan(2048);
            expect(s.startsWith("\ufeff")).toBe(true);
            expect(s.endsWith("\t\r\n  ")).toBe(true);
          }
          expect(strings[5]).toBe(text);
          expect(actual.outputs.slice(6).map((o) => o.value)).toEqual([
            size - 4,
            true,
            false,
            true,
            false,
          ]);
        } finally {
          await dispose();
        }
      },
      25_000,
    );
    run(
      `${backend} observes exact byte-index, whitespace and wildcard semantics`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        try {
          const raw = spice.raw;
          expect(raw.lastnb("A😀  ")).toBe(4);
          expect(raw.lastnb("a\t  ")).toBe(1);
          expect(raw.lastnb("   ")).toBe(-1);
          expect(raw.eqstr("", "")).toBe(true);
          expect(raw.eqstr("", " ")).toBe(false);
          expect(raw.eqstr("a \t\nB", "Ab")).toBe(true);
          expect(raw.iswhsp("\t\n\v\f\r ")).toBe(true);
          expect(raw.iswhsp("\u00a0")).toBe(false);
          for (const n of ["matchi", "matchw"] as const) {
            expect(raw[n]("é", "?", "*", "?")).toBe(false);
            expect(raw[n]("é", "??", "*", "?")).toBe(true);
            expect(raw[n]("abcd", "a?d", "?", "?")).toBe(true);
            expect(raw[n]("abc", "a*", "\0", "?")).toBe(false);
            expect(raw[n]("   ", "*", "*", "?")).toBe(true);
          }
          expect(raw.matchi(" A b ", "a?B", "*", "?")).toBe(true);
          expect(raw.matchw(" A b ", "a?B", "*", "?")).toBe(false);
          expect(raw.cmprss(" ", 1, "  a  \t ")).toBe(" a \t ");
          expect(raw.cmprss("\0", 0, " Ab\t ")).toBe(" Ab\t ");
          expect(raw.cmprss(":", 1, "é::😀x", 8)).toBe("é:😀");
          expect(raw.ucase("\ufeffßa\t ")).toBe("\ufeffßA\t ");
          expect(raw.lcase("\ufeffÉA  ")).toBe("\ufeffÉa  ");
        } finally {
          await dispose();
        }
      },
    );
    run(
      `${backend} recovers after actual CSPICE EMPTYSTRING and STRINGTOOSHORT errors`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        try {
          for (const c of stringsCases.filter(
            (c) => c.expectation.kind === "error",
          )) {
            const oracle = await runCaseInSidecar(c, fixtures),
              actual = runCaseInTspice(spice, c, fixtures);
            if (oracle.ok || actual.ok || c.expectation.kind !== "error")
              throw new Error("Missing actual SPICE diagnostic " + c.caseId);
            for (const fragment of c.expectation.errorMessageIncludes ?? []) {
              expect(oracle.error.message).toContain(fragment);
              expect(actual.error.message).toContain(fragment);
            }
            expect(spice.raw.failed()).toBe(false);
            expect(spice.raw.ucase("a ")).toBe("A ");
            expect(spice.raw.matchi("a", "A", "*", "?")).toBe(true);
          }
        } finally {
          try {
            spice.raw.reset();
            spice.raw.kclear();
          } finally {
            await dispose();
          }
        }
      },
      40_000,
    );
    run(
      `${backend} distinguishes malformed UTF-8 result bytes from toolkit errors`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        try {
          for (const [input, cap] of [
            ["éX", 2],
            ["😀X", 4],
            ["\ufeffA", 3],
          ] as const) {
            for (const op of ["lcase", "ucase", "cmprss"] as const) {
              const call = () =>
                op === "cmprss"
                  ? spice.raw.cmprss(":", 1, input, cap)
                  : spice.raw[op](input, cap);
              expect(call).toThrow(TypeError);
              expect(spice.raw.failed()).toBe(false);
              expect(spice.raw.cmprss(":", 1, input)).toBe(input);
            }
          }
        } finally {
          await dispose();
        }
      },
    );
    run(
      `${backend} validates JS text, signed integers and single-byte SpiceChar arguments`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        const raw = spice.raw;
        const specs = [
          {
            name: "cmprss",
            args: [":", 1, "A::B", 8],
            text: [2],
            char: [0],
            integers: [1, 3],
          },
          {
            name: "eqstr",
            args: ["a", "A"],
            text: [0, 1],
            char: [],
            integers: [],
          },
          ...(["iswhsp", "lastnb"] as const).map((name) => ({
            name,
            args: ["A "],
            text: [0],
            char: [],
            integers: [],
          })),
          ...(["lcase", "ucase"] as const).map((name) => ({
            name,
            args: ["A ", 8],
            text: [0],
            char: [],
            integers: [1],
          })),
          ...(["matchi", "matchw"] as const).map((name) => ({
            name,
            args: ["a", "A", "*", "?"],
            text: [0, 1],
            char: [2, 3],
            integers: [],
          })),
        ] as const;
        try {
          for (const spec of specs) {
            function reject(slot: number, value: unknown) {
              const args: unknown[] = [...spec.args];
              args[slot] = value;
              expect(() => Reflect.apply(raw[spec.name], raw, args)).toThrow();
            }
            for (const slot of spec.text)
              for (const invalid of [
                null,
                42,
                {},
                ["a"],
                "a\0b",
                "\ud800",
                "\udc00",
                "x\udfffy",
              ])
                reject(slot, invalid);
            for (const slot of spec.char)
              for (const invalid of ["", "xy", "é", "😀", "\ud800", 1, null])
                reject(slot, invalid);
            for (const slot of spec.integers)
              for (const invalid of [
                NaN,
                Infinity,
                "1",
                1.5,
                2147483648,
                -2147483649,
                null,
              ])
                reject(slot, invalid);
          }
          expect(raw.failed()).toBe(false);
          expect(raw.cmprss("x", 1, "xx")).toBe("x");
        } finally {
          await dispose();
        }
      },
    );
  }
});
