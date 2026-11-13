import fs from "node:fs";
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
function vector(actual: readonly number[], expected: readonly number[]) {
  expect(actual).toHaveLength(expected.length);
  for (let i = 0; i < expected.length; i++)
    expect(Math.abs(actual[i]! - expected[i]!)).toBeLessThan(
      i < 3 ? 1e-9 : 1e-12,
    );
}
const bytes = (name: string) =>
  fs.readFileSync(new URL(`../fixtures/kernels/${name}`, import.meta.url));
for (const backend of ["node", "wasm"] as const) {
  const run = it.runIf(backend === "wasm" || nodeBackendAvailable);
  run(
    `${backend}: complete polynomial states, light time and corrected velocity derivative`,
    async () => {
      const setup = await spiceClients.toSync({ backend }),
        { raw } = setup.spice;
      try {
        raw.furnsh({
          path: "query-main.bsp",
          bytes: bytes("audit-ephemeris.bsp"),
        });
        for (const t of [-700.25, -123.5, 625.75]) {
          const expected = polynomial(t),
            lightTime = Math.hypot(...expected.slice(0, 3)) / 299792.458;
          for (const actual of [
            raw.spkez(100001, t, "J2000", "NONE", 0),
            raw.spkezr("100001", t, "J2000", "NONE", "0"),
            raw.spkgeo(100001, t, "J2000", 0),
          ]) {
            vector(actual.state, expected);
            expect(Math.abs(actual.lt - lightTime)).toBeLessThan(1e-12);
          }
          for (const actual of [
            raw.spkezp(100001, t, "J2000", "NONE", 0),
            raw.spkpos("100001", t, "J2000", "NONE", "0"),
            raw.spkgps(100001, t, "J2000", 0),
          ]) {
            vector(actual.pos, expected.slice(0, 3));
            expect(Math.abs(actual.lt - lightTime)).toBeLessThan(1e-12);
          }
          vector(raw.spkssb(100001, t, "J2000"), expected);
          vector(
            raw.spkssb(-100011, t, "J2000"),
            expected.map((v, i) => 2 * v - (i === 0 ? 3000 : 0)),
          );
        }
        raw.furnsh({
          path: "query-observer.bsp",
          bytes: bytes("audit-ephemeris-observer.bsp"),
        });
        const t = 125.25,
          h = 0.01;
        const corrected = raw.spkez(100001, t, "J2000", "CN+S", 100002),
          before = raw.spkpos("100001", t - h, "J2000", "CN+S", "100002"),
          after = raw.spkpos("100001", t + h, "J2000", "CN+S", "100002");
        for (let i = 0; i < 3; i++)
          expect(
            Math.abs(
              corrected.state[i + 3]! -
                (after.pos[i]! - before.pos[i]!) / (2 * h),
            ),
          ).toBeLessThan(1e-7);
        const geometric = raw.spkez(100001, t, "J2000", "NONE", 100002),
          received = raw.spkez(100001, t, "J2000", "CN", 100002),
          sent = raw.spkez(100001, t, "J2000", "XCN", 100002);
        expect(received.state[0]).toBeLessThan(geometric.state[0]);
        expect(sent.state[0]).toBeGreaterThan(geometric.state[0]);
        expect(
          Math.hypot(
            ...corrected.state
              .slice(0, 3)
              .map((v, i) => v - geometric.state[i]!),
          ),
        ).toBeGreaterThan(0.01);
      } finally {
        await setup.dispose();
      }
    },
  );
  run(
    `${backend}: search priority, exact descriptor and actual containing file handle`,
    async () => {
      const setup = await spiceClients.toSync({ backend }),
        { raw } = setup.spice;
      try {
        expect(() => raw.spksfs(100001, 125.25)).toThrow(/NOLOADEDFILES/);
        raw.furnsh({
          path: "query-main.bsp",
          bytes: bytes("audit-ephemeris.bsp"),
        });
        const negative = raw.spksfs(-100011, 0),
          mainFile = raw.kdata(0, "SPK");
        if (!negative.found || !mainFile.found)
          throw Error("Missing actual authored segment/file");
        expect(negative.handle).toBe(mainFile.handle);
        expect(raw.spkuds(negative.descr)).toEqual({
          body: -100011,
          center: -100010,
          frame: 1,
          type: 8,
          first: -1000,
          last: 1000,
          baddr: 555,
          eaddr: 588,
        });
        expect(raw.spksfs(100001, 50)).toEqual({ found: false });
        raw.furnsh({
          path: "query-priority.bsp",
          bytes: bytes("audit-ephemeris-priority.bsp"),
        });
        const priority = raw.spksfs(100001, 125.25),
          priorityFile = raw.kdata(1, "SPK");
        if (!priority.found || !priorityFile.found)
          throw Error("Missing actual priority segment/file");
        expect(priority.handle).toBe(priorityFile.handle);
        expect(priority.handle).not.toBe(mainFile.handle);
        expect(priority.ident).toBe("AUTHORED_PRIORITY");
        expect(raw.spkuds(priority.descr)).toEqual({
          body: 100001,
          center: 0,
          frame: 1,
          type: 8,
          first: -500,
          last: 500,
          baddr: 385,
          eaddr: 418,
        });
        raw.unload("query-priority.bsp");
        const restored = raw.spksfs(100001, 125.25);
        if (!restored.found) throw Error("Missing restored segment");
        expect(restored.handle).toBe(mainFile.handle);
        expect(restored.ident).toBe("AUTHORED_TARGET_LATE");
        expect(raw.spkuds(restored.descr)).toEqual({
          body: 100001,
          center: 0,
          frame: 1,
          type: 8,
          first: 100,
          last: 1000,
          baddr: 419,
          eaddr: 452,
        });
      } finally {
        await setup.dispose();
      }
    },
  );
}
