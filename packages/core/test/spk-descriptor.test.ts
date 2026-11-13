import { expect, it } from "vitest";
import {
  copySpkPackedDescriptor,
  copySpkPackedDescriptorWords,
} from "../src/spice-runtime/shared/spk-descriptor.js";
it("retains every opaque bit and copies independently of source/caller mutation", () => {
  const source = new DataView(new ArrayBuffer(40));
  source.setFloat64(0, -123.5, true);
  source.setFloat64(8, 456.75, true);
  source.setInt32(16, -123456, true);
  source.setInt32(20, -42, true);
  const original = Array.from(new Uint8Array(source.buffer));
  const descriptor = copySpkPackedDescriptor(new Float64Array(source.buffer));
  new Uint8Array(source.buffer).fill(0);
  expect(Object.keys(descriptor)).toEqual(["0", "1", "2", "3", "4"]);
  expect(
    Array.from(new Uint8Array(copySpkPackedDescriptorWords(descriptor).buffer)),
  ).toEqual(original);
  const returned = copySpkPackedDescriptorWords(descriptor);
  new Uint8Array(returned.buffer).fill(0);
  expect(
    Array.from(new Uint8Array(copySpkPackedDescriptorWords(descriptor).buffer)),
  ).toEqual(original);
  // Plain numerical caller copies are accepted; changed visible fields must not
  // silently reuse earlier metadata. The public descriptor itself is readonly.
  Reflect.set(descriptor, 0, 99);
  expect(copySpkPackedDescriptorWords(descriptor)[0]).toBe(99);
});
it("rejects malformed descriptor shape/type and accepts opaque nonfinite words", () => {
  for (const bad of [
    null,
    [],
    [1, 2, 3, 4],
    [1, 2, 3, 4, "5"],
    new Float64Array(4),
  ])
    expect(() => copySpkPackedDescriptor(bad)).toThrow(/five numeric words/);
  expect(
    copySpkPackedDescriptor([NaN, Infinity, -Infinity, 0, 1]),
  ).toHaveLength(5);
});
