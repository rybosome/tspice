import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
const states = [1, 2, 3, 4, 5, 6, 241, 302, 363, 4, 5, 6];
for (const backend of ["node", "wasm"] as const) {
  const run = it.runIf(backend === "wasm" || nodeBackendAvailable);
  run(
    `${backend}: negative SPK comment reservation is treated as zero`,
    async () => {
      const setup = await spiceClients.toSync({ backend }),
        { raw, kit } = setup.spice;
      const output = {
        kind: "virtual-output",
        path: "negative-comments.bsp",
      } as const;
      try {
        const h = raw.spkopn(output, "AUTHORED", -50);
        raw.spkw08(h, 100001, 0, "J2000", 0, 60, "AUTHORED", 1, states, 0, 60);
        raw.spkcls(h);
        expect(kit.readVirtualOutput(output).byteLength).toBeGreaterThan(1024);
      } finally {
        await setup.dispose();
      }
    },
  );
  run(
    `${backend}: empty-close error retains writer for actual recovery`,
    async () => {
      const setup = await spiceClients.toSync({ backend }),
        { raw, kit } = setup.spice;
      const output = {
        kind: "virtual-output",
        path: "empty-close-recovery.bsp",
      } as const;
      try {
        const h = raw.spkopn(output, "AUTHORED", 0);
        expect(() => raw.spkcls(h)).toThrow(/NOSEGMENTSFOUND/);
        expect(() => kit.readVirtualOutput(output)).toThrow(/open|close/i);
        raw.spkw08(h, 100001, 0, "J2000", 0, 60, "RECOVERED", 1, states, 0, 60);
        raw.spkcls(h);
        raw.furnsh({
          path: "recovered-input.bsp",
          bytes: kit.readVirtualOutput(output),
        });
        expect(raw.spkezr("100001", 30, "J2000", "NONE", "0").state).toEqual([
          121, 152, 183, 4, 5, 6,
        ]);
        expect(() => raw.spkcls(h)).toThrow(/closed|handle/i);
      } finally {
        await setup.dispose();
      }
    },
  );
  run(
    `${backend}: SPK writer rejects integer coercion and nonfinite typed states`,
    async () => {
      const setup = await spiceClients.toSync({ backend }),
        { raw } = setup.spice;
      const output = {
        kind: "virtual-output",
        path: "writer-inputs.bsp",
      } as const;
      const h = raw.spkopn(output, "AUTHORED", 0);
      raw.spkw08(h, 100001, 0, "J2000", 0, 60, "ACTIVE", 1, states, 0, 60);
      try {
        for (const bad of [1.25, 4294967297, NaN, Infinity]) {
          expect(() =>
            raw.spkw08(h, bad, 0, "J2000", 0, 60, "BAD_BODY", 1, states, 0, 60),
          ).toThrow();
          expect(() =>
            raw.spkw08(
              h,
              100001,
              bad,
              "J2000",
              0,
              60,
              "BAD_CENTER",
              1,
              states,
              0,
              60,
            ),
          ).toThrow();
          expect(() =>
            raw.spkw08(
              h,
              100001,
              0,
              "J2000",
              0,
              60,
              "BAD_DEGREE",
              bad,
              states,
              0,
              60,
            ),
          ).toThrow();
        }
        const bad = new Float64Array(states);
        bad[5] = NaN;
        expect(() =>
          raw.spkw08(h, 100001, 0, "J2000", 0, 60, "NAN_STATE", 1, bad, 0, 60),
        ).toThrow();
      } finally {
        raw.spkcls(h);
        await setup.dispose();
      }
    },
  );
}
for (const backend of ["node", "wasm"] as const)
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    `${backend}: oversized SPK states fail before element reads or native allocation`,
    async () => {
      const setup = await spiceClients.toSync({ backend }),
        raw = setup.spice.raw;
      const output = {
        kind: "virtual-output",
        path: "bounded-states.bsp",
      } as const;
      const h = raw.spkopn(output, "AUTHORED", 0);
      raw.spkw08(h, 100001, 0, "J2000", 0, 60, "ACTIVE", 1, states, 0, 60);
      let reads = 0;
      // A proxy reports a large flat length without allocating a huge test array.
      const oversized = new Proxy<number[]>([], {
        get(target, key) {
          if (key === "length") return 33554436;
          if (typeof key === "string" && /^\d+$/.test(key)) {
            reads++;
            throw Error("state read before size check");
          }
          return Reflect.get(target, key);
        },
      });
      try {
        expect(() =>
          raw.spkw08(
            h,
            100001,
            0,
            "J2000",
            0,
            60,
            "OVERSIZED",
            1,
            oversized,
            0,
            60,
          ),
        ).toThrow(/256/);
        expect(reads).toBe(0);
      } finally {
        raw.spkcls(h);
        await setup.dispose();
      }
    },
  );
for (const backend of ["node", "wasm"] as const)
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    `${backend}: SPK tokens reject another backend before closing or writing`,
    async () => {
      const a = await spiceClients.toSync({ backend }),
        b = await spiceClients.toSync({ backend });
      const output = { kind: "virtual-output", path: "owner-spk.bsp" } as const,
        h = a.spice.raw.spkopn(output, "AUTHORED", 0);
      try {
        a.spice.raw.spkw08(
          h,
          100001,
          0,
          "J2000",
          0,
          60,
          "ACTIVE",
          1,
          states,
          0,
          60,
        );
        expect(() => b.spice.raw.spkcls(h)).toThrow(/handle|SpiceHandle/i);
        expect(() =>
          b.spice.raw.spkw08(
            h,
            100001,
            0,
            "J2000",
            0,
            60,
            "FOREIGN",
            1,
            states,
            0,
            60,
          ),
        ).toThrow(/handle|SpiceHandle/i);
        a.spice.raw.spkcls(h);
        expect(
          a.spice.kit.readVirtualOutput(output).byteLength,
        ).toBeGreaterThan(1024);
      } finally {
        await b.dispose();
        await a.dispose();
      }
    },
  );
