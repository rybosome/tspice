import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";

const enc = new TextEncoder();
const src = (path: string, text: string) => ({ path, bytes: enc.encode(text) });
for (const backend of ["node", "wasm"] as const)
  describe(backend + " compiled text and command state", () => {
    it("releases a reader at the first actual toolkit capacity error and retries the same file", async () => {
      const client = await spiceClients.toSync({ backend });
      try {
        const r = client.spice.raw;
        let opened = 0,
          diagnostic = "";
        for (; opened <= 96; opened++) {
          try {
            expect(
              r.rdtext(src("limit-" + opened, "r" + opened + "\n")).line,
            ).toBe("r" + opened);
          } catch (error) {
            if (!(error instanceof Error)) throw error;
            diagnostic = error.message;
            break;
          }
        }
        // RDTEXT has 96 table entries. Units already occupied by the host f2c
        // runtime can instead exhaust GETLUN before that table fills.
        expect(opened).toBeGreaterThan(0);
        expect(opened).toBeLessThanOrEqual(96);
        expect(diagnostic).toContain(
          opened === 96
            ? "SPICE(TOOMANYFILESOPEN)"
            : "SPICE(NOFREELOGICALUNIT)",
        );
        expect(r.failed()).toBe(false);
        expect(r.rdtext("limit-" + (opened - 1))).toEqual({
          eof: true,
          line: "",
        });
        expect(r.rdtext("limit-" + opened)).toEqual({
          eof: false,
          line: "r" + opened,
        });
      } finally {
        await client.dispose();
      }
    });
    it("returns exact bytes, advances a truncated line, consumes a malformed representation and restarts at EOF", async () => {
      const client = await spiceClients.toSync({ backend });
      try {
        const r = client.spice.raw;
        const file = src("records", "\uFEFF  word\t  \nµΔ\nabcdef\n\nlast");
        expect(r.rdtext(file)).toEqual({ line: "\uFEFF  word\t", eof: false });
        expect(() => r.rdtext("records", 2)).toThrow(TypeError);
        expect(r.failed()).toBe(false);
        expect(r.rdtext("records", 4)).toEqual({ line: "abc", eof: false });
        expect(r.rdtext("records")).toEqual({ line: "", eof: false });
        expect(r.rdtext("records")).toEqual({ line: "", eof: true });
        expect(r.rdtext("records")).toEqual({
          line: "\uFEFF  word\t",
          eof: false,
        });
      } finally {
        await client.dispose();
      }
    });
    it("reports the toolkit's file/open and string errors, then reads successfully", async () => {
      const client = await spiceClients.toSync({ backend });
      try {
        const r = client.spice.raw;
        const existing = src("continued", "one\ntwo\n");
        expect(r.rdtext(existing).line).toBe("one");
        expect(() => r.rdtext("c14-missing-file.txt")).toThrow(
          /FILEOPENFAILED/,
        );
        expect(r.failed()).toBe(false);
        expect(r.rdtext(existing).line).toBe("two");
        expect(r.rdtext(existing)).toEqual({ line: "", eof: true });
        expect(() => r.rdtext("", 0)).toThrow(/EMPTYSTRING/);
        expect(() => r.rdtext("missing", 1)).toThrow(/STRINGTOOSHORT/);
        expect(() => r.rdtext("x\0")).toThrow(TypeError);
        expect(() => r.rdtext("x", 1.25)).toThrow(TypeError);
        expect(() => r.rdtext("x", 256 * 1024 ** 2 + 1)).toThrow(RangeError);
        expect(r.rdtext(src("ok", "OK\n"))).toEqual({ line: "OK", eof: false });
      } finally {
        await client.dispose();
      }
    });
    it("snapshots each staged source field once and rejects a conflicting restage without consuming the record", async () => {
      const client = await spiceClients.toSync({ backend });
      try {
        let names = 0,
          arrays = 0;
        const input = {
          get path() {
            if (++names !== 1) throw Error("name reread");
            return "owned";
          },
          get bytes() {
            if (++arrays !== 1) throw Error("bytes reread");
            return enc.encode("A\nB\n");
          },
        };
        const r = client.spice.raw;
        expect(r.rdtext(input).line).toBe("A");
        expect(() => r.rdtext(src("owned", "changed"))).toThrow(/changed/);
        expect(r.rdtext("owned")).toEqual({ line: "B", eof: false });
        expect([names, arrays]).toEqual([1, 1]);
      } finally {
        await client.dispose();
      }
    });
    it("preserves the open reader across legitimate command initialization and a recovered second call", async () => {
      const client = await spiceClients.toSync({ backend });
      try {
        const r = client.spice.raw,
          argv = ["program", "", "\uFEFFΩ", "  trail\t"];
        expect(r.rdtext(src("parallel", "one\ntwo\n")).line).toBe("one");
        expect(() => r.putcml(["bad\0arg"])).toThrow(TypeError);
        expect(() => r.putcml(["\ud800"])).toThrow(TypeError);
        expect(r.putcml(argv)).toBeUndefined();
        argv.fill("changed");
        r.kclear();
        r.reset();
        expect(() => r.putcml(["again"])).toThrow(/PUTCMLCALLEDTWICE/);
        expect(r.failed()).toBe(false);
        expect(r.rdtext("parallel")).toEqual({ line: "two", eof: false });
        const second = await spiceClients.toSync({ backend });
        try {
          if (backend === "node")
            expect(() => second.spice.raw.putcml([])).toThrow(
              /PUTCMLCALLEDTWICE/,
            );
          else expect(second.spice.raw.putcml([])).toBeUndefined();
        } finally {
          await second.dispose();
        }
      } finally {
        await client.dispose();
      }
    });
  });
it("preserves an outstanding native owner and closes an unrelated unit without losing its cursor", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "c14-owner-"));
  const paths = ["shared", "unrelated"].map((p) => path.join(root, p));
  for (const p of paths) fs.writeFileSync(p, "one\ntwo\nthree\n");
  const a = await spiceClients.toSync({ backend: "node" }),
    b = await spiceClients.toSync({ backend: "node" });
  try {
    expect(a.spice.raw.rdtext(paths[0]!).line).toBe("one");
    expect(a.spice.raw.rdtext(paths[1]!).line).toBe("one");
    expect(b.spice.raw.rdtext(paths[0]!).line).toBe("two");
    await a.dispose();
    expect(b.spice.raw.rdtext(paths[0]!).line).toBe("three");
    expect(b.spice.raw.rdtext(paths[0]!)).toEqual({ eof: true, line: "" });
    expect(b.spice.raw.rdtext(paths[1]!).line).toBe("one");
    await b.dispose();
    const c = await spiceClients.toSync({ backend: "node" });
    try {
      expect(c.spice.raw.rdtext(paths[1]!).line).toBe("one");
    } finally {
      await c.dispose();
    }
  } finally {
    await a.dispose();
    await b.dispose();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
