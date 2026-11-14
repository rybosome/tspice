import { execFileSync } from "node:child_process";
import path from "node:path";
import { spiceClients, type SpiceSync } from "@rybosome/tspice";
import { expect, it } from "vitest";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

type Cell = Parameters<SpiceSync["kit"]["freeCell"]>[0];
type Own = <T extends Cell>(cell: T) => T;
type Backend = "node" | "wasm";

async function withCells(
  backend: Backend,
  test: (spice: SpiceSync, own: Own) => void,
) {
  const { spice, dispose } = await spiceClients.toSync({ backend });
  const cells: Cell[] = [];
  const own: Own = (cell) => {
    cells.push(cell);
    return cell;
  };
  try {
    test(spice, own);
  } finally {
    try {
      for (const cell of cells.reverse()) spice.kit.freeCell(cell);
    } finally {
      await dispose();
    }
  }
}

function toolkitShort(invoke: () => unknown): string {
  try {
    invoke();
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "spiceShort" in error &&
      typeof error.spiceShort === "string"
    ) {
      return error.spiceShort;
    }
    throw error;
  }
  throw new Error("Expected a structured CSPICE error");
}

function independent(body: string): unknown {
  const project = path.resolve(import.meta.dirname, "../sidecars/spiceypy");
  const program = `
import json, math
import spiceypy as sp
from spiceypy.utils.exceptions import SpiceyError
from spiceypy.utils.support_types import SPICEINT_CELL, SPICEDOUBLE_CELL, SPICECHAR_CELL
from py_parity_sidecar.cell_array_oracle import copy_cell

def short(call):
    try:
        call()
    except SpiceyError as error:
        assert not sp.failed()
        return error.short
    raise AssertionError("Expected a CSPICE error")

${body}
`;
  return JSON.parse(
    execFileSync(
      "uv",
      ["run", "--locked", "--project", project, "python", "-c", program],
      {
        encoding: "utf8",
        timeout: 20_000,
      },
    ),
  );
}

const numericProbe = `
rows = []
for make, append, values in [
    (SPICEINT_CELL, sp.appndi, [-19, 3, 46]),
    (SPICEDOUBLE_CELL, sp.appndd, [-12.75, 3.125, 8.5]),
]:
    source = make(4)
    for item in values:
        append(item, source)
    assert list(sp.copy(source)) == values
    for seeded in (False, True):
        dest, witness = make(2), make(4)
        if seeded:
            append(72, dest)
        error = short(lambda: copy_cell(source, dest))
        # card_c sees the C descriptor. A second copy reads the translated
        # control area, whose cardinality was updated before CELLTOOSMALL.
        before = [sp.card(dest), list(dest)]
        copy_cell(dest, witness)
        sp.scard(2, dest)
        revealed = list(dest)
        sp.scard(0, dest)
        append(-99, dest)
        rows.append([error, before, list(witness), revealed, list(dest), list(source)])
print(json.dumps(rows))
`;

function numericFailures<T extends Cell>(
  raw: SpiceSync["raw"],
  make: (n: number) => T,
  append: (item: number, cell: T) => void,
  copy: (src: T, dest: T) => void,
  get: (cell: T, index: number) => number,
  values: number[],
) {
  const read = (c: T) =>
    Array.from({ length: raw.card(c) }, (_, i) => get(c, i));
  const src = make(4);
  for (const value of values) append(value, src);
  return [false, true].map((seeded) => {
    const dest = make(2),
      witness = make(4);
    if (seeded) append(72, dest);
    const error = toolkitShort(() => copy(src, dest));
    expect(error).toBe("SPICE(CELLTOOSMALL)");
    expect(raw.failed()).toBe(false);
    const before = [raw.card(dest), read(dest)];
    expect(before).toEqual(seeded ? [1, values.slice(0, 1)] : [0, []]);
    copy(dest, witness);
    // Explicitly expose two initialized elements, both within allocated size.
    raw.scard(2, dest);
    const revealed = read(dest);
    raw.scard(0, dest);
    append(-99, dest);
    return [error, before, read(witness), revealed, read(dest), read(src)];
  });
}

