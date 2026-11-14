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
