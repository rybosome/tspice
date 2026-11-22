import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

for (const backend of ["node", "wasm"] as const) {
  const run = it.runIf(backend === "wasm" || nodeBackendAvailable);
  run(
    `${backend}: observe every new row after capacity failure and reuse the same cell`,
    async () => {
      const {
        spice: { raw, kit },
        dispose,
      } = await spiceClients.toSync({ backend });
      const set = kit.newCharCell(2, 8);
      const items = () =>
        Array.from({ length: raw.card(set) }, (_, i) => kit.cellGetc(set, i));
      try {
        raw.insrtc("seed", set);
        raw.insrtc("zz", set);
        expect(() => raw.lparss("B,A,C", ",", set)).toThrow(/SETEXCESS/);
        expect(items()).toEqual(["A", "B"]);
        expect(raw.failed()).toBe(false);
        raw.lparss("é,x,é", ",", set);
        expect(items()).toEqual(["x", "é"]);
        expect(() => raw.lparss("", "", set)).toThrow(/SETEXCESS/);
        expect(items()).toEqual(["x", "é"]);
      } finally {
        kit.freeCell(set);
        await dispose();
      }
    },
  );

  run(
    `${backend}: preserve significant trailing bytes in the set independently of kit display`,
    async () => {
      const a = await spiceClients.toSync({ backend }),
        b = await spiceClients.toSync({ backend });
      const { raw, kit } = a.spice,
        set = kit.newCharCell(6, 16),
        other = b.spice.kit.newCharCell(4, 16);
      try {
        raw.lparss("A\t,B", ",", set);
        expect(raw.card(set)).toBe(2);
        // The display accessor trims the tab. Membership can be tested through
        // canonical INSRTC: inserting exactly A must add a distinct third row.
        expect(kit.cellGetc(set, 0)).toBe("A");
        raw.insrtc("A", set);
        expect(raw.card(set)).toBe(3);
        expect(() => raw.lparss("new", ",", other)).toThrow(
          /owned|expired|unknown/i,
        );
        for (const text of ["a\0b", "\uD800"]) {
          expect(() => raw.lparss(text, ",", set)).toThrow();
          expect(() => raw.lparss("ok", text, set)).toThrow();
        }
        raw.lparss("B,A", ",", set);
        expect(raw.card(set)).toBe(2);
      } finally {
        kit.freeCell(set);
        b.spice.kit.freeCell(other);
        await a.dispose();
        await b.dispose();
      }
      expect(() => raw.lparss("new", ",", set)).toThrow();
    },
  );
}
