import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { getNodeBinding } from "../src/lowlevel/binding.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";
import { spkSegmentBytes } from "@rybosome/tspice-core";
const file = fileURLToPath(
  new URL(
    "../../py-parity-checking/fixtures/kernels/audit-ephemeris.bsp",
    import.meta.url,
  ),
);
const native = it.runIf(nodeAddonAvailable());
native(
  "authenticates exact descriptor bytes through the compiled addon and preserves caller outputs",
  () => {
    const n = getNodeBinding(),
      h = n.spklef(file);
    try {
      const s = n.spksfs(-100011, 125);
      expect(s.generation).toBe(h);
      const b = spkSegmentBytes(s.descr);
      expect(() => n.spkpvn(h, true, b.subarray(1), 125)).toThrow(/40/);
      expect(() => n.spkpvn(h, true, new Uint8Array(40), 125)).toThrow(
        /does not belong/,
      );
      const out = n.spkpvn(h, true, b, 125);
      expect(out.state).toEqual([
        8187.5, -20078.125, 30054.6875, 1.75, -0.5, 0.375,
      ]);
      const other = n.spkpvn(h, true, b, 1);
      other.state.fill(0);
      expect(out.state[0]).toBe(8187.5);
      expect(() => n.spkpvn(h, true, b, 1001)).toThrow(/TIMEOUTOFBOUNDS/);
      expect(n.spkpvn(h, true, b, 125).center).toBe(-100010);
    } finally {
      n.spkuef(h);
    }
  },
);
native(
  "writes only from an authenticated source into a separate writable file and recovers after a rejected interval",
  () => {
    const n = getNodeBinding(),
      root = fs.mkdtempSync(path.join(os.tmpdir(), "e03-native-"));
    const file2 = path.join(root, "part.bsp");
    const h = n.spklef(file),
      writer = n.spkopn(file2, "SUBSET", 0);
    let open = true;
    try {
      const s = n.spksfs(-100011, 125);
      if (!s.found || s.handle === undefined) throw Error("missing source");
      const b = spkSegmentBytes(s.descr);
      expect(() => n.spksub(h, true, b, "ID", 0, 1, s.handle!)).toThrow(
        /separate/,
      );
      const foreign = path.join(root, "other.bc");
      const original = fs.readFileSync(
        new URL(
          "../../py-parity-checking/fixtures/kernels/audit-pointing.bc",
          import.meta.url,
        ),
      );
      fs.writeFileSync(foreign, original);
      const ckWriter = n.dafopw(foreign);
      try {
        expect(() => n.spksub(h, true, b, "ID", 0, 1, ckWriter)).toThrow(
          /SPK subset writer/,
        );
      } finally {
        n.dafcls(ckWriter);
      }
      expect(fs.readFileSync(foreign)).toEqual(original);
      expect(() => n.spksub(h, true, b, "ID", 2, -2, writer)).toThrow(
        /SPKNOTASUBSET/,
      );
      n.spksub(h, true, b, "ID", -2, 2, writer);
      n.spkcls(writer);
      open = false;
      const result = n.spklef(file2);
      try {
        expect(n.spksfs(-100011, 1).ident).toBe("ID");
      } finally {
        n.spkuef(result);
      }
    } finally {
      if (open) n.dafcls(writer);
      n.spkuef(h);
      fs.rmSync(root, { recursive: true, force: true });
    }
  },
);
