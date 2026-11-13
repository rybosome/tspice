import { describe, expect, it } from "vitest";
import { createSpiceHandleRegistry } from "@rybosome/tspice-core";

describe("opaque file token owner and lifecycle", () => {
  for (const kind of ["DAF", "DAS", "DLA", "SPK", "EK"] as const)
    it(`${kind}: rejects another registry's otherwise valid handle`, () => {
      const a = createSpiceHandleRegistry();
      const b = createSpiceHandleRegistry();
      const ha = a.register(kind, 17);
      const hb = b.register(kind, 17);
      expect(() => b.lookup(ha, [kind], "foreign read")).toThrow(
        /invalid|closed/,
      );
      expect(() =>
        b.close(
          ha,
          [kind],
          () => {
            throw new Error("must not call native");
          },
          "foreign close",
        ),
      ).toThrow(/invalid|closed/);
      expect(b.lookup(hb, [kind], "own")).toEqual({ kind, nativeHandle: 17 });
      // A failed native close retains ownership so cleanup can be retried.
      expect(() =>
        a.close(
          ha,
          [kind],
          () => {
            throw new Error("native close failed");
          },
          "close",
        ),
      ).toThrow("native close failed");
      expect(a.lookup(ha, [kind], "retry").nativeHandle).toBe(17);
      a.close(ha, [kind], () => undefined, "close");
      const next = a.register(kind, 17);
      expect(() => a.lookup(ha, [kind], "expired")).toThrow(/invalid|closed/);
      expect(a.lookup(next, [kind], "new").nativeHandle).toBe(17);
      b.close(hb, [kind], () => undefined, "close");
      a.close(next, [kind], () => undefined, "close");
      expect(a.size()).toBe(0);
      expect(b.size()).toBe(0);
    });
});
