import { expect, it } from "vitest";
import { createNodeBackend } from "@rybosome/tspice-backend-node";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";
const test = it.runIf(nodeAddonAvailable());
const file = { kind: "virtual-output", path: "test/own.bc" } as const;
test("CK writer, stale, foreign and other file tokens are distinguished", () => {
  const a = createNodeBackend(),
    b = createNodeBackend();
  const w = a.raw.ckopn(file, "OWNED", 0);
  expect(() => a.kit.readVirtualOutput(file)).toThrow(/open|close/i);
  expect(() => b.raw.ckcls(w)).toThrow(/closed/);
  expect(() => a.raw.spkcls(w)).toThrow(/CK-WRITER/);
  expect(() => a.raw.ckcls(w)).toThrow(/NOSEGMENTSFOUND/);
  a.raw.ckw01(w, 1, 1, -123000, "J2000", false, "ONE", [1], [1, 0, 0, 0], []);
  a.raw.ckcls(w);
  expect(() => a.raw.ckcls(w)).toThrow(/closed/);
  expect(a.kit.readVirtualOutput(file).length).toBeGreaterThan(1024);
});
test("CK writers snapshot every field once and validate subtype width, shape, bounds, interval origin and finite values", () => {
  const a = createNodeBackend();
  const w = a.raw.ckopn(file, "SHAPES", 0);
  const put = (ticks: readonly number[], q: readonly number[]) =>
    a.raw.ckw01(w, 1, 2, -123000, "J2000", false, "ONE", ticks, q, []);
  expect(() => put([1, 2], [1, 0, 0, 0])).toThrow(/length/);
  expect(() => put([1], [Infinity, 0, 0, 0])).toThrow(/finite/);
  expect(() =>
    a.raw.ckw05(
      w,
      2,
      3,
      1,
      2,
      -123000,
      "J2000",
      true,
      "FIVE",
      [1, 2],
      new Array<number>(8).fill(1),
      0.5,
      [1],
    ),
  ).toThrow(/length/);
  expect(() =>
    a.raw.ckw05(
      w,
      1,
      1,
      1,
      2,
      -123000,
      "J2000",
      true,
      "FIVE",
      [1, 2],
      [1, 0, 0, 0, 0.98, 0.1, 0.1, 0.1],
      0.5,
      [2],
    ),
  ).toThrow(/first packet/);
  expect(() =>
    a.raw.ckw05(
      w,
      1,
      2147483647,
      1,
      2,
      -123000,
      "J2000",
      true,
      "FIVE",
      [1, 2],
      [1, 0, 0, 0, 0.98, 0.1, 0.1, 0.1],
      0.5,
      [1],
    ),
  ).toThrow(/degree/);
  const times = [1, 2];
  let reads = 0;
  Object.defineProperty(times, 0, {
    get() {
      if (++reads !== 1) throw Error("read twice");
      return 1;
    },
  });
  put(times, [1, 0, 0, 0, 0.98, 0.1, 0.1, 0.1]);
  expect(reads).toBe(1);
  a.raw.ckcls(w);
});
