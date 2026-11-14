import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const program = `
import math, json, spiceypy as s
ordered = [-math.inf, -1., -0., +0., 1., math.inf]
physical = [math.nan, math.inf, -0., math.nan, -math.inf, +0., 1.]
values = ["X", "A ", "A", "A  ", "Z"]
iv = [20, -5, -5, -5, 100]
orders = [[1,2,3,0,4],[3,2,1,0,4]]
out = [
    [s.bsrchd(k,len(ordered),ordered) for k in (-math.inf, -0., +0., math.inf, 2.)],
    [s.isrchd(k,len(physical),physical) for k in (math.nan, math.inf,-math.inf,0.,1.)],
    [s.bschoc("A",5,4,values,p) for p in orders],
    [s.bschoi(-5,5,iv,p) for p in orders],
    [s.isrchc("A",5,4,values),s.isrchi(-5,5,iv)],
    [s.bsrchc("A",5,4,["A ","A","A  ","X","Z"]),s.bsrchi(-5,5,[-5,-5,-5,20,100])],
]
assert not s.failed()
print(json.dumps(out))
`;
for (const backend of ["wasm", "node"] as const) {
  const test = it.runIf(backend === "wasm" || nodeBackendAvailable);
  test(`${backend}: uses actual physical indices, duplicate selection, and IEEE search equality`, async () => {
    const expected: unknown = JSON.parse(
      execFileSync(
        "uv",
        [
          "run",
          "--locked",
          "--project",
          fileURLToPath(new URL("../sidecars/spiceypy/", import.meta.url)),
          "python",
          "-c",
          program,
        ],
        { encoding: "utf8", timeout: 30_000 },
      ),
    );
    const { spice, dispose } = await spiceClients.toSync({ backend });
    try {
      const { raw } = spice,
        ordered = [-Infinity, -1, -0, 0, 1, Infinity],
        values = [NaN, Infinity, -0, NaN, -Infinity, 0, 1],
        text = ["X", "A ", "A", "A  ", "Z"],
        ints = [20, -5, -5, -5, 100];
      const orders = [
        [1, 2, 3, 0, 4],
        [3, 2, 1, 0, 4],
      ];
      const results = [
        [-Infinity, -0, 0, Infinity, 2].map((k) => raw.bsrchd(k, ordered)),
        [NaN, Infinity, -Infinity, 0, 1].map((k) => raw.isrchd(k, values)),
        orders.map((p) => raw.bschoc("A", text, p)),
        orders.map((p) => raw.bschoi(-5, ints, p)),
        [raw.isrchc("A", text), raw.isrchi(-5, ints)],
        [
          raw.bsrchc("A", ["A ", "A", "A  ", "X", "Z"]),
          raw.bsrchi(-5, [-5, -5, -5, 20, 100]),
        ],
      ];
      expect(results).toEqual(expected);
      expect(results[1]).toEqual([-1, 1, 4, 2, 6]);
      expect(results[4]).toEqual([1, 1]);
      expect(() => raw.bsrchd(NaN, ordered)).toThrow();
      expect(() => raw.bschoi(100, ints, [1, 2, 3, 4, 4])).toThrow();
      expect(() => raw.bschoc("Z", text, [-1, 1, 2, 3, 4])).toThrow();
      expect(raw.failed()).toBe(false);
      expect(raw.bschoc("Z", text, orders[0]!)).toBe(4);
      expect(raw.bschoi(100, ints, orders[0]!)).toBe(4);
    } finally {
      await dispose();
    }
  });
}
