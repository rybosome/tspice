import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { spiceClients, type SpiceSync } from "@rybosome/tspice";
import { expect, it } from "vitest";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const fixturePath = path.resolve(
  import.meta.dirname,
  "../fixtures/kernels/surface-translation.tpc",
);
const fixture = {
  path: "surface-translation.tpc",
  bytes: fs.readFileSync(fixturePath),
};
const project = path.resolve(import.meta.dirname, "../sidecars/spiceypy");
const names = "NAIF_SURFACE_NAME",
  codes = "NAIF_SURFACE_CODE",
  bodies = "NAIF_SURFACE_BODY";

function independent(script: string): unknown {
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
        script,
        fixturePath,
      ],
      { encoding: "utf8", timeout: 20_000 },
    ),
  );
}

const common = `
import json,sys
import spiceypy as sp
from spiceypy.utils.exceptions import SpiceyError
from py_parity_sidecar.surface_oracle import exact_surface_text,surface_code

name_var,code_var,body_var="NAIF_SURFACE_NAME","NAIF_SURFACE_CODE","NAIF_SURFACE_BODY"
fixture=sys.argv[1]

def text(number,body,cap=37):
    value,flag=exact_surface_text(number,body,cap)
    return {"surface":value,"isName":flag}

def lookup(surface,body):
    value,flag=surface_code(surface,body)
    return {"found":True,"code":value} if flag else {"found":False}

def state():
    return [text(91,399),text(91,"EARTH"),lookup("alias",399),lookup("alias","EARTH")]

sp.reset()
sp.kclear()
`;
const lifecycleProbe =
  common +
  `
try:
    observations=[state()]
    sp.furnsh(fixture)
    observations.append(state())
    sp.pcpool(code_var,["wrong"])
    try: text(91,399)
    except SpiceyError as err: observations.append(err.short)
    else: raise AssertionError("Expected BADVARIABLETYPE")
    # A pool change consumes the notification before the failed rebuild.
    # On this particular wrong-type update the saved lookup tables survive.
    observations.append(state())
    sp.pcpool(name_var,["New alias"])
    sp.pipool(code_var,[91])
    sp.pipool(body_var,[399])
    observations.append(state())
    observations.append(lookup("New alias","EARTH"))
    sp.unload(fixture)
    observations.append(state())
    sp.furnsh(fixture)
    observations.append(state())
    sp.kclear()
    observations.append(state())
    print(json.dumps(observations))
finally:
    sp.reset()
    sp.kclear()
`;
const textProbe =
  common +
  `
try:
    # An ASCII companion name keeps SpiceyPy 6.0.3's input row width large
    # enough for the first name's UTF-8 bytes, including its terminator.
    name="\\ufeffMiXé\\t"
    sp.pcpool(name_var,[name,"-17","ASCII padding for encoded input"])
    sp.pipool(code_var,[517,518,519])
    sp.pipool(body_var,[399,399,399])
    outputs=[]
    for body in (399,"EARTH"):
        for cap in (4,7,9,10,37):
            outputs.append(text(517,body,cap))
        outputs.extend([text(518,body),text(-17,body),lookup(name,body),lookup("-17",body)])
        try: text(517,body,8)
        except UnicodeDecodeError: pass
        else: raise AssertionError("C output terminates inside UTF-8 é")
    with sp.no_found_check():
        wrapper=[sp.srfc2s(517,399,37),sp.srfcss(517,"EARTH",37)]
    print(json.dumps({"outputs":outputs,"wrapper":wrapper}))
finally:
    sp.reset()
    sp.kclear()
`;

function canonicalError(call: () => unknown): string {
  try {
    call();
  } catch (error) {
    if (typeof error === "object" && error !== null) {
      const short: unknown = Reflect.get(error, "spiceShort");
      if (typeof short === "string") return short;
    }
    throw error;
  }
  throw new Error("Expected a CSPICE error");
}

async function withCleanPool(
  backend: "node" | "wasm",
  f: (raw: SpiceSync["raw"]) => void,
) {
  const { spice, dispose } = await spiceClients.toSync({ backend });
  try {
    spice.raw.reset();
    spice.raw.kclear();
    f(spice.raw);
  } finally {
    try {
      spice.raw.reset();
      spice.raw.kclear();
    } finally {
      await dispose();
    }
  }
}

it("protects the locked surface oracle before dispatch and preserves CSPICE's defined errors", () => {
  const result = independent(
    common +
      `
from contextlib import ExitStack
from unittest.mock import patch
from py_parity_sidecar import surface_oracle as oracle

# The four translation callables are unreachable in this guard test. Both
# pool introspection calls stay live; the table is cleared before unpatching.
with ExitStack() as stack:
    translations=[stack.enter_context(patch.object(target,method,side_effect=AssertionError("unexpected translation dispatch"))) for target,method in [(oracle,"_c2s"),(oracle,"_css"),(sp,"srfs2c"),(sp,"srfscc")]]
    guarded=0
    try:
        for body in (399,"EARTH"):
            try: text(-(2**31),body)
            except ValueError as err:
                assert "surface hash range" in str(err)
                guarded+=1
            else: raise AssertionError("Direct query was not guarded")
        sp.pcpool(name_var,["test"])
        sp.pipool(body_var,[399])
        for value in (-2147483648,-2147483647.75,-2147483647.5):
            sp.pdpool(code_var,[value])
            for body in (399,"EARTH"):
                for call in (lambda:text(7,body),lambda:lookup("test",body)):
                    try: call()
                    except ValueError as err:
                        assert "NAIF_SURFACE_CODE" in str(err)
                        guarded+=1
                    else: raise AssertionError("Pool guard did not run")
    finally:
        sp.reset()
        sp.kclear()
    assert not any(mock.called for mock in translations)

try:
    # GIPOOL diagnoses strictly out-of-range doubles before conversion.
    sp.pcpool(name_var,["OK"]);sp.pipool(body_var,[399]);sp.pdpool(code_var,[2147483648.0])
    try: text(91,399)
    except SpiceyError as err: outside=err.short
    else: raise AssertionError("Expected a canonical range error")
    sp.pdpool(code_var,[-2147483647.49])
    sp.pipool(body_var,[-2147483648])
    print(json.dumps([guarded,outside,text(-2147483647,-2147483648),lookup("OK",-2147483648)]))
finally:
    sp.reset()
    sp.kclear()
`,
  );
  expect(result).toEqual([
    14,
    "SPICE(INTOUTOFRANGE)",
    { surface: "OK", isName: true },
    { found: true, code: -2147483647 },
  ]);
}, 25_000);

