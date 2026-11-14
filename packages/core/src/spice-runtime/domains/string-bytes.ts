import { assertSpiceInt32 } from "../shared/spice-int.js";

/** Check a CSPICE text argument and count its UTF-8 bytes before allocating a buffer. */
export function spiceStringByteLength(
  value: unknown,
  label: string,
  maxBytes = 2147483646,
): number {
  if (typeof value !== "string")
    throw new TypeError(`${label} must be a string`);
  if (value.length > maxBytes)
    throw new RangeError(`${label} exceeds its UTF-8 byte limit`);
  let bytes = 0;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c === 0) throw new TypeError(`${label} contains an embedded NUL`);
    if (c < 0x80) bytes++;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdfff) {
      const next = value.charCodeAt(i + 1);
      if (c > 0xdbff || !(next >= 0xdc00 && next <= 0xdfff))
        throw new TypeError(`${label} contains an unpaired UTF-16 surrogate`);
      i++;
      bytes += 4;
    } else bytes += 3;
    if (bytes > maxBytes)
      throw new RangeError(`${label} exceeds its UTF-8 byte limit`);
  }
  return bytes;
}

/** Convert a single SpiceChar argument, including the NUL scalar, to its ASCII byte value. */
export function spiceAsciiChar(value: unknown, label: string): number {
  if (
    typeof value !== "string" ||
    value.length !== 1 ||
    value.charCodeAt(0) > 127
  )
    throw new TypeError(`${label} must be one ASCII byte`);
  return value.charCodeAt(0);
}

/** Size a nonexpanding string result and preserve too-small capacities for CSPICE diagnostics. */
export function spiceStringOutputCapacity(
  inputBytes: number,
  minimum: number,
  lenout?: number,
): number {
  const full = Math.max(minimum, inputBytes + 1);
  if (lenout === undefined) return full;
  assertSpiceInt32(lenout, "lenout");
  return Math.min(full, lenout);
}

/** Validate explicit signed dimensions and cap the parser's rectangular output before allocation. */
export function spiceTokenTable(
  inputBytes: number,
  nmax: number,
  itemln?: number,
) {
  assertSpiceInt32(nmax, "nmax");
  const count = Math.min(nmax, inputBytes + 1);
  const width = spiceStringOutputCapacity(inputBytes, 2, itemln);
  const bytes = count > 0 && width >= 2 ? count * width : 1;
  if (bytes > 256 * 1024 * 1024)
    throw new RangeError("Token table exceeds 256 MiB");
  return { count, width, bytes };
}
