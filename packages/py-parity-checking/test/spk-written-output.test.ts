import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
const polynomial = (t: number) => [
  10000 + 1.25 * t + 0.002 * t * t,
  -20000 - 0.75 * t + 0.001 * t * t,
  30000 + 0.5 * t - 0.0005 * t * t,
  1.25 + 0.004 * t,
  -0.75 + 0.002 * t,
  0.5 - 0.001 * t,
];
for (const backend of ["node", "wasm"] as const)
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    `${backend}: persisted SPK header and every typed-view state word`,
    async () => {
      const setup = await spiceClients.toSync({ backend }),
        { raw, kit } = setup.spice;
      try {
        for (const ncomch of [-50, 2050]) {
          const output = {
            kind: "virtual-output",
            path: `full-output-${ncomch}.bsp`,
          } as const;
          const name = "AUTHORED_HEADER_" + "N".repeat(70),
            segid = "S".repeat(40);
          const backing = new Float64Array(34).fill(NaN),
            states = new Float64Array(backing.buffer, 40, 24);
          const values = [-100, 0, 100, 200].flatMap(polynomial);
          states.set(values);
          const h = raw.spkopn(output, name, ncomch);
          raw.spkw08(
            h,
            100001,
            0,
            "J2000",
            -50,
            150,
            segid,
            2,
            states,
            -100,
            100,
          );
          raw.spkcls(h);
          const bytes = kit.readVirtualOutput(output),
            view = new DataView(
              bytes.buffer,
              bytes.byteOffset,
              bytes.byteLength,
            ),
            decoder = new TextDecoder();
          expect(decoder.decode(bytes.subarray(0, 8))).toBe("DAF/SPK ");
          const format = decoder.decode(bytes.subarray(88, 96));
          expect(["LTL-IEEE", "BIG-IEEE"]).toContain(format);
          const little = format === "LTL-IEEE";
          expect(view.getInt32(8, little)).toBe(2);
          expect(view.getInt32(12, little)).toBe(6);
          expect(decoder.decode(bytes.subarray(16, 76))).toBe(
            name.slice(0, 60),
          );
          const forward = view.getInt32(76, little);
          expect(forward).toBe(ncomch < 0 ? 2 : 5);
          const begin = (forward + 1) * 128 + 1,
            end = begin + 27;
          expect(view.getInt32(84, little)).toBe(end + 1);
          for (let i = 0; i < 24; i++)
            expect(view.getFloat64((begin - 1 + i) * 8, little)).toBe(
              values[i],
            );
          expect(view.getFloat64((begin - 1 + 24) * 8, little)).toBe(-100);
          expect(view.getFloat64((begin - 1 + 25) * 8, little)).toBe(100);
          expect(view.getFloat64((begin - 1 + 26) * 8, little)).toBe(2);
          expect(view.getFloat64((begin - 1 + 27) * 8, little)).toBe(4);
          raw.furnsh({ path: `persisted-${ncomch}.bsp`, bytes });
          const segment = raw.spksfs(100001, 25.25);
          if (!segment.found) throw Error("Missing actual written segment");
          expect(segment.ident).toBe(segid);
          expect(raw.spkuds(segment.descr)).toEqual({
            body: 100001,
            center: 0,
            frame: 1,
            type: 8,
            first: -50,
            last: 150,
            baddr: begin,
            eaddr: end,
          });
          const expected = polynomial(25.25),
            actual = raw.spkezr("100001", 25.25, "J2000", "NONE", "0");
          for (let i = 0; i < 6; i++)
            expect(Math.abs(actual.state[i]! - expected[i]!)).toBeLessThan(
              i < 3 ? 1e-9 : 1e-12,
            );
          expect(actual.lt).toBeGreaterThan(0);
          raw.kclear();
        }
      } finally {
        await setup.dispose();
      }
    },
  );
