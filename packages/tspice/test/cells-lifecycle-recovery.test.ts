import { describe, expect, it } from "vitest";
import { spiceClients, type Spice } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

type Track = (release: () => void) => () => void;
async function withBackend(
  backend: "wasm" | "node",
  run: (spice: Spice, track: Track) => void,
) {
  const { spice, dispose } = await spiceClients.toSync({ backend });
  const cleanup: (() => void)[] = [];
  const track: Track = (release) => {
    let active = true;
    const once = () => {
      if (active) {
        release();
        active = false;
      }
    };
    cleanup.push(once);
    return once;
  };
  try {
    run(spice, track);
  } finally {
    for (const release of cleanup.reverse()) {
      try {
        release();
      } catch {
        /* continue fixture cleanup */
      }
    }
    spice.raw.reset();
    await dispose();
  }
}

describe("raw cell/window lifecycle and recovery", () => {
  for (const backend of ["wasm", "node"] as const) {
    const testBackend =
      backend === "node" ? it.runIf(nodeBackendAvailable) : it;
    testBackend(
      `${backend}: set overflow preserves values and cardinality operations preserve stored data`,
      () =>
        withBackend(backend, (s, track) => {
          const i = s.kit.newIntCell(2);
          track(() => s.kit.freeCell(i));
          const d = s.kit.newDoubleCell(2);
          track(() => s.kit.freeCell(d));
          const c = s.kit.newCharCell(2, 8);
          track(() => s.kit.freeCell(c));
          s.raw.insrti(1, i);
          s.raw.insrti(3, i);
          s.raw.insrti(3, i);
          s.raw.insrtd(-1.5, d);
          s.raw.insrtd(1.25, d);
          s.raw.insrtd(1.25, d);
          s.raw.insrtc("a", c);
          s.raw.insrtc("z", c);
          s.raw.insrtc("z", c);
          expect(() => s.raw.insrti(2, i)).toThrow(/SETEXCESS/);
          expect(() => s.raw.insrtd(0, d)).toThrow(/SETEXCESS/);
          expect(() => s.raw.insrtc("b", c)).toThrow(/SETEXCESS/);
          expect(s.raw.failed()).toBe(false);
          expect([s.kit.cellGeti(i, 0), s.kit.cellGeti(i, 1)]).toEqual([1, 3]);
          expect([s.kit.cellGetd(d, 0), s.kit.cellGetd(d, 1)]).toEqual([
            -1.5, 1.25,
          ]);
          expect([s.kit.cellGetc(c, 0), s.kit.cellGetc(c, 1)]).toEqual([
            "a",
            "z",
          ]);
          expect(() => s.raw.scard(3, i)).toThrow(/INVALIDCARDINALITY/);
          s.raw.scard(1, i);
          expect(s.raw.card(i)).toBe(1);
          s.raw.scard(2, i);
          expect(s.kit.cellGeti(i, 1)).toBe(3);
          s.raw.scard(0, i);
          s.raw.insrti(9, i);
          expect(s.raw.card(i)).toBe(1);
          expect(s.raw.size(i)).toBe(2);
          expect(s.kit.cellGeti(i, 0)).toBe(9);
          for (const value of [0.5, NaN, Infinity, 0x8000_0000])
            expect(() => s.raw.insrti(value, i)).toThrow(/insrti/);
          expect(s.kit.cellGeti(i, 0)).toBe(9);
        }),
    );
    testBackend(
      `${backend}: window errors preserve contents and allow subsequent merging`,
      () =>
        withBackend(backend, (s, track) => {
          const w = s.kit.newWindow(1);
          track(() => s.kit.freeWindow(w));
          s.raw.wninsd(0, 1, w);
          expect(() => s.raw.wninsd(3, 4, w)).toThrow(/WINDOWEXCESS/);
          expect(() => s.raw.wninsd(2, 1, w)).toThrow(/BADENDPOINTS/);
          expect(() => s.raw.wnfetd(w, 1)).toThrow(/NOINTERVAL/);
          expect(s.raw.failed()).toBe(false);
          expect(s.raw.wnfetd(w, 0)).toEqual([0, 1]);
          s.raw.wninsd(1, 2, w);
          s.raw.wninsd(2, 2, w);
          expect(s.raw.wncard(w)).toBe(1);
          expect(s.raw.card(w)).toBe(2);
          expect(s.raw.wnfetd(w, 0)).toEqual([0, 2]);
          for (const index of [-1, 0.5, NaN, Infinity])
            expect(() => s.raw.wnfetd(w, index)).toThrow(/wnfetd/);
          s.raw.scard(0, w);
          expect(s.raw.wncard(w)).toBe(0);
          s.raw.wninsd(-4, -3, w);
          expect(s.raw.wnfetd(w, 0)).toEqual([-4, -3]);
        }),
    );
    testBackend(
      `${backend}: rejects wrong types and every expired raw cell/window handle`,
      () =>
        withBackend(backend, (s, track) => {
          const i = s.kit.newIntCell(2);
          const fi = track(() => s.kit.freeCell(i));
          const d = s.kit.newDoubleCell(2);
          const fd = track(() => s.kit.freeCell(d));
          const c = s.kit.newCharCell(2, 8);
          const fc = track(() => s.kit.freeCell(c));
          const w = s.kit.newWindow(2);
          const fw = track(() => s.kit.freeWindow(w));
          // Contained casts intentionally violate element/handle brands for misuse checks.
          expect(() => s.raw.insrti(1, d as never)).toThrow(/SPICE_INT/);
          expect(() => s.raw.insrtd(1, c as never)).toThrow(/SPICE_DP/);
          expect(() => s.raw.insrtc("a", i as never)).toThrow(/SPICE_CHR/);
          expect(() => s.raw.wninsd(0, 1, i as never)).toThrow(
            /SPICE_DP|window/,
          );
          fi();
          fd();
          fc();
          fw();
          const expired = [
            () => s.raw.card(i),
            () => s.raw.size(i),
            () => s.raw.scard(0, i),
            () => s.raw.insrti(1, i),
            () => s.raw.insrtd(1, d),
            () => s.raw.insrtc("a", c),
            () => s.raw.wncard(w),
            () => s.raw.wninsd(0, 1, w),
            () => s.raw.wnfetd(w, 0),
          ];
          for (const attempt of expired)
            expect(attempt).toThrow(/unknown|expired|handle/);
          for (const handle of [
            0,
            -1,
            0.5,
            NaN,
            Infinity,
            Number.MAX_SAFE_INTEGER,
          ]) {
            expect(() => s.raw.card(handle as never)).toThrow(
              /handle|integer|uint32/,
            );
            expect(() => s.raw.size(handle as never)).toThrow(
              /handle|integer|uint32/,
            );
          }
          expect(s.raw.failed()).toBe(false);
        }),
    );
    testBackend(
      `${backend}: character insertion rejects non-string runtime input`,
      () =>
        withBackend(backend, (s, track) => {
          const c = s.kit.newCharCell(4, 16);
          track(() => s.kit.freeCell(c));
          // JavaScript callers can bypass the compile-time string parameter.
          for (const value of [12, null, undefined, {}, []])
            expect(() => s.raw.insrtc(value as never, c)).toThrow(/string/);
          expect(s.raw.card(c)).toBe(0);
        }),
    );
  }
});
