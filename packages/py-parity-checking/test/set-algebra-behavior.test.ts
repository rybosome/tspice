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
from py_parity_sidecar.set_algebra_oracle import write_result

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

const writers = ["diff", "inter", "sdiff", "union"] as const;

const partialProbe = `
observations = []
for kind, make, append, ordinal, conv in [
    ("char", lambda n: SPICECHAR_CELL(n,12), sp.appndc, sp.ordc, str),
    ("int", SPICEINT_CELL, sp.appndi, sp.ordi, int),
    ("double", SPICEDOUBLE_CELL, sp.appndd, sp.ordd, float),
]:
    for name in ("diff","inter","sdiff","union"):
        a,b,out = make(6),make(6),make(2)
        for x in [1,2,3,4]: append(conv(x),a)
        for x in ([1,2,3] if name=="inter" else [5]): append(conv(x),b)
        # Duplicate append clears the flag. Shrinking to one retains the flag.
        append(conv(8),out);append(conv(8),out);sp.scard(1,out)
        assert short(lambda: ordinal(conv(8),out)) == "SPICE(NOTASET)"
        failure = short(lambda: write_result("cells-windows."+name,a,b,out))
        visible = [sp.card(out),list(out),ordinal(conv(1),out)]
        # On SETEXCESS two fitting slots have actually been written.
        sp.scard(2,out)
        prefix = list(out)
        sp.scard(0,out);sp.scard(0,b);append(conv(1),b)
        write_result("cells-windows.inter",a,b,out)
        observations.append([failure,visible,prefix,list(out),list(a),list(b)])
print(json.dumps(observations))
`;

function partialFailures<T extends Cell, V extends string | number>(
  raw: SpiceSync["raw"],
  make: (size: number) => T,
  append: (v: V, c: T) => void,
  ordinal: (v: V, c: T) => number,
  get: (c: T, i: number) => V,
  write: (method: (typeof writers)[number], a: T, b: T, r: T) => void,
  convert: (value: number) => V,
) {
  const read = (c: T) =>
    Array.from({ length: raw.card(c) }, (_, i) => get(c, i));
  return writers.map((name) => {
    const a = make(6),
      b = make(6),
      r = make(2);
    for (const n of [1, 2, 3, 4]) append(convert(n), a);
    for (const n of name === "inter" ? [1, 2, 3] : [5]) append(convert(n), b);
    append(convert(8), r);
    append(convert(8), r);
    raw.scard(1, r);
    expect(toolkitShort(() => ordinal(convert(8), r))).toBe("SPICE(NOTASET)");
    const failure = toolkitShort(() => write(name, a, b, r));
    expect(failure).toBe("SPICE(SETEXCESS)");
    const visible = [raw.card(r), read(r), ordinal(convert(1), r)];
    expect(visible).toEqual([1, [convert(1)], 0]);
    raw.scard(2, r);
    const prefix = read(r);
    expect(prefix).toEqual([convert(1), convert(2)]);
    raw.scard(0, r);
    raw.scard(0, b);
    append(convert(1), b);
    write("inter", a, b, r);
    expect(raw.failed()).toBe(false);
    return [failure, visible, prefix, read(r), read(a), read(b)];
  });
}

const ieeeProbe = `
def tag(x):
    if math.isinf(x): return "+Infinity" if x>0 else "-Infinity"
    if x==0 and math.copysign(1,x)<0: return "-0"
    return x
a,b,r = [SPICEDOUBLE_CELL(12) for _ in range(3)]
for x in [-math.inf,-0.,5e-324,1.,math.inf]: sp.appndd(x,a)
for x in [-1.,0.,math.nextafter(1.,math.inf),math.inf]: sp.appndd(x,b)
rows=[]
for name in ("diff","inter","sdiff","union"):
    for x,y in ((a,b),(b,a)):
        write_result("cells-windows."+name,x,y,r)
        result = [tag(v) for v in r]
        assert result == [tag(v) for v in getattr(sp,name)(x,y)]
        rows.append(result)
positions=[sp.ordd(x,a) for x in [-math.inf,0.,5e-324,1.,math.nextafter(1.,math.inf),math.inf]]
sp.removd(0.,a);sp.removd(math.inf,a);sp.removd(math.inf,a)
print(json.dumps([rows,positions,[tag(v) for v in a]],allow_nan=False))
`;

