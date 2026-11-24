import { expect, it, vi } from "vitest";
import { createEkApi } from "../src/domains/ek.js";
import { getNativeAddon } from "../src/runtime/addon.js";
import { createSpiceHandleRegistry } from "@rybosome/tspice-core";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";
const test = it.runIf(nodeAddonAvailable());
test("snapshots caller values once and returns owned complete entries", () => {
  const addon = getNativeAddon(),
    raw = createEkApi(addon, createSpiceHandleRegistry()),
    h = raw.ekops();
  try {
    raw.ekbseg(
      h,
      "T",
      ["C", "D", "I"],
      [
        "DATATYPE=CHARACTER*(7),SIZE=VARIABLE",
        "DATATYPE=DOUBLE PRECISION, SIZE=VARIABLE",
        "DATATYPE=INTEGER,SIZE=VARIABLE",
      ],
    );
    raw.ekappr(h, 0);
    function once<T>(values: T[]) {
      const seen = new Set<PropertyKey>();
      return new Proxy(values, {
        get(target, k, receiver) {
          if (k === "length" || /^\d+$/.test(String(k))) {
            if (seen.has(k)) throw Error("duplicate read: " + String(k));
            seen.add(k);
          }
          return Reflect.get(target, k, receiver);
        },
      });
    }
    raw.ekacec(h, 0, 0, "C", once(["é", "x\t"]), false);
    raw.ekaced(h, 0, 0, "D", once([2.5, -3]), false);
    raw.ekacei(h, 0, 0, "I", once([17, 9]), false);
    const old = raw.ekrcec(h, 0, 0, "C", 8).values;
    raw.ekucec(h, 0, 0, "C", once(["A"]), false);
    raw.ekuced(h, 0, 0, "D", once([4]), false);
    raw.ekucei(h, 0, 0, "I", once([33]), false);
    expect(old).toEqual(["é     ", "x\t     "]);
    expect(raw.ekrced(h, 0, 0, "D").values).toEqual([4]);
    expect(raw.ekrcei(h, 0, 0, "I").values).toEqual([33]);
  } finally {
    raw.ekcls(h);
  }
});
test("direct compiled entry boundary validates packed input and frees the owning handle after recovery", () => {
  const n = getNativeAddon(),
    h = n.ekops();
  try {
    expect(() =>
      n.ekacec(h, 0, 0, "C", 2, 3, new Uint8Array(4), false),
    ).toThrow(/storage/);
    expect(() =>
      n.ekaced(h, 0, 0, "D", 1, 4, new Uint8Array(4), false),
    ).toThrow(/storage/);
    expect(() =>
      n.ekacei(h, 0, 0, "I", 2, 4, new Uint8Array(8), 3 as never),
    ).toThrow(/boolean/);
    expect(() => n.ekrced(h, 0, 0, "D", 1)).toThrow(/width/);
    expect(n.eknseg(h)).toBe(0);
  } finally {
    n.ekcls(h);
  }
});
test("rejects inconsistent adapter payloads and rejects wrong owners before native dispatch", () => {
  const n = getNativeAddon(),
    raw = createEkApi(n, createSpiceHandleRegistry()),
    other = createEkApi(n, createSpiceHandleRegistry()),
    h = raw.ekops();
  const read = vi.spyOn(n, "ekrcei");
  try {
    expect(() => other.ekrcei(h, 0, 0, "I")).toThrow(/invalid|closed/i);
    expect(read).not.toHaveBeenCalled();
    read.mockReturnValue({ isNull: false, nvals: 3, bytes: new Uint8Array(4) });
    expect(() => raw.ekrcei(h, 0, 0, "I")).toThrow(/storage/);
    expect(() => raw.ekrcei(h, 0, 2147483647, "I")).toThrow();
  } finally {
    read.mockRestore();
    raw.ekcls(h);
  }
});
