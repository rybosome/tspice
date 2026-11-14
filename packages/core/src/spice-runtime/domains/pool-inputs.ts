import { spiceStringByteLength } from "./string-bytes.js";

/** Snapshot a text-kernel line buffer and check the complete rectangular byte allocation. */
export function poolLineTable(
  input: readonly string[],
  maxBytes: number,
): { lines: string[]; width: number } {
  if (!Array.isArray(input))
    throw new TypeError("lmpool lines must be an array");
  const count = input.length;
  if (
    !Number.isSafeInteger(count) ||
    count < 0 ||
    count > Math.floor(maxBytes / 2)
  )
    throw new RangeError("lmpool table is too large");
  const lines: string[] = [];
  let width = 2;
  const maxLine = Math.floor(maxBytes / Math.max(count, 1)) - 1;
  for (let i = 0; i < count; i++) {
    const line = input[i];
    if (typeof line !== "string")
      throw new TypeError("lmpool line must be a string");
    width = Math.max(
      width,
      1 + spiceStringByteLength(line, "lmpool line", maxLine),
    );
    lines.push(line);
  }
  return { lines, width };
}

/** Encode the single by-value SpiceChar accepted by badkpv. */
export function poolTypeChar(value: string): number {
  if (
    typeof value !== "string" ||
    value.length !== 1 ||
    value.charCodeAt(0) > 127
  )
    throw new TypeError("badkpv type must be one ASCII byte");
  return value.charCodeAt(0);
}

/** Capture and validate the byte-backed form of an ldpool input before filesystem staging. */
export function poolSourceBytes(source: { path: string; bytes: Uint8Array }): {
  path: string;
  bytes: Uint8Array;
} {
  if (!source || typeof source !== "object")
    throw new TypeError("ldpool expects a path or byte source");
  const { path, bytes } = source;
  spiceStringByteLength(path, "ldpool path");
  if (!(bytes instanceof Uint8Array))
    throw new TypeError("ldpool bytes must be a Uint8Array");
  return { path, bytes: new Uint8Array(bytes) };
}
