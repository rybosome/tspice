import type { SpiceHandle, SpiceHandleRegistry } from "./types.js";
import { assertSpiceInt32 } from "./spice-int.js";
type Descriptor = readonly [number, number, number, number, number];
const storage = Symbol.for("@rybosome/tspice/spk-descriptor-words");

function copyBits(words: Float64Array): Float64Array {
  // Copy bytes, never float elements: JavaScript may canonicalize Number NaNs.
  const bytes = new Uint8Array(40);
  bytes.set(new Uint8Array(words.buffer, words.byteOffset, 40));
  return new Float64Array(bytes.buffer);
}
/** Whether a returned public tuple retains its opaque packed-word storage. */
export function hasSpkPackedDescriptorStorage(value: unknown): boolean {
  return (
    Array.isArray(value) && Reflect.get(value, storage) instanceof Float64Array
  );
}
/** Copy validated descriptor storage for FFI/RPC without interpreting integer pairs as floats. */
export function copySpkPackedDescriptorWords(value: unknown): Float64Array {
  if (
    (!Array.isArray(value) && !(value instanceof Float64Array)) ||
    value.length !== 5
  )
    throw new TypeError(
      "SPK descriptor must contain exactly five numeric words",
    );
  if (value instanceof Float64Array) return copyBits(value);
  // Snapshot each visible word once before testing the hidden bit-preserving
  // representation. Accessors may return a different value on a second read.
  const snapshot: unknown[] = [
    value[0],
    value[1],
    value[2],
    value[3],
    value[4],
  ];
  const words = new Float64Array(5);
  for (const [index, word] of snapshot.entries()) {
    if (typeof word !== "number")
      throw new TypeError(
        "SPK descriptor must contain exactly five numeric words",
      );
    words[index] = word;
  }
  const stored: unknown = Reflect.get(value, storage);
  if (
    stored instanceof Float64Array &&
    stored.length === 5 &&
    snapshot.every((word, index) => Object.is(word, stored[index]))
  )
    return copyBits(stored);
  return words;
}
/**
 * Return the existing public five-number shape with hidden exact packed storage.
 * Some signed integer pairs form NaN bits. Retaining bytes keeps raw pack/unpack
 * and worker transport correct even when V8 canonicalizes the visible Number.
 */
export function copySpkPackedDescriptor(value: unknown): Descriptor {
  const words = copySpkPackedDescriptorWords(value);
  const out: Descriptor = [
    words[0]!,
    words[1]!,
    words[2]!,
    words[3]!,
    words[4]!,
  ];
  Object.defineProperty(out, storage, { value: words });
  return out;
}

/** Private facade cleanup capability for direct SPK registrations. */
export const releaseSpkLoads = Symbol("release owned SPK loads");

/** Capture exact caller-supplied native descriptor bytes or the retained SPKSFS tuple. */
export function spkSegmentBytes(input: unknown): Uint8Array {
  if (input instanceof Uint8Array) {
    if (input.byteLength !== 40)
      throw new RangeError("Expected exactly 40 packed SPK descriptor bytes");
    return new Uint8Array(input);
  }
  return new Uint8Array(copySpkPackedDescriptorWords(input).buffer);
}

/** Compare the source generation independently of its signed DAF handle.
 * Each client records only successful SPKSFS observations and its direct loads.
 */
export function createSpkReaders(handles: SpiceHandleRegistry) {
  const borrowed = new Map<number, number>();
  const byGeneration = new Map<number, SpiceHandle>();
  return {
    observe(physical: number, generation: number) {
      assertSpiceInt32(physical, "SPKSFS handle");
      assertSpiceInt32(generation, "SPKSFS generation", { min: 1 });
      borrowed.set(physical, generation);
    },
    own(generation: number): SpiceHandle {
      const prior = byGeneration.get(generation);
      if (prior !== undefined) return prior;
      const token = handles.register("SPK-LOAD", generation);
      byGeneration.set(generation, token);
      return token;
    },
    unload(token: SpiceHandle, close: (generation: number) => void) {
      handles.close(
        token,
        ["SPK-LOAD"],
        ({ nativeHandle }) => {
          close(nativeHandle);
          byGeneration.delete(nativeHandle);
        },
        "spkuef",
      );
    },
    release(unload: (token: SpiceHandle) => void) {
      for (const token of byGeneration.values()) unload(token);
      borrowed.clear();
    },
    source(token: number): { source: number; registered: boolean } {
      if (
        Number.isInteger(token) &&
        token >= -2147483648 &&
        token <= 2147483647
      ) {
        const generation = borrowed.get(token);
        if (generation === undefined)
          throw new RangeError(
            "Unknown borrowed SPK handle: use a result from spksfs",
          );
        return { source: generation, registered: true };
      }
      const entry = handles.lookup(
        token,
        ["SPK-LOAD", "DAF"],
        "SPK segment input",
      );
      return {
        source: entry.nativeHandle,
        registered: entry.kind === "SPK-LOAD",
      };
    },
  };
}
/** Validate a NUL-free well-formed UTF-8 input before either backend encodes it. */
export function spkInputText(value: string): string {
  if (
    typeof value !== "string" ||
    value.includes("\0") ||
    /(?:[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF])/.test(
      value,
    )
  )
    throw new TypeError("Expected a well-formed NUL-free SPK string");
  return value;
}

/** Snapshot all six numeric outputs of SPKPVN, including IEEE overflow of genuine finite coefficients. */
export function spkStateComponents(
  value: unknown,
): [number, number, number, number, number, number] {
  if (
    (!Array.isArray(value) && !(value instanceof Float64Array)) ||
    value.length !== 6
  )
    throw new TypeError("Expected six numeric SPK state components");
  const component = (index: number): number => {
    const number: unknown = value[index];
    if (typeof number !== "number")
      throw new TypeError("Expected a numeric SPK state component");
    return number;
  };
  return [
    component(0),
    component(1),
    component(2),
    component(3),
    component(4),
    component(5),
  ];
}
