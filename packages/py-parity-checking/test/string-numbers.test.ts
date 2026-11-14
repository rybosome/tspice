import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const project = path.resolve(import.meta.dirname, "../sidecars/spiceypy");
function python(program: string): unknown {
  return JSON.parse(
    execFileSync(
      "uv",
      ["run", "--locked", "--project", project, "python", "-c", program],
      { encoding: "utf8", timeout: 15000 },
    ),
  );
}

describe("public numeric string evidence", () => {
  it("cross-checks the typed literal symbols with ordinary locked high-level wrappers", () => {
    expect(
      python(`
import json, spiceypy as sp
from py_parity_sidecar import numeric_oracle as o
assert not hasattr(sp, "repml")
assert o.dp2hx(-15.5,None)["hxstr"] == sp.dp2hx(-15.5)
assert o.hx2dp("F^-2",80)["number"] == sp.hx2dp("F^-2")
a=("x#z","#")
assert o.repmc(*a, "abc", 40)==sp.repmc(*a, "abc",40)
assert o.repmct(*a, -23, "C", 100)==sp.repmct(*a,-23,"C",100)
assert o.repmd(*a, 12.125, 5, 40)==sp.repmd(*a,12.125,5)
assert o.repmf(*a, 12.125,5,"F",40)==sp.repmf(*a,12.125,5,"F",40)
assert o.repmi(*a,-12,40)==sp.repmi(*a,-12,40)
assert o.repmot(*a,23,"l",100)==sp.repmot(*a,23,"l",100)
print(json.dumps(o.repml(*a,False,"C",40)))
`),
    ).toBe("xFalsez");
  });
  for (const backend of ["node", "wasm"] as const) {
    const test = it.runIf(backend !== "node" || nodeBackendAvailable);
    test(`${backend} preserves full binary64 encodings, truncation, and bit-exact round trips`, async () => {
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        const values = [
          0,
          -0,
          -1,
          Number.MIN_VALUE,
          2 ** -1022,
          0.1,
          -Math.PI,
          Number.MAX_VALUE,
        ];
        const expected = python(`
import json,math,sys
from py_parity_sidecar import numeric_oracle as o
v=[0.,-0.,-1.,float.fromhex("0x0.0000000000001p-1022"),sys.float_info.min,.1,-math.pi,sys.float_info.max]
print(json.dumps([o.dp2hx(x,None) for x in v]))
`);
        expect(values.map((v) => spice.raw.dp2hx(v))).toEqual(expected);
        for (const v of values) {
          const encoded = spice.raw.dp2hx(v),
            short = spice.raw.dp2hx(v, 2);
          expect(short).toEqual({
            hxstr: encoded.hxstr.slice(0, 1),
            hxssiz: encoded.hxssiz,
          });
          const out = spice.raw.hx2dp(encoded.hxstr);
          expect(out.error).toBe(false);
          if (!out.error) expect(out.number).toBe(v === 0 ? 0 : v);
        }
      } finally {
        await dispose();
      }
    });
    test(`${backend} returns canonical overflow or underflow at bounded-equivalent extreme exponents`, async () => {
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        const actual = [
          "1^7fffffff",
          "-1^7fffffff",
          "0^7fffffff",
          "1^-80000000",
          "ABC^-7fffffff",
        ].map((s) => spice.raw.hx2dp(s));
        const expected = python(`
import json
from py_parity_sidecar import numeric_oracle as o
print(json.dumps([o.hx2dp(s,None) for s in ("1^400","-1^400","0^400","1^-400","ABC^-400")]))
`);
        expect(actual).toEqual(expected);
        expect(spice.raw.hx2dp("1^100000000").error).toBe(true);
      } finally {
        await dispose();
      }
    });
    test(`${backend} checks matched INT_MIN word conversions and strict UTF-8 boundaries, then recovers`, async () => {
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        for (const n of ["repmct", "repmot"] as const) {
          expect(() => spice.raw[n](" # ", " # ", -2147483648, "L")).toThrow(
            /INT32_MIN/,
          );
          expect(spice.raw[n]("unmatched", "#", -2147483648, "C")).toBe(
            "unmatched",
          );
          expect(spice.raw[n]("#", "#", -2147483648, "Z", 1)).toBe("");
          expect(() => spice.raw[n]("#", "#", -2147483648, "Z", 8)).toThrow(
            /INVALIDCASE/,
          );
        }
        expect(() => spice.raw.repmc("#", "#", "é", 2)).toThrow(TypeError);
        expect(() => spice.raw.hx2dp("é^1")).toThrow(TypeError);
        expect(spice.raw.repmc("#", "#", "é", 3)).toBe("é");
        expect(spice.raw.repmi("#", "#", -2147483648)).toBe("-2147483648");
        expect(spice.raw.hx2dp("1^1")).toEqual({
          error: false,
          errmsg: "",
          number: 1,
        });
      } finally {
        await dispose();
      }
    });
  }
});
