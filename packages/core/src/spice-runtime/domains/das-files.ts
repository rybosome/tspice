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

function dasCommentTextBytes(
  value: string,
  maxBytes: number,
  label: string,
): number {
  if (typeof value !== "string")
    throw new TypeError(`${label} must be a string`);
  if (value.length > maxBytes)
    throw new RangeError(`${label} exceeds its byte limit`);
  let bytes = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code === 0) throw new TypeError(`${label} may not contain NUL`);
    if (code < 128) bytes++;
    else if (code < 2048) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdfff) {
      const next = value.charCodeAt(i + 1);
      if (code >= 0xdc00 || !(next >= 0xdc00 && next <= 0xdfff))
        throw new TypeError(`Invalid UTF-16 ${label}`);
      bytes += 4;
      i++;
    } else bytes += 3;
    if (bytes > maxBytes)
      throw new RangeError(`${label} exceeds its byte limit`);
  }
  return bytes;
}

const MAX_COMMENT_BYTES = 256 * 1024 * 1024;

/** Snapshot comment lines once, then encode a finite fixed-row UTF-8 C string table. */
export function dasCommentTable(lines: readonly string[]) {
  if (!Array.isArray(lines))
    throw new TypeError("Expected an array of DAS comment lines");
  const n = lines.length;
  if (!Number.isSafeInteger(n) || n < 0 || n > MAX_COMMENT_BYTES / 2)
    throw new RangeError("Too many DAS comment lines");
  let width = 2;
  const copy: string[] = [];
  const maxWidth = n ? Math.floor(MAX_COMMENT_BYTES / n) : MAX_COMMENT_BYTES;
  for (let i = 0; i < n; i++) {
    const value = lines[i];
    const bytes = dasCommentTextBytes(value, maxWidth - 1, "DAS comment line");
    width = Math.max(width, bytes + 1);
    // An empty C row and a single Fortran space have the same last
    // nonblank index. Keep all-blank input away from a zero-byte malloc.
    copy.push(value === "" ? " " : value);
  }
  const table = new Uint8Array(Math.max(1, n * width));
  const encoder = new TextEncoder();
  for (let i = 0; i < n; i++)
    encoder.encodeInto(
      copy[i]!,
      table.subarray(i * width, (i + 1) * width - 1),
    );
  return { n, width, table };
}

/** Reserve actual page bytes, retaining canonical nonpositive count and small-width diagnostics. */
export function dasCommentPageBytes(rows: number, width: number): number {
  assertSpiceInt32(rows, "dasec(bufsiz)");
  assertSpiceInt32(width, "dasec(buffln)");
  if (rows <= 0 || width < 2) return 1;
  if (rows > Math.floor(MAX_COMMENT_BYTES / width))
    throw new RangeError("DAS comment page exceeds 256 MiB");
  return rows * width;
}

/** Decode precisely the returned rows, retaining leading and embedded spaces and empty lines. */
export function dasCommentPage(
  n: number,
  done: boolean,
  bytes: Uint8Array,
  rows: number,
  width: number,
) {
  if (
    !Number.isInteger(n) ||
    n < 0 ||
    n > rows ||
    typeof done !== "boolean" ||
    !(bytes instanceof Uint8Array) ||
    bytes.byteLength !== n * width
  )
    throw new TypeError("Invalid DAS comment page");
  const lines: string[] = [];
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  for (let i = 0; i < n; i++) {
    const row = bytes.subarray(i * width, (i + 1) * width),
      end = row.indexOf(0);
    if (end < 0) throw new TypeError("Unterminated DAS comment output row");
    lines.push(decoder.decode(row.subarray(0, end)));
  }
  return { n, lines, done };
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

/** Snapshot all eight signed descriptor words. A segment under construction has size −1. */
export function copyDlaDescriptor(value: unknown, context: string) {
  if (typeof value !== "object" || value === null)
    throw new TypeError(context + ": expected a DLA descriptor object");
  const obj = value;
  function word(key: string, min: number): number {
    const v: unknown = Reflect.get(obj, key);
    if (
      typeof v !== "number" ||
      !Number.isInteger(v) ||
      v < -2147483648 ||
      v > 2147483647
    )
      throw new TypeError(
        context + ": expected " + key + " to be a 32-bit signed integer",
      );
    if (v < min)
      throw new RangeError(context + ": expected " + key + " to be >= " + min);
    return v;
  }
  return {
    bwdptr: word("bwdptr", -1),
    fwdptr: word("fwdptr", -1),
    ibase: word("ibase", 0),
    isize: word("isize", -1),
    dbase: word("dbase", 0),
    dsize: word("dsize", -1),
    cbase: word("cbase", 0),
    csize: word("csize", -1),
  };
}
