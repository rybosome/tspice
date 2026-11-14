import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { spiceClients, type SpiceSync } from "@rybosome/tspice";
import { expect, it } from "vitest";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const fixturePath = path.resolve(
  import.meta.dirname,
  "../fixtures/kernels/audit-two-partition.tsc",
);
const fixture = {
  path: path.basename(fixturePath),
  bytes: fs.readFileSync(fixturePath),
};
const project = path.resolve(import.meta.dirname, "../sidecars/spiceypy");
const sc = -12345;
const startsKey = "SCLK_PARTITION_START_12345";
const stopsKey = "SCLK_PARTITION_END_12345";
const caller = "D02_CALLER";

function independent(program: string): unknown {
  const common = `
import json, math, sys
import spiceypy as sp
from spiceypy.utils.exceptions import SpiceyError
from py_parity_sidecar import sclk_oracle as oracle
from unittest.mock import patch
sc=-12345
fixture=sys.argv[1]
def diagnostic(call):
    try:
        call()
        sp.check_for_spice_error(None)
    except SpiceyError as err:
        return {"short":err.short,"long":err.long,"trace":err.traceback}
    raise AssertionError("Expected CSPICE diagnostic")
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
        common + program,
        fixturePath,
      ],
      { encoding: "utf8", timeout: 20_000 },
    ),
  );
}

function diagnostic(call: () => unknown) {
  try {
    call();
  } catch (err) {
    if (
      !(err instanceof Error) ||
      typeof Reflect.get(err, "spiceShort") !== "string"
    )
      throw err;
    return {
      short: Reflect.get(err, "spiceShort"),
      long: Reflect.get(err, "spiceLong") ?? "",
      trace: Reflect.get(err, "spiceTrace") ?? "",
    };
  }
  throw new Error("Expected CSPICE diagnostic");
}

async function withClock(
  backend: "node" | "wasm",
  check: (raw: SpiceSync["raw"]) => void,
) {
  const { spice, dispose } = await spiceClients.toSync({ backend });
  try {
    spice.raw.reset();
    spice.raw.kclear();
    check(spice.raw);
  } finally {
    try {
      spice.raw.reset();
      spice.raw.kclear();
    } finally {
      await dispose();
    }
  }
}

it("checks the N0067 formatter workspace before invoking the independent formatter", () => {
  const observations = independent(`
try:
    sp.furnsh(fixture)
    rejected=[]
    with patch.object(sp,"scfmt",side_effect=AssertionError("unexpected formatter dispatch")) as fmt:
        for ticks in (1e31,sys.float_info.max):
            try: oracle.scfmt(sc,ticks)
            except ValueError as err: rejected.append(str(err))
            else: raise AssertionError("Expected formatter domain validation")
        sp.pipool("SCLK_DATA_TYPE_12345",[2])
        oracle.scpart(sc)  # SCPR01 can seed SCTY01's same-clock cache.
        try: oracle.scfmt(sc,1e31)
        except ValueError as err: rejected.append(str(err))
        else: raise AssertionError("Expected same-clock cache safety check")
        sp.pdpool("SCLK01_OFFSETS_12345",[-1000000,0])
        try: oracle.scfmt(sc,0)
        except ValueError as err: rejected.append(str(err))
        else: raise AssertionError("Expected field width validation")
        fmt.assert_not_called()
    sp.kclear()
    sp.furnsh(fixture)
    print(json.dumps([rejected,oracle.scfmt(sc,258,2**31-1)]))
finally:
    sp.reset()
    sp.kclear()
`);
  expect(observations).toEqual([
    [
      "Clock component outside formatter domain",
      "Clock remainder outside formatter domain",
      "Clock component outside formatter domain",
      "Clock field width outside formatter domain",
    ],
    "000001.002",
  ]);
}, 25_000);

for (const backend of ["node", "wasm"] as const) {
  const run = backend === "node" ? it.runIf(nodeBackendAvailable) : it;

  run(
    `${backend} retains the caller frame through early clock errors and reuses the same conversion`,
    async () => {
      const reference = independent(`
caller="D02_CALLER"
entered=False
try:
    sp.chkin(caller)
    entered=True
    with patch.object(sp,"sce2t",side_effect=AssertionError("unexpected public sce2t error path")) as public:
        missing=diagnostic(lambda:oracle.sce2t(sc,1.25))
        assert sp.qcktrc(512)==caller and sp.trcdep()==1 and not sp.failed()
        sp.furnsh(fixture)
        sp.pipool("SCLK01_TIME_SYSTEM_12345",[2])
        tdt=diagnostic(lambda:oracle.sce2t(sc,1.25))
        assert sp.qcktrc(512)==caller and sp.trcdep()==1 and not sp.failed()
        public.assert_not_called()
    sp.pipool("SCLK01_TIME_SYSTEM_12345",[1])
    with patch.object(sp,"sce2t",wraps=sp.sce2t) as public:
        ticks=oracle.sce2t(sc,1.25)
        public.assert_called_once_with(sc,1.25)
    probe=diagnostic(lambda:sp.sigerr("SPICE(D02TRACEPROBE)"))
    sp.chkout(caller)
    entered=False
    assert sp.qcktrc(512)=="" and sp.trcdep()==0
    after=diagnostic(lambda:sp.sigerr("SPICE(D02TRACEAFTER)"))
    print(json.dumps([missing,tdt,ticks,probe,after]))
finally:
    sp.reset()
    if entered: sp.chkout(caller)
    sp.kclear()
`);
      await withClock(backend, (raw) => {
        raw.chkin(caller);
        let entered = true;
        try {
          const missing = diagnostic(() => raw.sce2t(sc, 1.25));
          expect(missing.short).toBe("SPICE(KERNELVARNOTFOUND)");
          expect(missing.trace).toBe(
            "D02_CALLER --> sce2t_c --> SCE2T --> SCTYPE --> SCTY01",
          );
          expect(raw.failed()).toBe(false);
          raw.furnsh(fixture);
          raw.pipool("SCLK01_TIME_SYSTEM_12345", [2]);
          const tdt = diagnostic(() => raw.sce2t(sc, 1.25));
          expect(tdt.short).toBe("SPICE(MISSINGTIMEINFO)");
          expect(raw.failed()).toBe(false);
          raw.pipool("SCLK01_TIME_SYSTEM_12345", [1]);
          const ticks = raw.sce2t(sc, 1.25);
          expect(ticks).toBe(320);
          const probe = diagnostic(() => raw.sigerr("SPICE(D02TRACEPROBE)"));
          expect(probe.trace).toBe(caller);
          raw.chkout(caller);
          entered = false;
          const after = diagnostic(() => raw.sigerr("SPICE(D02TRACEAFTER)"));
          expect(after.trace).toBe("");
          expect([missing, tdt, ticks, probe, after]).toEqual(reference);
        } finally {
          if (entered) raw.chkout(caller);
        }
      });
    },
    25_000,
  );

  run(
    `${backend} returns owned complete inclusive raw bounds at all 9999 partition slots`,
    async () => {
      const reference = independent(`
try:
    sp.furnsh(fixture)
    n=9999
    for key,off in [("SCLK_PARTITION_START_12345",0.25),("SCLK_PARTITION_END_12345",2.5)]:
        sp.pdpool(key,[3*i+off for i in range(n)])
    full=oracle.scpart(sc)
    for key,off in [("SCLK_PARTITION_START_12345",0.25),("SCLK_PARTITION_END_12345",2.5)]:
        sp.pdpool(key,[3*i+off for i in range(n+1)])
    too_many=diagnostic(lambda:oracle.scpart(sc))["short"]
    sp.kclear()
    sp.furnsh(fixture)
    print(json.dumps([full,too_many,oracle.scpart(sc)]))
finally:
    sp.reset()
    sp.kclear()
`);
      await withClock(backend, (raw) => {
        raw.furnsh(fixture);
        const starts = Array.from({ length: 9999 }, (_, i) => 3 * i + 0.25);
        const stops = Array.from({ length: 9999 }, (_, i) => 3 * i + 2.5);
        raw.pdpool(startsKey, starts);
        raw.pdpool(stopsKey, stops);
        const retained = raw.scpart(sc),
          mutable = raw.scpart(sc);
        mutable.pstart[1] = 999;
        mutable.pstop[0] = -502;
        expect(mutable.pstop[1]).toBe(5.5);
        expect(mutable.pstart[0]).toBe(0.25);
        expect(raw.scpart(sc)).toEqual(retained);
        expect(retained.pstart).toHaveLength(9999);
        expect(retained.pstop).toHaveLength(9999);
        raw.pdpool(startsKey, [...starts, 29997.25]);
        raw.pdpool(stopsKey, [...stops, 29999.5]);
        const error = diagnostic(() => raw.scpart(sc)).short;
        expect(error).toBe("SPICE(TOOMANYPARTITIONS)");
        expect(raw.failed()).toBe(false);
        raw.kclear();
        raw.furnsh(fixture);
        expect([retained, error, raw.scpart(sc)]).toEqual(reference);
      });
    },
    25_000,
  );

  run(
    `${backend} keeps exact expanded fields and finite-input raw tick overflow`,
    async () => {
      const reference = independent(`
try:
    sp.furnsh(fixture)
    spellings=[oracle.scfmt(sc,256000000,c) for c in (11,12,2048,2**31-1)]
    ticks=[oracle.sctiks(sc,clock) for clock in ("1e305:0","1e307:0","0:1e307","1:2")]
    print(json.dumps([spellings,["+Infinity" if t==math.inf else t for t in ticks]],allow_nan=False))
finally:
    sp.reset()
    sp.kclear()
`);
      await withClock(backend, (raw) => {
        raw.furnsh(fixture);
        const spellings = [11, 12, 2048, 2147483647].map((cap) =>
          raw.scfmt(sc, 256000000, cap),
        );
        expect(spellings).toEqual([
          "1000000.00",
          "1000000.000",
          "1000000.000",
          "1000000.000",
        ]);
        const ticks = ["1e305:0", "1e307:0", "0:1e307", "1:2"].map((clock) =>
          raw.sctiks(sc, clock),
        );
        expect(ticks[1]).toBe(Infinity);
        expect(ticks[3]).toBe(258);
        // The decimal parser and multiplication can differ by one last bit.
        // Normalize finite extreme outputs before comparison; preserve +Infinity exactly.
        if (!Array.isArray(reference) || !Array.isArray(reference[1]))
          throw new Error("Invalid live oracle observation");
        const [large, overflow, minor, ordinary] = reference[1];
        if (
          typeof large !== "number" ||
          typeof minor !== "number" ||
          !Number.isFinite(large) ||
          !Number.isFinite(minor)
        )
          throw new Error("Expected two finite extreme tick counts");
        expect(spellings).toEqual(reference[0]);
        expect(overflow).toBe("+Infinity");
        expect(ordinary).toBe(ticks[3]);
        expect(ticks[0]! / large).toBeCloseTo(1, 14);
        expect(ticks[2]! / minor).toBeCloseTo(1, 14);
      });
    },
    25_000,
  );
}
