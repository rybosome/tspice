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