const charProbe = String.raw`
def char_cell(size, width, values):
    cell = SPICECHAR_CELL(size, width)
    for value in values:
        sp.appndc(value, cell)
    return cell

def rows(cell):
    # Use membership as well as displayed rows: the SpiceyPy cell getter
    # right-trims a trailing tab that remains significant to CSPICE.
    queries = [" A\t", " A\t  ", " A", "A", "A\t", "KÉ", "K", "KÉ "]
    return [sp.card(cell), list(cell), [sp.elemc(q, cell) for q in queries]]

src = char_cell(4, 16, [" A\t", "A\t", "KÉ "])
wide = sp.copy(src)
dst = char_cell(4, 7, ["seed"])
copy_cell(src, dst)
first = rows(dst)
assert first == rows(wide)
copy_cell(dst, dst)
second = rows(dst)
sp.scard(0, src)
sp.appndc("new", src)
retained = rows(dst)

large = char_cell(3, 16, ["ALPHA", "LONG-WORD"])
failures = []
for size, width, initial in [(1, 16, ["OLD"]), (2, 6, ["OLD", "STAY"])]:
    dest = char_cell(size, width, initial)
    failure = short(lambda: copy_cell(large, dest))
    failures.append([failure, sp.card(dest), list(dest), [sp.elemc(v, dest) for v in initial]])
    sp.scard(0, dest)
    sp.appndc("again", dest)
    assert sp.elemc("again", dest)
print(json.dumps([first, second, retained, failures]))
`;

const flagProbe = `
src, dst = SPICEINT_CELL(4), SPICEINT_CELL(4)
for n in [-9, 7, 7]:
    sp.appndi(n, src)
# Retire the duplicate, leaving sorted unique data with a false set flag.
sp.scard(2, src)
nonset = short(lambda: sp.elemi(7, src))
copy_cell(src, dst)
good = [list(dst), sp.elemi(-9, dst), sp.elemi(7, dst), sp.elemi(0, dst)]
copy_cell(dst, src)
still_nonset = short(lambda: sp.elemi(7, src))
sp.valid(4, 2, src)
print(json.dumps([nonset, good, still_nonset, sp.elemi(7, src)]))
`;

const doubleProbe = `
def tag(x):
    if math.isinf(x):
        return "-Inf" if x < 0 else "+Inf"
    if x == 0 and math.copysign(1, x) < 0:
        return "-0"
    return x
src, dest = SPICEDOUBLE_CELL(4), SPICEDOUBLE_CELL(6)
values = [-math.inf, -0.0, 1e-300, math.inf]
for v in values:
    sp.appndd(v, src)
copy_cell(src, dest)
copy_cell(dest, dest)
def sample(c):
    return [[tag(x) for x in c], [sp.elemd(x, c) for x in [*values, 0.0, 1.5, -1.5]]]
assert sample(dest) == sample(sp.copy(src))
err = short(lambda: sp.appndd(0.0, src))
sp.scard(0, src)
sp.appndd(0.0, src)
print(json.dumps([err, sample(dest), [tag(x) for x in src]], allow_nan=False))
`;

