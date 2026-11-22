import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const caller = "A16_RQUAD_CALLER";
const marker = "A16_RQUAD_OBSERVATIONS=";
const oracleProgram = `
import ctypes,json,sys
import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice

# Match tspice's existing report selection in an isolated oracle process.
# SpiceyPy 6.0.3's errprt wrapper mistakenly calls errdev, so use the actual
# independently loaded C entrypoint for this diagnostic configuration only.
libspice.errprt_c(b"SET",0,ctypes.create_string_buffer(b"NONE"))
if sys.argv[1]=="screen": sp.errdev("SET",128,"SCREEN")
caller="A16_RQUAD_CALLER"
sp.reset()
sp.kclear()
entered=False
records=[]
def observe(call):
    try:
        call()
        sp.check_for_spice_error(None)
    except Exception as error:
        return {"short":error.short,"long":error.long,"trace":error.traceback,"failed":sp.failed(),"afterTrace":sp.qcktrc(512),"depth":sp.trcdep()}
    raise AssertionError("Expected actual SPICE failure")
try:
    sp.chkin(caller)
    entered=True
    assert sp.trcdep()==1 and sp.qcktrc(512)==caller
    for constant in [0,7]:
        degenerate=observe(lambda:sp.rquad(0,0,constant))
        roots=sp.rquad(0,2,-6)
        probe=observe(lambda:sp.sigerr("SPICE(A16TRACEPROBE)"))
        records.append({"degenerate":degenerate,"roots":[root.tolist() for root in roots],"probe":probe})
    sp.chkout(caller)
    entered=False
    assert sp.trcdep()==0 and sp.qcktrc(512)==""
    ctypes.CDLL(None).fflush(None)
    print("A16_RQUAD_OBSERVATIONS="+json.dumps({"records":records,"finalDepth":sp.trcdep(),"finalTrace":sp.qcktrc(512)}),flush=True)
finally:
    sp.reset()
    if entered: sp.chkout(caller)
    sp.kclear()
`;
function independent(mode: "default" | "screen") {
  const sidecar = path.resolve(import.meta.dirname, "../sidecars/spiceypy");
  const stdout = execFileSync(
    "uv",
    [
      "run",
      "--locked",
      "--project",
      sidecar,
      "python",
      "-c",
      oracleProgram,
      mode,
    ],
    { encoding: "utf8", timeout: 15_000 },
  );
  const line = stdout.split(/\r?\n/).find((line) => line.startsWith(marker));
  if (!line) throw new Error("Missing independent trace observations");
  const observations: unknown = JSON.parse(line.slice(marker.length));
  return { stdout, observations };
}
const expectedRecords = [0, 7].map(() => ({
  degenerate: {
    short: "SPICE(DEGENERATECASE)",
    long: "Both 1st and 2nd degree coefficients are zero.",
    trace: `${caller} --> rquad_c`,
    failed: false,
    afterTrace: caller,
    depth: 1,
  },
  roots: [
    [3, 0],
    [3, 0],
  ],
  probe: {
    short: "SPICE(A16TRACEPROBE)",
    long: "",
    trace: caller,
    failed: false,
    afterTrace: caller,
    depth: 1,
  },
}));
function captured(call: () => unknown) {
  let error: unknown;
  try {
    call();
  } catch (caught) {
    error = caught;
  }
  if (!(error instanceof Error))
    throw new Error("Expected actual raw SPICE error");
  const short: unknown = Reflect.get(error, "spiceShort"),
    long: unknown = Reflect.get(error, "spiceLong"),
    trace: unknown = Reflect.get(error, "spiceTrace");
  if (
    typeof short !== "string" ||
    (long !== undefined && typeof long !== "string") ||
    (trace !== undefined && typeof trace !== "string")
  )
    throw new Error("Missing structured SPICE diagnostic");
  // The established backend error contract omits empty optional diagnostic
  // fields. SpiceyPy exposes those same empty fields as empty strings.
  return { short, long: long ?? "", trace: trace ?? "" };
}
for (const backend of ["wasm", "node"] as const) {
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    `${backend}: preserves caller traceback through the pinned rquad checkout diagnostic`,
    async () => {
      const oracle = independent("default");
      expect(oracle.observations).toEqual({
        records: expectedRecords,
        finalDepth: 0,
        finalTrace: "",
      });
      const { spice, dispose } = await spiceClients.toSync({ backend });
      let entered = false;
      try {
        spice.raw.chkin(caller);
        entered = true;
        for (const constant of [0, 7]) {
          const error = captured(() => spice.raw.rquad(0, 0, constant));
          expect(error).toEqual({
            short: "SPICE(DEGENERATECASE)",
            long: "Both 1st and 2nd degree coefficients are zero.",
            trace: `${caller} --> rquad_c`,
          });
          expect(spice.raw.failed()).toBe(false);
          expect(spice.raw.rquad(0, 2, -6)).toEqual({
            root1: [3, 0],
            root2: [3, 0],
          });
          // A fresh signal must retain the caller and exclude the popped rquad.
          const probe = captured(() =>
            spice.raw.sigerr("SPICE(A16TRACEPROBE)"),
          );
          expect(probe).toEqual({
            short: "SPICE(A16TRACEPROBE)",
            long: "",
            trace: caller,
          });
          expect(spice.raw.failed()).toBe(false);
        }
        spice.raw.chkout(caller);
        entered = false;
        const after = captured(() => spice.raw.sigerr("SPICE(A16TRACEAFTER)"));
        expect(after.trace).toBe("");
        expect(spice.raw.failed()).toBe(false);
      } finally {
        try {
          spice.raw.reset();
          if (entered) spice.raw.chkout(caller);
          spice.raw.kclear();
        } finally {
          await dispose();
        }
      }
    },
    20_000,
  );
}
it("the locked oracle reproduces the same checkout diagnostic when its error device is SCREEN", () => {
  const quiet = independent("default"),
    screen = independent("screen");
  expect(quiet.observations).toEqual(screen.observations);
  expect(screen.observations).toEqual({
    records: expectedRecords,
    finalDepth: 0,
    finalTrace: "",
  });
  expect(quiet.stdout).not.toContain("SPICE(NAMESDONOTMATCH)");
  expect(screen.stdout.match(/SPICE\(NAMESDONOTMATCH\)/g)).toHaveLength(2);
  expect(screen.stdout).toContain(
    "CHKOUT:  Caller is rquad; popped name is rquad_c.",
  );
}, 30_000);
