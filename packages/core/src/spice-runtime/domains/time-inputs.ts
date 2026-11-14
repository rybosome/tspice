import { assertSpiceInt32 } from "../shared/spice-int.js";

/** Validate C string input before either runtime encodes it into bytes. */
export function checkTimeText(
  value: string,
  name: string,
  maximumBytes = 0x7ffffffe,
): void {
  if (typeof value !== "string")
    throw new TypeError(`${name} must be a string`);
  let bytes = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code === 0) throw new TypeError(`${name} contains NUL`);
    if (code >= 0xd800 && code <= 0xdfff) {
      const next = value.charCodeAt(++i);
      if (code > 0xdbff || !(next >= 0xdc00 && next <= 0xdfff))
        throw new TypeError(`${name} contains an unpaired surrogate`);
      bytes += 4;
    } else {
      bytes += code < 128 ? 1 : code < 2048 ? 2 : 3;
    }
    if (bytes > maximumBytes)
      throw new RangeError(`${name} exceeds the supported byte length`);
  }
}

/** Time epochs and angular inputs must have a finite double representation. */
export function checkTimeNumber(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
}

/** Preserve signed short lengths for CSPICE's own diagnostics, cap excess physical storage. */
export function timeOutputCapacity(value: number, maximum: number): number {
  assertSpiceInt32(value, "time output capacity");
  return Math.min(value, maximum);
}

/** Every two-digit year expansion must fit TPARSE's signed year × 367. */
export function checkTimeYearWindow(year: number): void {
  assertSpiceInt32(year, "tsetyr(year)");
  if (year > Math.floor(0x7fffffff / 367) - 99)
    throw new RangeError("tsetyr window exceeds the calendar integer range");
}
