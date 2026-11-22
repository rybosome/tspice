import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, it } from "vitest";
import { spiceClients, type SpiceQuaternion } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

// JSON cannot represent IEEE special values. Tag only those components;
// the independent toolkit still computes all scientific results.
type Probe =
  | { name: "q2m"; a: SpiceQuaternion }
  | { name: "qxq" | "qdq2av"; a: SpiceQuaternion; b: SpiceQuaternion };
const probes: Probe[] = [
  { name: "q2m", a: [1e200, 0, 1e200, 0] },
  { name: "q2m", a: [1e-300, 0, 1e-300, 0] },
  { name: "q2m", a: [1, 0, 1, 0] },
  { name: "qxq", a: [1e200, 0, 0, 0], b: [1e200, -1e200, 0, 0] },
  { name: "qxq", a: [1, 2, 3, 4], b: [-2, 3, -4, 5] },
  { name: "qdq2av", a: [1, 0, 0, 0], b: [0, 1e308, -1e308, 2] },
  { name: "qdq2av", a: [1, 0, 0, 0], b: [0, 1, -1, 2] },
];
function tag(x: number): number | string {
  return Number.isFinite(x) ? (x === 0 ? 0 : x) : String(x);
}
for (const backend of ["node", "wasm"] as const) {
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    backend + ": retains every finite-input overflow component and recovers",
    async () => {
      const oracle = JSON.parse(
        execFileSync(
          "uv",
          [
            "run",
            "--locked",
            "--project",
            path.resolve(import.meta.dirname, "../sidecars/spiceypy"),
            "python",
            "-c",
            `
import json, math, sys, spiceypy as sp
def tag(x):
    if math.isnan(x): return "NaN"
    if math.isinf(x): return "Infinity" if x > 0 else "-Infinity"
    return 0 if x == 0 else float(x)
out=[]
for p in json.load(sys.stdin):
    if p["name"] == "q2m": row=sp.q2m(p["a"]).flatten()
    elif p["name"] == "qxq": row=sp.qxq(p["a"],p["b"])
    elif p["name"] == "qdq2av": row=sp.qdq2av(p["a"],p["b"])
    else: raise ValueError("unknown probe")
    out.append([tag(v) for v in row])
assert not sp.failed()
print(json.dumps(out,allow_nan=False))
`,
          ],
          { encoding: "utf8", input: JSON.stringify(probes), timeout: 15000 },
        ),
      );
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        const raw = spice.raw;
        const observed = probes.map((p) =>
          (p.name === "q2m"
            ? raw.q2m(p.a)
            : p.name === "qxq"
              ? raw.qxq(p.a, p.b)
              : raw.qdq2av(p.a, p.b)
          ).map(tag),
        );
        expect(observed).toEqual(oracle);
        expect(observed[0]).toContain("NaN");
        expect(observed[3]).toContain("Infinity");
        expect(observed[5]).toContain("-Infinity");
        expect(raw.failed()).toBe(false);
      } finally {
        await dispose();
      }
    },
  );
}
