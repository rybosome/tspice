/** Check a scalar used by the window interval operations. */
export function assertWindowScalar(value: unknown, label: string): void {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new TypeError(`${label} must be a finite number`);
}

/** A side is a single by-value SpiceChar, including invalid ASCII selections diagnosed by CSPICE. */
export function windowSideByte(value: unknown): number {
  if (
    typeof value !== "string" ||
    value.length !== 1 ||
    value.charCodeAt(0) > 127
  )
    throw new TypeError("Window side must be one ASCII byte");
  return value.charCodeAt(0);
}

/** Count the bytes of a NUL-free, well-formed relation string before passing its exact contents to CSPICE. */
export function windowOperatorBytes(
  value: unknown,
  maxBytes = 2147483646,
): number {
  if (typeof value !== "string")
    throw new TypeError("Expected a window relation string");
  if (value.length > maxBytes)
    throw new RangeError("Window operator exceeds its UTF-8 byte limit");
  let bytes = 0;
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i);
    if (unit === 0)
      throw new TypeError("Window operator contains an embedded NUL");
    if (unit < 0x80) bytes++;
    else if (unit < 0x800) bytes += 2;
    else if (unit >= 0xd800 && unit <= 0xdfff) {
      const next = value.charCodeAt(i + 1);
      if (unit > 0xdbff || !(next >= 0xdc00 && next <= 0xdfff))
        throw new TypeError(
          "Window operator contains an unpaired UTF-16 surrogate",
        );
      i++;
      bytes += 4;
    } else bytes += 3;
    if (bytes > maxBytes)
      throw new RangeError("Window operator exceeds its UTF-8 byte limit");
  }
  return bytes;
}

/** Validate the flattened endpoint index in a native or WASM window summary. */
export function windowSummaryIndex(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value > 2147483646 ||
    (value !== -1 && (value < 0 || value % 2 !== 0))
  )
    throw new TypeError("Expected an even window endpoint index or -1");
  return value;
}
