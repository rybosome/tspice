import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { expect, it } from "vitest";
import { createNodeBackend } from "../src/index.js";
import { getNativeAddon } from "../src/runtime/addon.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

const run = it.runIf(nodeAddonAvailable());
function dispose(backend: ReturnType<typeof createNodeBackend>) {
  const cleanup: unknown = Reflect.get(backend, "disposeAll");
  if (typeof cleanup !== "function") throw Error("Missing backend disposal");
  Reflect.apply(cleanup, backend, []);
}
run(
  "raw addon validates stored degree, record extent, actual epochs and signed indices before CSPICE can index",
  () => {
    const native = getNativeAddon(),
      dir = fs.mkdtempSync(path.join(os.tmpdir(), "type14-addon-"));
    try {
      const h = native.spkopn(path.join(dir, "a.bsp"), "T", 0);
      expect(() =>
        native.spk14b(h, "TEST", 101, 0, "J2000", -1, 1, 2147483647),
      ).toThrow(/width/);
      native.spk14b(h, "TEST", 101, 0, "J2000", -1, 1, 1);
      const row = new Float64Array([
          0, 1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
        ]),
        epoch = new Float64Array([-1]);
      expect(() => native.spk14a(h, 2147483647, row, epoch)).toThrow(
        /Incomplete/,
      );
      expect(() => native.spk14a(h, 1, row.subarray(0, 8), epoch)).toThrow(
        /Incomplete/,
      );
      expect(() => native.spk14a(h, 1, row, epoch.subarray(0, 0))).toThrow(
        /Incomplete/,
      );
      expect(() => native.spk14a(h, 1, row, new Float64Array([NaN]))).toThrow(
        /Nonfinite/,
      );
      expect(() => native.spkcls(h)).toThrow(/spk14e/);
      native.spk14a(h, 1, row, epoch);
      native.spk14e(h);
      native.spkcls(h);
    } finally {
      fs.rmSync(dir, { force: true, recursive: true });
    }
  },
);
run(
  "denies foreign raw tokens before accessing getter-backed packet storage even with two active clients",
  () => {
    const a = createNodeBackend(),
      b = createNodeBackend();
    try {
      const ha = a.raw.spkopn(
          { kind: "virtual-output", path: "a.bsp" },
          "A",
          0,
        ),
        hb = b.raw.spkopn({ kind: "virtual-output", path: "b.bsp" }, "B", 0);
      a.raw.spk14b(ha, "A", 101, 0, "J2000", 0, 1, 1);
      b.raw.spk14b(hb, "B", 102, 0, "J2000", 0, 1, 0);
      const unread = new Proxy([0], {
        get() {
          throw Error("unexpected read");
        },
      });
      expect(() => b.raw.spk14a(ha, 1, unread, unread)).toThrow(/handle/i);
      expect(() => a.raw.spk14e(hb)).toThrow(/handle/i);
      b.raw.spk14a(hb, 1, [0.5, 0.5, 1, 2, 3, 4, 5, 6], [0]);
      b.raw.spk14e(hb);
      b.raw.spkcls(hb);
      a.raw.spk14a(ha, 1, [0.5, 0.5, 1, 0, 2, 0, 3, 0, 4, 0, 5, 0, 6, 0], [0]);
      a.raw.spk14e(ha);
      a.raw.spkcls(ha);
    } finally {
      dispose(a);
      dispose(b);
    }
  },
);
run(
  "disposing interrupted native streams physically finishes accepted packets and releases the generic table",
  () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "type14-dispose-")),
      file = path.join(dir, "accepted.bsp"),
      reader = createNodeBackend();
    try {
      for (let i = 0; i < 22; i++) {
        const writer = createNodeBackend(),
          f = i === 0 ? file : path.join(dir, "empty-" + i + ".bsp"),
          h = writer.raw.spkopn(f, "AUTHORED", 0);
        writer.raw.spk14b(h, "INTERRUPTED", 196014 + i, 0, "J2000", -1, 1, 0);
        if (i === 0) writer.raw.spk14a(h, 1, [0, 1, 9, 8, 7, 6, 5, 4], [-1]);
        dispose(writer);
        expect(fs.statSync(f).size).toBeGreaterThan(1024);
      }
      reader.raw.furnsh(file);
      expect(reader.raw.spkgeo(196014, 0, "J2000", 0).state).toEqual([
        9, 8, 7, 6, 5, 4,
      ]);
    } finally {
      reader.raw.kclear();
      dispose(reader);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);
run(
  "recovers a twenty-first writer after freeing one of the twenty actual generic slots",
  () => {
    const backend = createNodeBackend(),
      raw = backend.raw;
    try {
      const handles = Array.from({ length: 21 }, (_, i) =>
        raw.spkopn(
          { kind: "virtual-output", path: "limit-" + i + ".bsp" },
          "CAPACITY",
          0,
        ),
      );
      for (const [i, h] of handles.slice(0, 20).entries())
        raw.spk14b(h, "SLOT", 300 + i, 0, "J2000", 0, 1, 0);
      expect(() =>
        raw.spk14b(handles[20]!, "NEXT", 320, 0, "J2000", 0, 1, 0),
      ).toThrow(/active/);
      const ten = () =>
        raw.spkw10(
          handles[20]!,
          500,
          0,
          "J2000",
          -1,
          1,
          "TEN",
          [0.001, 0, 0, 0.074, 120, 78, 6378, 1],
          [0, 0, 0, 0.5, 0.2, 0.03, 0.4, 0.7, 0.06, 0],
          [0],
        );
      expect(ten).toThrow(/slots/);
      raw.spk14a(handles[19]!, 1, [0.5, 0.5, 9, 8, 7, 6, 5, 4], [0]);
      raw.spk14e(handles[19]!);
      ten();
      raw.spk14b(handles[20]!, "NEXT", 320, 0, "J2000", 0, 1, 0);
      for (const [i, h] of handles.entries()) {
        if (i !== 19) {
          raw.spk14a(h, 1, [0.5, 0.5, i, -i, 3, 4, 5, 6], [0]);
          raw.spk14e(h);
        }
        raw.spkcls(h);
      }
    } finally {
      dispose(backend);
    }
  },
);
