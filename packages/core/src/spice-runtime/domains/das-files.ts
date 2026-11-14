import { assertSpiceInt32 } from "../shared/spice-int.js";

function dasWord(words: readonly number[], index: number): number {
  const value = words[index];
  if (typeof value !== "number")
    throw new TypeError("Missing DAS summary word");
  assertSpiceInt32(value, "DAS summary word");
  return value;
}

/** Decode a fourteen-word N0067 file summary in character, double, integer order. */
export function decodeDasSummary(words: readonly number[]) {
  if (words.length !== 14)
    throw new TypeError("Expected fourteen DAS summary words");
  const triple = (i: number): [number, number, number] => [
    dasWord(words, i),
    dasWord(words, i + 1),
    dasWord(words, i + 2),
  ];
  return {
    nresvr: dasWord(words, 0),
    nresvc: dasWord(words, 1),
    ncomr: dasWord(words, 2),
    ncomc: dasWord(words, 3),
    free: dasWord(words, 4),
    lastla: triple(5),
    lastrc: triple(8),
    lastwd: triple(11),
  };
}

/** Decode the three final logical addresses from DASLLA. */
export function decodeDasAddresses(words: readonly number[]) {
  if (words.length !== 3)
    throw new TypeError("Expected three DAS last addresses");
  return {
    lastc: dasWord(words, 0),
    lastd: dasWord(words, 1),
    lasti: dasWord(words, 2),
  };
}

/** Decode the four counters and both actual strings from a DAS file record. */
export function decodeDasFileRecord(
  idword: string,
  ifname: string,
  words: readonly number[],
) {
  if (
    typeof idword !== "string" ||
    typeof ifname !== "string" ||
    words.length !== 4
  )
    throw new TypeError("Malformed DAS file record");
  return {
    idword,
    ifname,
    nresvr: dasWord(words, 0),
    nresvc: dasWord(words, 1),
    ncomr: dasWord(words, 2),
    ncomc: dasWord(words, 3),
  };
}

/** Snapshot one DAS name or path for a C call; embedded NUL and isolated surrogates cannot round trip. */
export function dasText(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.includes("\0") ||
    /[\uD800-\uDFFF]/u.test(value)
  )
    throw new TypeError("Expected a UTF-8 representable NUL-free DAS string");
  return value;
}

/** Snapshot an immediate DAS file argument before opening its physical file. */
export function dasFileTarget(
  value: unknown,
): string | { kind: "virtual-output"; path: string } {
  if (typeof value === "string") return dasText(value);
  if (
    !value ||
    typeof value !== "object" ||
    !("kind" in value) ||
    value.kind !== "virtual-output" ||
    !("path" in value)
  )
    throw new TypeError("Expected a DAS path or VirtualOutput");
  return { kind: "virtual-output", path: dasText(value.path) };
}

const dasTransferBytes = 256 * 1024 * 1024;

function checkDasCount(count: number, width: number): void {
  if (
    !Number.isSafeInteger(count) ||
    count < 0 ||
    count > dasTransferBytes / width
  )
    throw new RangeError("DAS transfer exceeds the 256 MiB buffer limit");
}

/** Bound owned storage before reading any array entries. Doubles retain their IEEE bit categories. */
export function copyDasValues(
  value: unknown,
  kind: "double" | "integer",
): number[] {
  if (!Array.isArray(value)) throw new TypeError("Expected a DAS number array");
  const count = value.length;
  checkDasCount(count, kind === "double" ? 8 : 4);
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    const word: unknown = value[i];
    if (typeof word !== "number")
      throw new TypeError("Expected a number in DAS data");
    if (kind === "integer") assertSpiceInt32(word, "DAS integer data");
    result.push(word);
  }
  return result;
}

/** Copy a rectangular table of arbitrary DAS bytes, including NUL and invalid UTF-8. */
export function copyDasBytes(value: unknown): Uint8Array {
  if (!(value instanceof Uint8Array))
    throw new TypeError("Expected a DAS Uint8Array");
  // Use the typed array's internal length, including for Uint8Array subclasses.
  const getLength = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(Uint8Array.prototype),
    "length",
  )?.get;
  if (!getLength)
    throw new TypeError("Typed array length accessor unavailable");
  const length: unknown = getLength.call(value);
  if (typeof length !== "number")
    throw new TypeError("Invalid DAS byte length");
  checkDasCount(length, 1);
  const result = new Uint8Array(length);
  // set reads the source typed array by its internal slots and rejects a grow
  // beyond the captured length before copying any elements.
  result.set(value);
  return result;
}

/** Bound allocation of a DAS numeric destination; reversed ranges have no output elements. */
export function dasReadCount(
  first: number,
  last: number,
  width: 4 | 8,
): number {
  assertSpiceInt32(first, "DAS first");
  assertSpiceInt32(last, "DAS last");
  const count = Math.max(0, last - first + 1);
  checkDasCount(count, width);
  return count;
}
