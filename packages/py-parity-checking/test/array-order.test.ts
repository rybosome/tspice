import { execFileSync } from "node:child_process";
import path from "node:path";
import { spiceClients } from "@rybosome/tspice";
import { it, expect } from "vitest";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const sidecar = path.resolve(import.meta.dirname, "../sidecars/spiceypy");
function oracle(program: string): unknown {
  return JSON.parse(
    execFileSync(
      "uv",
      ["run", "--locked", "--project", sidecar, "python", "-c", program],
      { encoding: "utf8", timeout: 20000 },
    ),
  );
}
function bits(v: number) {
  if (Number.isNaN(v)) return "NaN";
  const data = new DataView(new ArrayBuffer(8));
  data.setFloat64(0, v, false);
  return data.getBigUint64(0, false).toString(16).padStart(16, "0");
}

it("cross-checks all eleven typed C signatures against ordinary locked wrappers on shared representable examples", () => {
  const observed = oracle(`
import json,spiceypy as sp
from py_parity_sidecar.array_order_oracle import run
p=[1,2,0]
cs=["B","C","A"]
ds=[2.,3.,1.]
ii=[2,3,1]
ll=[True,False,True]
pairs=[
  (sp.isordv(p,3),run("isordv",p)),(list(sp.orderc(cs)),run("orderc",cs)),
  (list(sp.orderd(ds)),run("orderd",ds)),(list(sp.orderi(ii)),run("orderi",ii)),
  (list(sp.reordc(p,3,2,cs)),run("reordc",cs,p)),(list(sp.reordd(p,3,ds)),run("reordd",ds,p)),
  (list(sp.reordi(p,3,ii)),run("reordi",ii,p)),(list(sp.reordl(p,3,ll)),run("reordl",ll,p)),
  (list(sp.shellc(3,2,cs)),run("shellc",cs)),(list(sp.shelld(3,ds)),run("shelld",ds)),
  (list(sp.shelli(3,ii)),run("shelli",ii))]
assert all(a==b for a,b in pairs)
# SpiceyPy strips whitespace decoding rows. Direct C row bytes preserve these entries.
input_rows=["x ","y\\t"]
assert list(sp.reordc([1,0],2,3,input_rows)) == ["y","x"]
print(json.dumps([len(pairs),run("reordc",input_rows,[1,0]),run("shellc",["z "]),run("shellc",["z ","a "])]))
`);
  expect(observed).toEqual([11, ["y\t", "x "], ["z "], ["a", "z"]]);
}, 25000);

for (const backend of ["node", "wasm"] as const) {
  const run = backend === "node" ? it.runIf(nodeBackendAvailable) : it;
  run(
    `${backend} compares every IEEE value, order index and zero sign to an actual independent CSPICE call`,
    async () => {
      const reference = oracle(`
import json,math,struct
from py_parity_sidecar.array_order_oracle import run
def bits(v):
    return "NaN" if math.isnan(v) else struct.pack(">d",v).hex()
t=float.fromhex("0x0.0000000000001p-1022")
rows=[[math.inf,-0.,math.nan,-math.inf,0.,t,-t],[math.nan,1.,2.,3.],[3.,2.,1.,math.nan],[-0.,0.,-0.,0.],[1.,0.,0.,0.]]
result=[]
for row in rows:
    idx=run("orderd",row)
    gather=run("reordd",row,idx)
    result.append([idx,[bits(x) for x in gather],[bits(x) for x in run("shelld",row)]])
print(json.dumps(result))
`);
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        const rows = [
          [
            Infinity,
            -0,
            NaN,
            -Infinity,
            0,
            Number.MIN_VALUE,
            -Number.MIN_VALUE,
          ],
          [NaN, 1, 2, 3],
          [3, 2, 1, NaN],
          [-0, 0, -0, 0],
          [1, 0, 0, 0],
        ];
        const actual = rows.map((row) => {
          const input = Object.freeze(row.slice());
          const index = spice.raw.orderd(input);
          expect(spice.raw.isordv(index)).toBe(true);
          const reordered = spice.raw.reordd(index, input);
          expect(reordered.map(bits)).toEqual(
            index.map((i) => bits(input[i]!)),
          );
          return [
            index,
            reordered.map(bits),
            spice.raw.shelld(input).map(bits),
          ];
        });
        expect(actual).toEqual(reference);
        expect(actual.at(-1)?.[0]).toEqual([2, 1, 3, 0]);
      } finally {
        await dispose();
      }
    },
    25000,
  );
  run(
    `${backend} preserves character bytes and source-index direction through nontrivial cycles`,
    async () => {
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        const { raw } = spice;
        const input = Object.freeze(["q ", "q\t", "\ufeffé ", "", "q"]);
        const perm = raw.orderc(input);
        expect(perm).toEqual([3, 1, 0, 4, 2]);
        const copy = raw.reordc(perm, input);
        expect(copy).toEqual(["", "q\t", "q ", "q", "\ufeffé "]);
        expect(raw.shellc(input)).toEqual(["", "q\t", "q", "q", "\ufeffé"]);
        expect(raw.reordi(perm, [-2147483648, 1, 2, 3, 2147483647])).toEqual([
          3, 1, -2147483648, 2147483647, 2,
        ]);
        expect(raw.reordl(perm, [true, false, true, false, false])).toEqual([
          false,
          false,
          true,
          false,
          true,
        ]);
        copy[0] = "mutated";
        perm[0] = -9;
        expect(raw.orderc(input)).toEqual([3, 1, 0, 4, 2]);
        expect(raw.isordv([0, 2147483647])).toBe(false);
        expect(raw.isordv([])).toBe(false);
        expect(() => raw.reordc([1, 1], ["A", "B"])).toThrow(/permutation/);
        expect(raw.shelli([2147483647, 0, -2147483648])).toEqual([
          -2147483648, 0, 2147483647,
        ]);
        expect(raw.failed()).toBe(false);
      } finally {
        await dispose();
      }
    },
  );
}