for (const backend of ["node", "wasm"] as const) {
  const run = backend === "node" ? it.runIf(nodeBackendAvailable) : it;
  run(
    `${backend} matches the live fixture across load, malformed pool refresh, replacement, unload and reload`,
    async () => {
      const oracle = independent(lifecycleProbe);
      await withCleanPool(backend, (raw) => {
        const state = () => [
          raw.srfc2s(91, 399),
          raw.srfcss(91, "EARTH"),
          raw.srfscc("alias", 399),
          raw.srfs2c("alias", "EARTH"),
        ];
        const observed: unknown[] = [state()];
        raw.furnsh(fixture);
        observed.push(state());
        raw.pcpool(codes, ["wrong"]);
        observed.push(canonicalError(() => raw.srfc2s(91, 399)));
        expect(raw.failed()).toBe(false);
        observed.push(state());
        raw.pcpool(names, ["New alias"]);
        raw.pipool(codes, [91]);
        raw.pipool(bodies, [399]);
        observed.push(state(), raw.srfs2c("New alias", "EARTH"));
        raw.unload(fixture.path);
        observed.push(state());
        expect(raw.ktotal("ALL")).toBe(0);
        raw.furnsh(fixture);
        observed.push(state());
        raw.kclear();
        observed.push(state());
        expect(raw.expool(codes)).toBe(false);
        expect(observed).toEqual(oracle);
      });
    },
    25_000,
  );

  run(
    `${backend} keeps UTF-8 BOM, terminal tab, numeric-name flags and unrepresentable byte cuts`,
    async () => {
      const oracle = independent(textProbe);
      await withCleanPool(backend, (raw) => {
        const spelling = "\ufeffMiXé\t";
        raw.pcpool(names, [spelling, "-17", "ASCII padding for encoded input"]);
        raw.pipool(codes, [517, 518, 519]);
        raw.pipool(bodies, [399, 399, 399]);
        const outputs = [];
        for (const body of [399, "EARTH"] as const) {
          const read = (n: number, cap = 37) =>
            typeof body === "number"
              ? raw.srfc2s(n, body, cap)
              : raw.srfcss(n, body, cap);
          const lookup = (name: string) =>
            typeof body === "number"
              ? raw.srfscc(name, body)
              : raw.srfs2c(name, body);
          for (const cap of [4, 7, 9, 10, 37]) outputs.push(read(517, cap));
          outputs.push(read(518), read(-17), lookup(spelling), lookup("-17"));
          expect(() => read(517, 8)).toThrow(TypeError);
          expect(read(517)).toEqual({ surface: spelling, isName: true });
        }
        // SpiceyPy's ordinary high-level output conversion strips the trailing
        // tab. Its exact C buffer is available through the independent oracle.
        expect(oracle).toEqual({
          outputs,
          wrapper: [
            ["\ufeffMiXé", true],
            ["\ufeffMiXé", true],
          ],
        });
      });
    },
    25_000,
  );

  run(
    `${backend} observes real surface table size and integer-conversion errors, then restores safe mappings`,
    async () => {
      const reference = independent(
        common +
          `
try:
    sp.pcpool(name_var,["OK"]);sp.pipool(body_var,[399])
    errors=[]
    for values in ([1]*2001,[2147483648.0],[-2147483649.0]):
        sp.pdpool(code_var,values)
        try: text(91,399)
        except SpiceyError as err: errors.append(err.short)
        else: raise AssertionError("Expected toolkit validation error")
    sp.pdpool(code_var,[-2147483647.49]);sp.pipool(body_var,[-2147483648])
    print(json.dumps([errors,text(-2147483647,-2147483648),lookup("OK",-2147483648),lookup("-2147483648",399)]))
finally:
    sp.reset()
    sp.kclear()
`,
      );
      await withCleanPool(backend, (raw) => {
        raw.pcpool(names, ["OK"]);
        raw.pipool(bodies, [399]);
        const errors: string[] = [];
        for (const values of [
          Array<number>(2001).fill(1),
          [2147483648],
          [-2147483649],
        ]) {
          raw.pdpool(codes, values);
          errors.push(canonicalError(() => raw.srfc2s(91, 399)));
          expect(raw.failed()).toBe(false);
        }
        raw.pdpool(codes, [-2147483647.49]);
        raw.pipool(bodies, [-2147483648]);
        const actual = [
          errors,
          raw.srfc2s(-2147483647, -2147483648),
          raw.srfscc("OK", -2147483648),
          raw.srfscc("-2147483648", 399),
        ];
        expect(errors).toEqual([
          "SPICE(TOOMANYSURFACES)",
          "SPICE(INTOUTOFRANGE)",
          "SPICE(INTOUTOFRANGE)",
        ]);
        expect(actual).toEqual(reference);
      });
    },
    25_000,
  );
}