const textProbe = String.raw`
a,b,r = [SPICECHAR_CELL(8,12) for _ in range(3)]
for x in [" A","B\t","M   ","Z"]: sp.appndc(x,a)
for x in ["B\t","M","X"]: sp.appndc(x,b)
queries=[" A","A","B","B\t","M","M   ","X","Z"]
observations=[]
for name in ("diff","inter","sdiff","union"):
    write_result("cells-windows."+name,a,b,r)
    auto=getattr(sp,name)(a,b)
    row=[sp.ordc(x,r) for x in queries]
    assert row==[sp.ordc(x,auto) for x in queries]
    observations.append([list(r),row])
sp.removc("B",r); before=sp.ordc("B\t",r)
sp.removc("B\t",r); after=sp.ordc("B\t",r)
sp.scard(0,a);sp.scard(0,b)
print(json.dumps([observations,before,after,list(r)]))
`;

for (const backend of ["node", "wasm"] as const) {
  const run = backend === "node" ? it.runIf(nodeBackendAvailable) : it;
  run(
    `${backend} retains the bounded SETEXCESS prefix and new set flag independently for all writers and cell types`,
    async () => {
      const oracle = independent(partialProbe);
      await withCells(backend, ({ raw, kit }, own) => {
        const rows = [
          ...partialFailures(
            raw,
            (n) => own(kit.newCharCell(n, 12)),
            raw.appndc,
            raw.ordc,
            kit.cellGetc,
            (m, a, b, r) => raw[m](a, b, r),
            String,
          ),
          ...partialFailures(
            raw,
            (n) => own(kit.newIntCell(n)),
            raw.appndi,
            raw.ordi,
            kit.cellGeti,
            (m, a, b, r) => raw[m](a, b, r),
            Number,
          ),
          ...partialFailures(
            raw,
            (n) => own(kit.newDoubleCell(n)),
            raw.appndd,
            raw.ordd,
            kit.cellGetd,
            (m, a, b, r) => raw[m](a, b, r),
            Number,
          ),
        ];
        expect(rows).toEqual(oracle);
      });
    },
    30_000,
  );
  run(
    `${backend} compares both operand orders exactly at signed zero, infinities, the smallest subnormal and adjacent values`,
    async () => {
      const oracle = independent(ieeeProbe);
      await withCells(backend, ({ raw, kit }, own) => {
        const a = own(kit.newDoubleCell(12)),
          b = own(kit.newDoubleCell(12)),
          r = own(kit.newDoubleCell(12));
        const query = [
          -Infinity,
          0,
          Number.MIN_VALUE,
          1,
          1 + Number.EPSILON,
          Infinity,
        ];
        for (const x of [-Infinity, -0, Number.MIN_VALUE, 1, Infinity])
          raw.appndd(x, a);
        for (const x of [-1, 0, 1 + Number.EPSILON, Infinity]) raw.appndd(x, b);
        const tag = (x: number) =>
          x === Infinity
            ? "+Infinity"
            : x === -Infinity
              ? "-Infinity"
              : Object.is(x, -0)
                ? "-0"
                : x;
        const read = (c: typeof r) =>
          Array.from({ length: raw.card(c) }, (_, i) =>
            tag(kit.cellGetd(c, i)),
          );
        const rows = [];
        for (const name of writers)
          for (const [x, y] of [
            [a, b],
            [b, a],
          ] as const) {
            raw[name](x, y, r);
            rows.push(read(r));
          }
        const ordinals = query.map((x) => raw.ordd(x, a));
        raw.removd(0, a);
        raw.removd(Infinity, a);
        raw.removd(Infinity, a);
        expect([rows, ordinals, read(a)]).toEqual(oracle);
      });
    },
    30_000,
  );
  run(
    `${backend} distinguishes stored trailing tabs from trimmed kit display and retains the independent result after clearing inputs`,
    async () => {
      const oracle = independent(textProbe);
      await withCells(backend, ({ raw, kit }, own) => {
        const a = own(kit.newCharCell(8, 12)),
          b = own(kit.newCharCell(8, 12)),
          r = own(kit.newCharCell(8, 12));
        for (const x of [" A", "B\t", "M   ", "Z"]) raw.appndc(x, a);
        for (const x of ["B\t", "M", "X"]) raw.appndc(x, b);
        const read = () =>
          Array.from({ length: raw.card(r) }, (_, i) => kit.cellGetc(r, i));
        const queries = [" A", "A", "B", "B\t", "M", "M   ", "X", "Z"];
        const rows = [];
        for (const n of writers) {
          raw[n](a, b, r);
          rows.push([read(), queries.map((x) => raw.ordc(x, r))]);
        }
        raw.removc("B", r);
        const before = raw.ordc("B\t", r);
        raw.removc("B\t", r);
        const after = raw.ordc("B\t", r);
        raw.scard(0, a);
        raw.scard(0, b);
        expect([rows, before, after, read()]).toEqual(oracle);
      });
    },
    30_000,
  );
}