for (const backend of ["node", "wasm"] as const) {
  const run = backend === "node" ? it.runIf(nodeBackendAvailable) : it;
  run(
    `${backend} exposes both numeric cell cardinalities and the bounded partial prefix after a failed copy`,
    async () => {
      const oracle = independent(numericProbe);
      await withCells(backend, ({ raw, kit }, own) => {
        const ints = numericFailures(
          raw,
          (n) => own(kit.newIntCell(n)),
          raw.appndi,
          (a, b) => raw.copy(a, b),
          kit.cellGeti,
          [-19, 3, 46],
        );
        const doubles = numericFailures(
          raw,
          (n) => own(kit.newDoubleCell(n)),
          raw.appndd,
          (a, b) => raw.copy(a, b),
          kit.cellGetd,
          [-12.75, 3.125, 8.5],
        );
        expect([...ints, ...doubles]).toEqual(oracle);
      });
    },
    30_000,
  );

  run(
    `${backend} preserves meaningful character bytes across row widths, self-copy and failed copies`,
    async () => {
      const oracle = independent(charProbe);
      await withCells(backend, ({ raw, kit }, own) => {
        const create = (
          size: number,
          width: number,
          values: readonly string[],
        ) => {
          const cell = own(kit.newCharCell(size, width));
          for (const value of values) raw.appndc(value, cell);
          return cell;
        };
        const rows = (cell: ReturnType<typeof create>) =>
          Array.from({ length: raw.card(cell) }, (_, i) =>
            kit.cellGetc(cell, i),
          );
        const queries = [" A\t", " A\t  ", " A", "A", "A\t", "KÉ", "K", "KÉ "];
        const sample = (cell: ReturnType<typeof create>) => [
          raw.card(cell),
          rows(cell),
          queries.map((q) => raw.elemc(q, cell)),
        ];

        const source = create(4, 16, [" A\t", "A\t", "KÉ "]);
        const dest = create(4, 7, ["seed"]);
        raw.copy(source, dest);
        const first = sample(dest);
        expect(first[2]).toEqual([
          true,
          true,
          false,
          false,
          true,
          true,
          false,
          true,
        ]);
        raw.copy(dest, dest);
        const second = sample(dest);
        raw.scard(0, source);
        raw.appndc("new", source);
        const retained = sample(dest);

        const large = create(3, 16, ["ALPHA", "LONG-WORD"]);
        const failures = [];
        for (const [size, width, initial] of [
          [1, 16, ["OLD"]],
          [2, 6, ["OLD", "STAY"]],
        ] as const) {
          const target = create(size, width, initial);
          const error = toolkitShort(() => raw.copy(large, target));
          expect(raw.failed()).toBe(false);
          failures.push([
            error,
            raw.card(target),
            rows(target),
            initial.map((v) => raw.elemc(v, target)),
          ]);
          raw.scard(0, target);
          raw.appndc("again", target);
          expect(raw.elemc("again", target)).toBe(true);
        }
        expect([first, second, retained, failures]).toEqual(oracle);
      });
    },
    30_000,
  );

  run(
    `${backend} retains the destination set flag for both directions of a successful copy`,
    async () => {
      const oracle = independent(flagProbe);
      await withCells(backend, ({ raw, kit }, own) => {
        const src = own(kit.newIntCell(4)),
          dst = own(kit.newIntCell(4));
        for (const n of [-9, 7, 7]) raw.appndi(n, src);
        // Remove the duplicate first, so every membership search has sorted
        // unique data even when the retained descriptor flag is true.
        raw.scard(2, src);
        const nonset = toolkitShort(() => raw.elemi(7, src));
        raw.copy(src, dst);
        const good = [
          [kit.cellGeti(dst, 0), kit.cellGeti(dst, 1)],
          raw.elemi(-9, dst),
          raw.elemi(7, dst),
          raw.elemi(0, dst),
        ];
        raw.copy(dst, src);
        const stillNonset = toolkitShort(() => raw.elemi(7, src));
        expect(raw.failed()).toBe(false);
        raw.valid(4, 2, src);
        expect([nonset, good, stillNonset, raw.elemi(7, src)]).toEqual(oracle);
      });
    },
    30_000,
  );

  run(
    `${backend} preserves infinities and signed zero in double append, membership, and copy`,
    async () => {
      const oracle = independent(doubleProbe);
      await withCells(backend, ({ raw, kit }, own) => {
        const src = own(kit.newDoubleCell(4)),
          dest = own(kit.newDoubleCell(6));
        const values = [-Infinity, -0, 1e-300, Infinity];
        for (const value of values) raw.appndd(value, src);
        raw.copy(src, dest);
        raw.copy(dest, dest);
        const error = toolkitShort(() => raw.appndd(0, src));
        raw.scard(0, src);
        raw.appndd(0, src);
        expect(() => raw.appndd(NaN, src)).toThrow();
        expect(() => raw.elemd(NaN, dest)).toThrow();
        expect(raw.failed()).toBe(false);
        const tag = (n: number) =>
          n === Infinity
            ? "+Inf"
            : n === -Infinity
              ? "-Inf"
              : Object.is(n, -0)
                ? "-0"
                : n;
        const read = (cell: typeof src) =>
          Array.from({ length: raw.card(cell) }, (_, i) =>
            tag(kit.cellGetd(cell, i)),
          );
        const members = [...values, 0, 1.5, -1.5].map((v) =>
          raw.elemd(v, dest),
        );
        expect([error, [read(dest), members], read(src)]).toEqual(oracle);
      });
    },
    30_000,
  );
}
