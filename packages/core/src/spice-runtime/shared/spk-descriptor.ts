type Descriptor = readonly [number, number, number, number, number];
const storage = Symbol.for("@rybosome/tspice/spk-descriptor-words");

function isFiveWords(value: unknown): value is Descriptor | Float64Array {
  return (
    (Array.isArray(value) || value instanceof Float64Array) &&
    value.length === 5 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    typeof value[2] === "number" &&
    typeof value[3] === "number" &&
    typeof value[4] === "number"
  );
}
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
  if (!isFiveWords(value))
    throw new TypeError(
      "SPK descriptor must contain exactly five numeric words",
    );
  if (value instanceof Float64Array) return copyBits(value);
  const stored: unknown = Reflect.get(value, storage);
  if (
    stored instanceof Float64Array &&
    stored.length === 5 &&
    value.every((word, index) => Object.is(word, stored[index]))
  )
    return copyBits(stored);
  // Plain caller-created tuples remain supported. A tuple returned by a backend
  // carries exact storage because a NaN Number alone cannot guarantee its payload.
  const words = new Float64Array(5);
  for (let i = 0; i < 5; i++) words[i] = value[i]!;
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
