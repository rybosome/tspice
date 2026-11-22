import { assertSpiceInt32 } from "../shared/spice-int.js";

export type EkMetadataBuffers = { words: Int32Array; text: Uint8Array };
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const encoder = new TextEncoder();
export const ekMetadataLayout = {
  ekcii: [6, 33],
  ekssum: [602, 3365],
  ekpsel: [202, 6741],
} as const;

/** Encode a validated C string without silently replacing malformed UTF-16. */
export function ekMetadataText(value: string): Uint8Array {
  if (
    typeof value !== "string" ||
    value.includes("\0") ||
    /(?:[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF])/.test(
      value,
    )
  )
    throw new TypeError("Expected NUL-free well-formed EK text");
  const bytes = encoder.encode(value);
  if (bytes.length >= 256 * 1024 * 1024)
    throw new RangeError("EK text exceeds transfer limit");
  return bytes;
}
/** Check that adding one to an EK ordinal fits the linked Fortran integer. */
export function ekMetadataOrdinal(value: number) {
  assertSpiceInt32(value, "EK zero-based index");
  if (value === 2147483647)
    throw new RangeError("EK index is too large for one-based conversion");
  return value;
}
function buffers(data: EkMetadataBuffers, kind: keyof typeof ekMetadataLayout) {
  const [nw, nt] = ekMetadataLayout[kind];
  if (
    !(data.words instanceof Int32Array) ||
    data.words.length !== nw ||
    !(data.text instanceof Uint8Array) ||
    data.text.length !== nt
  )
    throw new RangeError("Inconsistent EK metadata storage");
  return data;
}
function stringAt(bytes: Uint8Array, offset: number, width: number) {
  const row = bytes.subarray(offset, offset + width),
    end = row.indexOf(0);
  if (end < 0) throw new RangeError("Unterminated EK result string");
  return decoder.decode(row.subarray(0, end));
}
function attribute(w: Int32Array, i: number) {
  return {
    cclass: w[i]!,
    dtype: w[i + 1]!,
    strlen: w[i + 2]!,
    size: w[i + 3]!,
    indexd: w[i + 4] !== 0,
    nullok: w[i + 5] !== 0,
  };
}
/** Read one NUL-terminated name and its six native descriptor fields. */
export function decodeEkColumn(data: EkMetadataBuffers) {
  const { words, text } = buffers(data, "ekcii");
  return { column: stringAt(text, 0, 33), attdsc: attribute(words, 0) };
}
/** Decode the complete physical summary using N0067’s 33-byte column-name stride. */
export function decodeEkSummary(data: EkMetadataBuffers) {
  const { words, text } = buffers(data, "ekssum");
  const nrows = words[0]!,
    ncols = words[1]!;
  if (nrows < 0 || ncols < 0 || ncols > 100)
    throw new RangeError("Invalid EK segment dimensions");
  return {
    tabnam: stringAt(text, 0, 65),
    nrows,
    ncols,
    cnames: Array.from({ length: ncols }, (_, i) =>
      stringAt(text, 65 + i * 33, 33),
    ),
    cdescrs: Array.from({ length: ncols }, (_, i) =>
      attribute(words, 2 + 6 * i),
    ),
  };
}
/** Copy the parser diagnostic or all six projection arrays from fixed native buffers. */
export function decodeEkSelect(data: EkMetadataBuffers) {
  const { words, text } = buffers(data, "ekpsel");
  if (words[0]) return { ok: false as const, errmsg: stringAt(text, 0, 1841) };
  const n = words[1]!;
  if (n < 0 || n > 50) throw new RangeError("Invalid EK SELECT item count");
  const field = (i: number) =>
    Array.from(words.subarray(2 + 50 * i, 2 + 50 * i + n));
  return {
    ok: true as const,
    n,
    xbegs: field(0),
    xends: field(1),
    xtypes: field(2),
    xclass: field(3),
    tabs: Array.from({ length: n }, (_, i) =>
      stringAt(text, 1841 + i * 65, 65),
    ),
    cols: Array.from({ length: n }, (_, i) =>
      stringAt(text, 5091 + i * 33, 33),
    ),
  };
}
