import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { getNodeBinding } from "../src/lowlevel/binding.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";
const itNative = it.runIf(nodeAddonAvailable());
itNative(
  "returns copied native record bytes and deterministically restarts after closing its last owner",
  () => {
    const addon = getNodeBinding(),
      root = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-command-"));
    const file = path.join(root, "records");
    fs.writeFileSync(file, "first\t  \nnext\n");
    const a = addon.text_owner(),
      b = addon.text_owner();
    try {
      expect(() => addon.rdtext(a, file, 1)).toThrow(/STRINGTOOSHORT/);
      expect(() => addon.rdtext(a, file + "\0", 16)).toThrow();
      const first = addon.rdtext(a, file, 16);
      expect(first).toEqual({
        bytes: new Uint8Array([102, 105, 114, 115, 116, 9]),
        eof: false,
      });
      addon.release_text_owner(a);
      expect(addon.rdtext(b, file, 16)).toEqual(first);
      expect(new TextDecoder().decode(addon.rdtext(b, file, 16).bytes)).toBe(
        "next",
      );
      expect(new TextDecoder().decode(first.bytes)).toBe("first\t");
    } finally {
      addon.release_text_owner(a);
      addon.release_text_owner(b);
      fs.rmSync(root, { recursive: true, force: true });
    }
  },
);
itNative(
  "validates packed extents before the real one-time setter and returns independently owned observed bytes",
  () => {
    const n = getNodeBinding();
    expect(() => n.putcml(2, Uint8Array.of(65, 0))).toThrow();
    expect(() => n.putcml(1, Uint8Array.of(65))).toThrow();
    expect(() => n.putcml(1, Uint8Array.of(65, 0, 66, 0))).toThrow();
    const input = Uint8Array.of(65, 0, 0, 194, 181, 9, 0);
    const actual = n.putcml(3, input);
    input.fill(255);
    expect(actual).toEqual(Uint8Array.of(65, 0, 0, 194, 181, 9, 0));
    expect(() => n.putcml(0, new Uint8Array())).toThrow(/PUTCMLCALLEDTWICE/);
  },
);
