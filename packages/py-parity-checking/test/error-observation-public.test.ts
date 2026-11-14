import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

for (const backend of ["node", "wasm"] as const) {
  const run = it.runIf(backend === "wasm" || nodeBackendAvailable);
  run(
    backend + " preserves trace bytes and recovers after a split UTF-8 output",
    async () => {
      const {
        spice: { raw },
        dispose,
      } = await spiceClients.toSync({ backend });
      const name = "Aé\t";
      raw.chkin(name);
      try {
        expect(raw.trcdep()).toBe(1);
        for (const read of [
          (n: number) => raw.qcktrc(n),
          (n: number) => raw.trcnam(0, n),
        ]) {
          expect(read(2)).toBe("A");
          expect(() => read(3)).toThrow();
          expect(read(4)).toBe("Aé");
          expect(read(5)).toBe(name);
          expect(read(2147483647)).toBe(name);
        }
        expect(() => raw.trcnam(10, 1)).toThrow(/STRINGTOOSHORT/);
        expect(() => raw.trcnam(10)).toThrow(/INDEXOUTOFRANGE/);
        expect(raw.return()).toBe(false);
        expect(raw.qcktrc()).toBe(name);
      } finally {
        raw.chkout(name);
        raw.reset();
        await dispose();
      }
    },
  );
  run(
    backend +
      " retains the exact long diagnostic through substitution, capture and reset",
    async () => {
      const {
        spice: { raw },
        dispose,
      } = await spiceClients.toSync({ backend });
      raw.chkin("PREPARE");
      try {
        raw.setmsg("  @ i=# d=%.");
        raw.errch(" @ ", "  α  ");
        raw.errint("#", -2147483648);
        raw.errdp("%", 0);
        const message = "  α i=-2147483648 d=0.0000000000000E+00.";
        expect(raw.getmsg("LONG")).toBe(message);
        let error: unknown;
        try {
          raw.sigerr("SPICE(B06TEST)");
        } catch (e) {
          error = e;
        }
        expect(error).toMatchObject({
          spiceShort: "SPICE(B06TEST)",
          spiceLong: message,
          spiceTrace: "PREPARE",
        });
        expect(raw.getmsg("LONG")).toBe("");
        expect(raw.return()).toBe(false);
        expect(raw.trcdep()).toBe(1);
      } finally {
        raw.chkout("PREPARE");
        raw.reset();
        await dispose();
      }
    },
  );
}
