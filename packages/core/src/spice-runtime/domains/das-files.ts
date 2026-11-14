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
