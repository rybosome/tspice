import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const pkg = fileURLToPath(new URL("../", import.meta.url));
const fixture = path.join(pkg, "fixtures/kernels/audit-pool-operations.tpc");
const partial = path.join(pkg, "fixtures/kernels/audit-partial-error.tpc");

function locked(script: string): unknown {
  const output = execFileSync(
    "uv",
    [
      "run",
      "--locked",
      "--project",
      path.join(pkg, "sidecars/spiceypy"),
      "python",
      "-c",
      "import ctypes as c, json, sys, spiceypy as sp\nsp.kclear()\ntry:\n" +
        script
          .trim()
          .split("\n")
          .map((line) => "    " + line)
          .join("\n") +
        "\nfinally:\n    sp.kclear()\n",
      fixture,
      partial,
    ],
    { encoding: "utf8" },
  );
  return JSON.parse(output);
}

function diagnostic(call: () => unknown) {
  try {
    call();
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    const short: unknown = Reflect.get(error, "spiceShort");
    const long: unknown = Reflect.get(error, "spiceLong");
    const trace: unknown = Reflect.get(error, "spiceTrace");
    if (
      typeof short !== "string" ||
      typeof long !== "string" ||
      typeof trace !== "string"
    )
      throw error;
    return { short, long, trace };
  }
  throw new Error("expected a structured toolkit error");
}

