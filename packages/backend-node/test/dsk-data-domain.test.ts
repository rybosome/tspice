import path from "node:path";
import { it, expect, vi } from "vitest";
import { createSpiceHandleRegistry } from "@rybosome/tspice-core";
import { createFileIoApi } from "../src/domains/file-io.js";
import { createDskApi } from "../src/domains/dsk.js";
import { getNativeAddon, type NativeAddon } from "../src/native.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";
// Each test exercises one addon entry point. Missing entries fail on unexpected dispatch.
function dskDouble(methods: Partial<NativeAddon>): NativeAddon {
  return methods as NativeAddon;
}

const d = {
  bwdptr: -1,
  fwdptr: -1,
  ibase: 40,
  isize: 300,
  dbase: 0,
  dsize: 46,
  cbase: 0,
  csize: 0,
};
const cases = [
  { n: "dskd02", args: [19, 0, 3], returned: [1, 2, 3], expected: [1, 2, 3] },
  { n: "dski02", args: [9, 0, 3], returned: [1, 3, 2], expected: [1, 3, 2] },
  {
    n: "dskp02",
    args: [2, 9],
    returned: [1, 3, 2, 2, 3, 4],
    expected: [
      [1, 3, 2],
      [2, 3, 4],
    ],
  },
  {
    n: "dskv02",
    args: [2, 9],
    returned: [1, 3, 2, 2, 3, 4],
    expected: [
      [1, 3, 2],
      [2, 3, 4],
    ],
  },
  { n: "dskn02", args: [1], returned: [0, -0, -1], expected: [0, -0, -1] },
  { n: "dskz02", args: [], returned: [4, 11], expected: { nv: 4, np: 11 } },
] as const;
for (const t of cases) {
  it(
    t.n +
      " snapshots every descriptor field once, owns output and delegates through the live token",
    () => {
      const handles = createSpiceHandleRegistry(),
        h = handles.register("DAS", 17),
        seen = new Set<PropertyKey>();
      const input = new Proxy(d, {
        get(target, k) {
          if (seen.has(k)) throw new Error("Repeated descriptor read");
          seen.add(k);
          return Reflect.get(target, k);
        },
      });
      const result: number[] = [...t.returned];
      const spy = vi.fn((..._args: unknown[]) => result);
      const api = createDskApi(dskDouble({ [t.n]: spy }), handles, {
        resolvePathForSpice: (p) => p,
      });
      const out = Reflect.apply(api[t.n], api, [h, input, ...t.args]);
      expect(spy.mock.calls[0]).toEqual([17, d, ...t.args]);
      expect(Object.is(spy.mock.calls[0]?.[1], input)).toBe(false);
      result[0] = -999;
      expect(out).toEqual(t.expected);
      expect(seen.size).toBe(8);
    },
  );
  it(
    t.n +
      " rejects foreign tokens and invalid component ranges before dispatch",
    () => {
      const handles = createSpiceHandleRegistry(),
        h = handles.register("DLA", 3),
        foreign = createSpiceHandleRegistry().register("DAS", 3);
      const spy = vi.fn(),
        api = createDskApi(dskDouble({ [t.n]: spy }), handles, {
          resolvePathForSpice: (p) => p,
        });
      for (const [handle, desc] of [
        [foreign, d],
        [h, { ...d, dsize: -1 }],
        [h, { ...d, ibase: 2 ** 31 }],
      ] as const)
        expect(() =>
          Reflect.apply(api[t.n], api, [handle, desc, ...t.args]),
        ).toThrow();
      expect(spy).not.toHaveBeenCalled();
    },
  );
}
it("a failed physical close preserves the token for a successful retry", () => {
  const handles = createSpiceHandleRegistry(),
    h = handles.register("DAS", 8);
  let attempt = 0;
  const close = vi.fn(() => {
    if (++attempt === 1) throw new Error("physical close failed");
  });
  const api = createDskApi(dskDouble({ dskcls: close }), handles, {
    resolvePathForSpice: (p) => p,
  });
  expect(() => Reflect.apply(api.dskcls, api, [h, 1])).toThrow(/boolean/);
  expect(() => api.dskcls(h, false)).toThrow(/physical/);
  expect(handles.size()).toBe(1);
  api.dskcls(h, true);
  expect(handles.size()).toBe(0);
  expect(() => api.dskcls(h, true)).toThrow(/closed/);
  expect(close.mock.calls).toEqual([
    [8, false],
    [8, true],
  ]);
});
it.runIf(nodeAddonAvailable())(
  "actual Node addon guards scalar offsets and file descriptor mismatch before returning a physical partial page",
  () => {
    const native = getNativeAddon(),
      h = native.dasopr(
        path.resolve(
          import.meta.dirname,
          "../../py-parity-checking/fixtures/kernels/audit-multi-dsk.bds",
        ),
      );
    try {
      const handles = createSpiceHandleRegistry();
      const fileIo = createFileIoApi(native, handles, {
        resolvePathForSpice: (p) => p,
      });
      const found = fileIo.dlabfs(handles.register("DAS", h));
      if (!found.found) throw new Error("Missing fixture descriptor");
      const descriptor = found.descr;
      expect(() => native.dski02(h, descriptor, 1, 7, 1)).toThrow(/Scalar/);
      expect(() =>
        native.dskn02(h, { ...descriptor, dbase: 2147483647 }, 2),
      ).toThrow(/descriptor/);
      expect(native.dskp02(h, descriptor, 4, 4)).toEqual([3, 1, 4]);
    } finally {
      native.dskcls(h, false);
    }
  },
);
