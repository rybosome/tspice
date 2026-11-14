import { assertSpiceInt32 } from "./spice-int.js";
/** Maximum bytes of a packed N0067 DAF summary, also the maximum array-name payload. */
export const DAF_MAX_SUMMARY_BYTES = 125 * 8;

/** Check a DAF filesystem path as a byte-counted, NUL-free UTF-8 C string. */
export function dafPathByteLength(
  value: string,
  maxBytes = 2147483646,
): number {
  if (typeof value !== "string")
    throw new TypeError("DAF path must be a string");
  if (value.length > maxBytes)
    throw new RangeError("DAF path exceeds its byte limit");
  let bytes = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code === 0) throw new TypeError("DAF path may not contain NUL");
    if (code < 128) bytes++;
    else if (code < 2048) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdfff) {
      const next = value.charCodeAt(i + 1);
      if (code >= 0xdc00 || !(next >= 0xdc00 && next <= 0xdfff))
        throw new TypeError("Invalid UTF-16 DAF path");
      bytes += 4;
      i++;
    } else bytes += 3;
    if (bytes > maxBytes)
      throw new RangeError("DAF path exceeds its byte limit");
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
