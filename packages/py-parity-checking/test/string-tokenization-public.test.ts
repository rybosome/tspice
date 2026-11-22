import { spiceClients } from "@rybosome/tspice";
import { describe, expect, it } from "vitest";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

describe("public token results", () => {
  for (const backend of ["node", "wasm"] as const) {
    const test = backend === "node" ? it.runIf(nodeBackendAvailable) : it;
    test(`${backend} keeps byte positions, independent list rows and delimiters`, async () => {
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        const raw = spice.raw;
        expect(raw.nextwd("  é  β z  ")).toEqual({ next: "é", rest: "β z" });
        expect(raw.nthwd("  é  β z  ", 1)).toEqual({ word: "β", loc: 6 });
        expect(raw.nthwd("  é  β z  ", 2147483647)).toEqual({
          word: "",
          loc: -1,
        });
        const rows = raw.lparse("q::r::", ":", 5, 2);
        expect(rows).toEqual({ n: 5, items: ["q", "", "r", "", ""] });
        expect(raw.lparsm(" q,:r; z", ",;: ", 5)).toEqual({
          n: 4,
          items: ["q", "", "r", "z"],
        });
        rows.items[0] = "changed";
        expect(raw.lparse("q::r::", ":", 2)).toEqual({
          n: 2,
          items: ["q", ""],
        });
        for (const split of [
          () => raw.nextwd("é a", 2),
          () => raw.nthwd("é a", 0, 2),
          () => raw.lparse("é:a", ":", 5, 2),
          () => raw.lparsm("é:a", ":", 5, 2),
        ]) {
          expect(split).toThrow(/UTF-?8|encoded data/i);
        }
        expect(raw.failed()).toBe(false);
        expect(raw.nthwd("é a", 1)).toEqual({ word: "a", loc: 3 });
      } finally {
        await dispose();
      }
    });
    test(`${backend} retains complete, partial and empty lexer spans`, async () => {
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        const raw = spice.raw;
        expect(raw.lx4dec("é-1.5D+2", 2)).toEqual({ last: 5, nchar: 4 });
        expect(raw.lx4num("é-1.5D+2", 2)).toEqual({ last: 8, nchar: 7 });
        expect(raw.lx4num("é-1.5D+", 2)).toEqual({ last: 5, nchar: 4 });
        expect(raw.lx4sgn("é-123", 2)).toEqual({ last: 5, nchar: 4 });
        expect(raw.lx4uns("é123", 2)).toEqual({ last: 4, nchar: 3 });
        expect(raw.lxqstr("é'a''b'!", "'", 2)).toEqual({ last: 7, nchar: 6 });
        const minimum = -2147483648;
        const miss = { last: minimum - 1, nchar: 0 };
        for (const name of ["lx4dec", "lx4num", "lx4sgn", "lx4uns"] as const) {
          expect(raw[name]("123", minimum)).toEqual(miss);
          expect(raw[name]("", minimum)).toEqual(
            name === "lx4uns" ? miss : { last: -1, nchar: 0 },
          );
        }
        expect(raw.lxqstr("", "'", minimum)).toEqual(miss);
      } finally {
        await dispose();
      }
    });
  }
});
