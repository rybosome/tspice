import { expect, it, vi } from "vitest";
import { createNodeBackend } from "@rybosome/tspice-backend-node";
import { createSpiceHandleRegistry } from "@rybosome/tspice-core";
import { createEkApi } from "../src/domains/ek.js";
import { getNativeAddon } from "../src/runtime/addon.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";
const test = it.runIf(nodeAddonAvailable());
test("copies schema entries once and forwards each name and declaration with its own byte stride", () => {
  const n = getNativeAddon(),
    owner = createSpiceHandleRegistry(),
    raw = createEkApi(n, owner);
  const h = raw.ekops();
  try {
    const scope = vi.spyOn(n, "ekbseg");
    const seen: string[] = [];
    const rows = (tag: string, arr: string[]) =>
      new Proxy(arr, {
        get(t, k, r) {
          if (k === "length" || k === "0" || k === "1") {
            const id = tag + k;
            if (seen.includes(id))
              throw new Error("Duplicate schema read " + id);
            seen.push(id);
          }
          return Reflect.get(t, k, r);
        },
      });
    try {
      expect(
        raw.ekbseg(
          h,
          "TABLE",
          rows("n", ["FIRST", "X"]),
          rows("d", ["DATATYPE=INTEGER", "DATATYPE=TIME"]),
        ),
      ).toBe(0);
      const call = scope.mock.calls[0];
      expect(call).toBeDefined();
      expect(call!.slice(1, 4)).toEqual(["TABLE", 2, 6]);
      expect([...call![4]]).toEqual([70, 73, 82, 83, 84, 0, 88, 0, 0, 0, 0, 0]);
      expect(call![5]).toBe(17);
      expect(seen).toHaveLength(6);
    } finally {
      scope.mockRestore();
    }
  } finally {
    raw.ekcls(h);
  }
});
test("validates representable ordinals, paired bounds, text and native rectangular storage before scientific use", () => {
  const n = getNativeAddon(),
    { raw } = createNodeBackend(),
    h = raw.ekops();
  try {
    const huge = new Proxy<string[]>([], {
      get(_, k) {
        if (k === "length") return 101;
        throw new Error("element accessed");
      },
    });
    expect(() => raw.ekbseg(h, "T", huge, [])).toThrow(/1\.\.100/);
    expect(() => raw.ekbseg(h, "T", ["I"], [])).toThrow(/matching/);
    for (const text of ["I\0Z", "\ud800"])
      expect(() => raw.ekbseg(h, "T", [text], ["DATATYPE=INTEGER"])).toThrow(
        /UTF-8/,
      );
    for (const f of [
      () => raw.ekappr(h, 2147483647),
      () => raw.ekinsr(h, 0, 2147483647),
      () => raw.ekdelr(h, 0, 1.5),
    ])
      expect(f).toThrow();
    const bad = Uint8Array.of(65, 65),
      good = Uint8Array.of(65, 0);
    expect(() => n.ekbseg(0, "T", 1, 2, bad, 2, good)).toThrow(/Unterminated/);
    expect(() => n.ekbseg(0, "T", 2, 2, good, 2, good)).toThrow(/dimensions/);
    expect(() => n.ekbseg(0, "T", 1, 2, good, 2147483647, good)).toThrow(
      /dimensions/,
    );
    expect(raw.eknseg(h)).toBe(0);
    expect(() => raw.ekappr(h, -1)).toThrow(/INVALIDINDEX/);
    expect(raw.ekbseg(h, "S", ["ID"], ["DATATYPE=INTEGER"])).toBe(0);
  } finally {
    raw.ekcls(h);
  }
});
test("cleans up an unpublished scratch writer even if registration fails", () => {
  const n = getNativeAddon(),
    owner = createSpiceHandleRegistry(),
    raw = createEkApi(n, owner),
    register = vi.spyOn(owner, "register").mockImplementationOnce(() => {
      throw new Error("test registry publication");
    }),
    close = vi.spyOn(n, "ekcls");
  try {
    expect(() => raw.ekops()).toThrow(/publication/);
    expect(close).toHaveBeenCalledTimes(1);
    expect(owner.size()).toBe(0);
  } finally {
    register.mockRestore();
    close.mockRestore();
  }
  const h = raw.ekops();
  expect(raw.eknseg(h)).toBe(0);
  raw.ekcls(h);
});
