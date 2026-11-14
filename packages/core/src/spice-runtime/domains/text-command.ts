import { assertSpiceInt32 } from "../shared/spice-int.js";
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const limit = 256 * 1024 * 1024;
/** Symbol on the owned reader capability. Worker transport enumerates only string-named raw functions. */
export const releaseTextReaders = Symbol("release owned text readers");
/** Encode a well-formed C string without substituting bytes for a malformed surrogate. */
export function textBytes(text: string): Uint8Array {
  if (
    typeof text !== "string" ||
    text.includes("\0") ||
    /(?:[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF])/.test(
      text,
    )
  )
    throw new TypeError("Expected NUL-free well-formed text");
  return encoder.encode(text);
}
/** Require the signed C capacity and a bounded physical buffer. */
export function textWidth(width: number): number {
  assertSpiceInt32(width, "Text output width");
  if (width > limit) throw new RangeError("Text output exceeds transfer limit");
  return Math.max(width, 1);
}
/** Decode only the bytes actually returned by the linked toolkit. */
export function readTextResult(bytes: Uint8Array, eof: boolean) {
  if (!(bytes instanceof Uint8Array) || typeof eof !== "boolean")
    throw new TypeError("Invalid native text result");
  return { line: decoder.decode(bytes), eof };
}
/** Capture every argv element once and pack exact NUL-terminated UTF-8 strings. */
export function packCommandArgs(argv: readonly string[]): {
  count: number;
  bytes: Uint8Array;
} {
  if (!Array.isArray(argv)) throw new TypeError("Expected an argument array");
  const count = argv.length;
  if (!Number.isSafeInteger(count) || count < 0 || count > limit / 8)
    throw new RangeError("Argument pointer table exceeds transfer limit");
  let size = 0;
  const strings: Uint8Array[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = textBytes(argv[i]!);
    size += bytes.length + 1;
    if (size > limit)
      throw new RangeError("Command data exceeds transfer limit");
    strings.push(bytes);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const s of strings) {
    bytes.set(s, offset);
    offset += s.length + 1;
  }
  return { count, bytes };
}
/** Confirm the immediate privately observed canonical readback byte for byte. */
export function verifyCommandArgs(
  input: Uint8Array,
  observed: Uint8Array,
): void {
  if (
    !(observed instanceof Uint8Array) ||
    input.length !== observed.length ||
    !input.every((b, i) => b === observed[i])
  )
    throw new Error(
      "Stored command arguments differ from the initialized input",
    );
}
