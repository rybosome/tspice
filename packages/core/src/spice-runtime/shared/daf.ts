import { assertSpiceInt32 } from "./spice-int.js";
/** Maximum bytes of a packed N0067 DAF summary, also the maximum array-name payload. */
export const DAF_MAX_SUMMARY_BYTES = 125 * 8;

/** Check a DAF filesystem path as a byte-counted, NUL-free UTF-8 C string. */
export function dafPathByteLength(
  value: string,
  maxBytes = 2147483646,
): number {
  return dafTextBytes(value, maxBytes, "DAF path");
}

function dafTextBytes(value: string, maxBytes: number, label: string): number {
  if (typeof value !== "string")
    throw new TypeError(`${label}must be a string`);
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

/** Validate ND and NI under the N0067 DAF packed-summary bounds. */
export function dafSummaryFormat(
  nd: unknown,
  ni: unknown,
): { nd: number; ni: number } {
  if (
    typeof nd !== "number" ||
    typeof ni !== "number" ||
    !Number.isInteger(nd) ||
    !Number.isInteger(ni) ||
    nd < 0 ||
    nd > 124 ||
    ni < 2 ||
    ni > 250 ||
    nd + Math.ceil(ni / 2) > 125
  ) {
    throw new RangeError("Invalid DAF summary format");
  }
  return { nd, ni };
}

/** Logical DAFPS and DAFUS widths after N0067 limits the packed summary to 125 words. */
export function dafComponentLayout(nd: number, ni: number) {
  assertSpiceInt32(nd, "nd");
  assertSpiceInt32(ni, "ni");
  const n = Math.max(0, Math.min(125, nd)),
    m = Math.max(0, Math.min(250 - 2 * n, ni));
  return { n, m, bytes: 8 * (n + Math.ceil(m / 2)) };
}

/** Copy only the prefix consumed by the toolkit, preserving its floating-point values. */
export function dafComponents(
  values: readonly number[],
  count: number,
  integer: boolean,
): number[] {
  if (!Array.isArray(values) || values.length < count)
    throw new RangeError("Insufficient DAF component storage");
  const copy: number[] = [];
  for (let i = 0; i < count; i++) {
    const v: unknown = values[i];
    if (typeof v !== "number")
      throw new TypeError("DAF component must be a number");
    if (integer) assertSpiceInt32(v, "DAF integer component");
    copy.push(v);
  }
  return copy;
}

/** Copy packed DAF bytes directly, including unaligned views and sign/NaN payload bits. */
export function dafBytes(
  value: Uint8Array,
  count: number,
  exact = false,
): Uint8Array {
  if (!(value instanceof Uint8Array))
    throw new TypeError("Expected packed Uint8Array DAF bytes");
  // Construct a plain typed array from its backing storage. A Buffer subclass or
  // overridden slice/subarray method must not return a live alias to the caller.
  const length = value.byteLength;
  if (length < count || (exact && length !== count))
    throw new RangeError("Unexpected DAF byte length");
  const copy = new Uint8Array(count);
  copy.set(new Uint8Array(value.buffer, value.byteOffset, count));
  return copy;
}
/** Return the payload byte count of an inclusive clipped slice of a 128-word record. */
export function dafRecordBytes(
  recno: number,
  begin: number,
  end: number,
  maxRecord: number,
): number {
  assertSpiceInt32(recno, "recno", { max: maxRecord });
  assertSpiceInt32(begin, "begin");
  assertSpiceInt32(end, "end");
  return 8 * Math.max(0, Math.min(end, 128) - Math.max(1, begin) + 1);
}
/** Select storage without intercepting genuine SPICE nonpositive/reversed address errors. */
export function dafAddressWords(
  begin: number,
  end: number,
  maxAddress: number,
): number {
  assertSpiceInt32(begin, "begin");
  assertSpiceInt32(end, "end");
  if (begin <= 0 || end < begin) return 0;
  const count = end - begin + 1;
  if (end > maxAddress || count > 33554432)
    throw new RangeError(
      "DAF address range exceeds the supported output or seek limit",
    );
  return count;
}
/** DAFRFR has a 60-byte header name and includes its terminator in the capacity. */
export function dafFileNameCapacity(length: number): number {
  assertSpiceInt32(length, "dafrfr(ifnlen)", { min: 1 });
  return Math.min(length, 61);
}

const MAX_COMMENT_BYTES = 256 * 1024 * 1024;

/** Snapshot comment lines once, then encode a finite fixed-row UTF-8 C string table. */
export function dafCommentTable(lines: readonly string[]) {
  if (!Array.isArray(lines))
    throw new TypeError("Expected an array of DAF comment lines");
  const n = lines.length;
  if (!Number.isSafeInteger(n) || n < 0 || n > MAX_COMMENT_BYTES / 2)
    throw new RangeError("Too many DAF comment lines");
  let width = 2;
  const copy: string[] = [];
  const maxWidth = n ? Math.floor(MAX_COMMENT_BYTES / n) : MAX_COMMENT_BYTES;
  for (let i = 0; i < n; i++) {
    const value = lines[i];
    const bytes = dafTextBytes(value, maxWidth - 1, "DAF comment line");
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
export function dafCommentPageBytes(rows: number, width: number): number {
  assertSpiceInt32(rows, "dafec(bufsiz)");
  assertSpiceInt32(width, "dafec(buffln)");
  if (rows <= 0 || width < 2) return 1;
  if (rows > Math.floor(MAX_COMMENT_BYTES / width))
    throw new RangeError("DAF comment page exceeds 256 MiB");
  return rows * width;
}

/** Decode precisely the returned rows, retaining leading and embedded spaces and empty lines. */
export function dafCommentPage(
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
    throw new TypeError("Invalid DAF comment page");
  const lines: string[] = [];
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  for (let i = 0; i < n; i++) {
    const row = bytes.subarray(i * width, (i + 1) * width),
      end = row.indexOf(0);
    if (end < 0) throw new TypeError("Unterminated DAF comment output row");
    lines.push(decoder.decode(row.subarray(0, end)));
  }
  return { n, lines, done };
}

/** Own a complete, packed DAF summary before selecting the native file. */
export function dafReplacementBytes(value: Uint8Array): Uint8Array {
  if (!(value instanceof Uint8Array))
    throw new TypeError("Expected a packed Uint8Array DAF summary");
  const length = value.byteLength;
  if (length < 8 || length > DAF_MAX_SUMMARY_BYTES || length % 8)
    throw new RangeError("Invalid packed DAF summary length");
  return dafBytes(value, length, true);
}