describe("kernel pool file, memory, value and watcher semantics", () => {
  for (const backend of ["wasm", "node"] as const) {
    const test = it.runIf(backend === "wasm" || nodeBackendAvailable);

    test(
      backend +
        " retains the independent BADKPV caller trace and recovers twice",
      async () => {
        const expected = locked(`
sp.pdpool("B05_TRACE", [2,-3,4,1])
sp.chkin("B05_PARENT")
out=[]
try:
    for op,typ in [(">=","N"),("=","C")]:
        try:
            sp.badkpv("SCIENTIFIC_CALLER", "B05_TRACE", op, 4, 2, typ)
            raise AssertionError("BADKPV must signal")
        except sp.utils.exceptions.SpiceyError as error:
            out.append({"short":error.short, "long":error.long, "trace":error.traceback})
        out.extend([sp.failed(), sp.badkpv("SCIENTIFIC_CALLER","B05_TRACE","=>",4,-2,"n")])
finally:
    sp.chkout("B05_PARENT")
print(json.dumps(out))
`);
        const setup = await spiceClients.toSync({ backend });
        const raw = setup.spice.raw;
        try {
          raw.kclear();
          raw.pdpool("B05_TRACE", [2, -3, 4, 1]);
          raw.chkin("B05_PARENT");
          const seen: unknown[] = [];
          try {
            for (const [op, type] of [
              [">=", "N"],
              ["=", "C"],
            ] as const) {
              seen.push(
                diagnostic(() =>
                  raw.badkpv("SCIENTIFIC_CALLER", "B05_TRACE", op, 4, 2, type),
                ),
              );
              seen.push(
                raw.failed(),
                raw.badkpv("SCIENTIFIC_CALLER", "B05_TRACE", "=>", 4, -2, "n"),
              );
            }
          } finally {
            raw.chkout("B05_PARENT");
          }
          expect(seen).toEqual(expected);
        } finally {
          try {
            raw.kclear();
          } finally {
            await setup.dispose();
          }
        }
      },
    );

    test(
      backend +
        " exposes committed input rows and watcher state after malformed loads",
      async () => {
        const expected = locked(`
out=[]
for filemode in (False,True):
    sp.kclear()
    variable = "AUDIT_PARTIAL_VALUE" if filemode else "B05_PREFIX"
    sp.swpool("B05_PREFIX_WATCH",1,len(variable)+1,[variable])
    sp.cvpool("B05_PREFIX_WATCH")
    try:
        if filemode:
            sp.ldpool(sys.argv[2])
        else:
            sp.lmpool(["B05_PREFIX = ( -11 3.5 )","B05_INVALID = ( 4 NONNUMERIC )"])
        raise AssertionError("expected parse error")
    except sp.utils.exceptions.SpiceyError as e:
        out.append(e.short)
    out.extend([sp.failed(),list(sp.gdpool(variable,0,3)),sp.cvpool("B05_PREFIX_WATCH"),sp.ktotal("ALL")])
    sp.ldpool(sys.argv[1])
    out.append(list(sp.gdpool("B05_TRACK",0,2)))
print(json.dumps(out))
`);
        const setup = await spiceClients.toSync({ backend });
        const raw = setup.spice.raw;
        try {
          const results: unknown[] = [];
          for (const filemode of [false, true]) {
            raw.kclear();
            const name = filemode ? "AUDIT_PARTIAL_VALUE" : "B05_PREFIX";
            raw.swpool("B05_PREFIX_WATCH", [name]);
            raw.cvpool("B05_PREFIX_WATCH");
            const load = filemode
              ? () =>
                  raw.ldpool({
                    path: "bad-pool.tpc",
                    bytes: readFileSync(partial),
                  })
              : () =>
                  raw.lmpool([
                    "B05_PREFIX = ( -11 3.5 )",
                    "B05_INVALID = ( 4 NONNUMERIC )",
                  ]);
            results.push(diagnostic(load).short);
            const values = raw.gdpool(name, 0, 3);
            results.push(
              raw.failed(),
              values.found ? values.values : null,
              raw.cvpool("B05_PREFIX_WATCH"),
              raw.ktotal("ALL"),
            );
            raw.ldpool({
              path: "pool-fixture.tpc",
              bytes: readFileSync(fixture),
            });
            const recovered = raw.gdpool("B05_TRACK", 0, 2);
            results.push(recovered.found ? recovered.values : null);
          }
          expect(results).toEqual(expected);
        } finally {
          try {
            raw.kclear();
          } finally {
            await setup.dispose();
          }
        }
      },
    );

    test(
      backend +
        " returns owned, dimension-limited body arrays and exact tiny components",
      async () => {
        const expected = locked(`
sp.ldpool(sys.argv[1])
out=[]
for body in [399,"eArTh","  POOL   TEST  BODY ","-707007"]:
    fn=sp.bodvcd if isinstance(body,int) else sp.bodvrd
    n,v=fn(body,"B05",11)
    out.append({"dim":n,"values":list(v[:n])})
sp.pdpool("BODY399_B05",[2.0**-600,-2.0**-601])
n,v=sp.bodvcd(399,"B05",4)
out.append({"dim":n,"values":list(v[:n])})
# These ordinary malformed tables have no minimum integer or rounding-to-minimum code.
for name,code in [("B05 OVERRANGE",2**31),(" ",77)]:
    sp.pcpool("NAIF_BODY_NAME",[name])
    sp.pdpool("NAIF_BODY_CODE",[code])
    try:
        sp.bodvrd("earth","B05",4)
        raise AssertionError("expected mapping table error")
    except sp.utils.exceptions.SpiceyError as e:
        out.append(e.short)
    out.append(sp.failed())
sp.pcpool("NAIF_BODY_NAME",["B05 RESTORED"])
sp.pipool("NAIF_BODY_CODE",[399])
n,v=sp.bodvrd("B05 RESTORED","B05",4)
out.append({"dim":n,"values":list(v[:n])})
print(json.dumps(out))
`);
        const setup = await spiceClients.toSync({ backend });
        const raw = setup.spice.raw;
        try {
          raw.kclear();
          raw.ldpool({ path: "body-values.tpc", bytes: readFileSync(fixture) });
          const initial = raw.bodvcd(399, "B05", 11);
          const current = raw.bodvrd("eArTh", "B05", 11);
          const named = raw.bodvrd("  POOL   TEST  BODY ", "B05", 11);
          const numeric = raw.bodvrd("-707007", "B05", 11);
          const mutable = raw.bodvrd(" earth ", "B05", 4);
          mutable.values[0] = 222;
          raw.pdpool("BODY399_B05", [2 ** -600, -(2 ** -601)]);
          const observed: unknown[] = [
            initial,
            current,
            named,
            numeric,
            raw.bodvcd(399, "B05", 4),
          ];
          for (const [name, code] of [
            ["B05 OVERRANGE", 2 ** 31],
            [" ", 77],
          ] as const) {
            raw.pcpool("NAIF_BODY_NAME", [name]);
            raw.pdpool("NAIF_BODY_CODE", [code]);
            observed.push(
              diagnostic(() => raw.bodvrd("earth", "B05", 4)).short,
              raw.failed(),
            );
          }
          raw.pcpool("NAIF_BODY_NAME", ["B05 RESTORED"]);
          raw.pipool("NAIF_BODY_CODE", [399]);
          observed.push(raw.bodvrd("B05 RESTORED", "B05", 4));
          expect(observed).toEqual(expected);
          expect(raw.failed()).toBe(false);
        } finally {
          try {
            raw.kclear();
          } finally {
            await setup.dispose();
          }
        }
      },
    );

    test(
      backend +
        " preserves the STPOOL C bytes and reports length before truncation",
      async () => {
        const expected = locked(`
# Pass valid UTF-8 in a byte-sized memory row to avoid the wrapper's character-count stride.
row="B05_UTF = 'café'".encode()
sp.libspice.lmpool_c(c.create_string_buffer(row),len(row)+1,1)
sp.check_for_spice_error(None)
sp.pcpool("B05_EXACT",["alpha+"," beta"," ","tab\\t","last+"])
out=[]
for key,n,cap in ([("B05_EXACT",i,k) for i,k in [(0,3),(0,11),(1,2),(2,9),(3,9),(4,9)]]+
                  [("B05_UTF",0,4),("B05_UTF",0,6)]):
    buf=c.create_string_buffer(cap)
    length,found=c.c_int(),c.c_int()
    sp.libspice.stpool_c(key.encode(),n,b"+",cap,buf,c.byref(length),c.byref(found))
    sp.check_for_spice_error(None)
    out.append({"found":True,"nthstr":buf.value.decode(),"size":length.value} if found.value else {"found":False})
print(json.dumps(out))
`);
        const setup = await spiceClients.toSync({ backend });
        const raw = setup.spice.raw;
        try {
          raw.kclear();
          raw.lmpool(["B05_UTF = 'café'"]);
          raw.pcpool("B05_EXACT", ["alpha+", " beta", " ", "tab\t", "last+"]);
          const requests = [
            [0, 3],
            [0, 11],
            [1, 2],
            [2, 9],
            [3, 9],
            [4, 9],
          ] as const;
          const observed = requests.map(([n, cap]) =>
            raw.stpool("B05_EXACT", n, "+", cap),
          );
          observed.push(
            raw.stpool("B05_UTF", 0, "+", 4),
            raw.stpool("B05_UTF", 0, "+", 6),
          );
          expect(observed).toEqual(expected);
          // A partial UTF-8 scalar cannot be represented by the JS result.
          expect(() => raw.stpool("B05_UTF", 0, "+", 5)).toThrow();
          expect(raw.stpool("B05_EXACT", 2147483647, "+", 3)).toEqual({
            found: false,
          });
          expect(raw.failed()).toBe(false);
        } finally {
          try {
            raw.kclear();
          } finally {
            await setup.dispose();
          }
        }
      },
    );
  }
});
