import { expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { createEkApi } from "../src/domains/ek.js";
import { getNativeAddon } from "../src/runtime/addon.js";
import { createSpiceHandleRegistry } from "@rybosome/tspice-core";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";
const test = it.runIf(nodeAddonAvailable());
const file = fileURLToPath(
  new URL(
    "../../py-parity-checking/fixtures/kernels/audit-query.ek",
    import.meta.url,
  ),
);
test("generation ownership survives other clients unloading and reloading the same physical reader", () => {
  const n = getNativeAddon(),
    a = createEkApi(n, createSpiceHandleRegistry()),
    b = createEkApi(n, createSpiceHandleRegistry());
  const r = a.ekopr(file);
  try {
    const first = a.eklef(file),
      alias = b.eklef(file);
    expect(() => b.ekssum(first, 0)).toThrow(/invalid|closed/i);
    b.ekuef(alias);
    const next = b.eklef(file);
    try {
      expect(() => a.ekssum(first, 0)).toThrow(/active/);
      a.ekuef(first);
      expect(b.ekccnt("audit_query")).toBe(7);
      expect(a.ekssum(r, 0)).toEqual(b.ekssum(next, 0));
    } finally {
      b.ekuef(next);
    }
  } finally {
    a.ekcls(r);
  }
});
test("compiled add-on bounds metadata ordinals, widths and result buffers before returning owned fields", () => {
  const n = getNativeAddon(),
    g = n.eklef(file);
  try {
    expect(() => n.ekcii("AUDIT_QUERY", 2147483647, 33)).toThrow(/Invalid/);
    expect(() => n.eknelt(0, 2147483647)).toThrow(/Invalid/);
    expect(() => n.ekssum(g, 1, 2147483647)).toThrow(/Invalid/);
    expect(() => n.ekccnt("A\0B")).toThrow(/Invalid/);
    const x = n.ekcii("AUDIT_QUERY", 0, 33);
    expect(Array.from(x.words)).toEqual([1, 2, 1, 1, 1, 0]);
    x.words.fill(-99);
    x.text.fill(0);
    expect(Array.from(n.ekcii("AUDIT_QUERY", 0, 33).words)).toEqual([
      1, 2, 1, 1, 1, 0,
    ]);
    expect(n.ekload_nseg(g)).toBe(1);
  } finally {
    n.ekuef(g);
  }
});
