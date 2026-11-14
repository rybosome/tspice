import { assertSpiceInt32 } from "../shared/spice-int.js";

const maxBytes = 256 * 1024 * 1024;
const encoder = new TextEncoder();

function ekText(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.includes("\0") ||
    /[\uD800-\uDFFF]/u.test(value)
  )
    throw new TypeError("EK schema text must be a NUL-free UTF-8 string");
  // Every UTF-16 code unit requires at least one UTF-8 byte.
  if (value.length >= maxBytes)
    throw new RangeError("EK text exceeds transfer limit");
  return value;
}

function schemaRows(values: readonly unknown[], count: number) {
  const encoded: Uint8Array[] = [];
  let width = 2;
  for (let i = 0; i < count; i++) {
    const row = encoder.encode(ekText(values[i]));
    width = Math.max(width, row.length + 1);
    if (width > Math.floor(maxBytes / count))
      throw new RangeError("EK rectangular schema exceeds transfer limit");
    encoded.push(row);
  }
  const bytes = new Uint8Array(width * count);
  for (let i = 0; i < count; i++) bytes.set(encoded[i]!, i * width);
  return { width, bytes };
}

/** Snapshot each schema element once and pack two independently strided, NUL-terminated native tables. */
export function packEkRecordSchema(
  tabnam: unknown,
  cnames: unknown,
  decls: unknown,
) {
  const table = ekText(tabnam);
  if (encoder.encode(table).length >= maxBytes)
    throw new RangeError("EK table name exceeds transfer limit");
  if (!Array.isArray(cnames) || !Array.isArray(decls))
    throw new TypeError("Expected arrays of EK column names and declarations");
  const count = cnames.length;
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > 100 ||
    decls.length !== count
  )
    throw new RangeError(
      "EK schema requires 1..100 names and matching declarations",
    );
  return {
    table,
    count,
    names: schemaRows(cnames, count),
    decls: schemaRows(decls, count),
  };
}

/** Check the pinned C wrapper's signed conversion to a one-based segment or row ordinal. */
export function checkEkRecordIndex(value: number, label: string): void {
  assertSpiceInt32(value, label, { max: 2147483646 });
}

/** Validate the C ordinal conversion and snapshot the column name as UTF-8. */
export function ekEntryColumn(
  segno: number,
  recno: number,
  column: string,
): Uint8Array {
  checkEkRecordIndex(segno, "EK segment");
  checkEkRecordIndex(recno, "EK record");
  const bytes = encoder.encode(ekText(column));
  if (bytes.length >= maxBytes)
    throw new RangeError("EK column exceeds transfer limit");
  return bytes;
}

export type EkEntryKind = "character" | "double" | "integer";

/** Snapshot validated inputs before calling native code or allocating WASM buffers. */
export function packEkEntry(
  kind: EkEntryKind,
  values: readonly (number | string)[],
  isNull: boolean,
) {
  if (typeof isNull !== "boolean" || !Array.isArray(values))
    throw new TypeError("Expected an EK values array and boolean null flag");
  const count = values.length;
  const stride = kind === "integer" ? 4 : 8;
  if (
    !Number.isSafeInteger(count) ||
    count < 0 ||
    count > Math.floor(maxBytes / stride)
  )
    throw new RangeError("EK entry exceeds transfer limit");
  if (kind === "character") return { count, ...schemaRows(values, count) };
  const data =
    kind === "integer" ? new Int32Array(count) : new Float64Array(count);
  for (let i = 0; i < count; i++) {
    const v: unknown = values[i];
    if (typeof v !== "number" || !Number.isFinite(v))
      throw new TypeError("Expected finite EK numeric values");
    if (kind === "integer") assertSpiceInt32(v, "EK integer");
    data[i] = v;
  }
  return { count, width: stride, bytes: new Uint8Array(data.buffer) };
}

type EkEntryBytes = { nvals: number; isNull: boolean; bytes: Uint8Array };
const entryDecoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
export function unpackEkEntry(
  kind: "character",
  width: number,
  data: EkEntryBytes,
): { nvals: number; isNull: boolean; values: string[] };
export function unpackEkEntry(
  kind: "double" | "integer",
  width: number,
  data: EkEntryBytes,
): { nvals: number; isNull: boolean; values: number[] };
/** Keep every canonical output byte, including the Fortran blank padding preceding the NUL. */
export function unpackEkEntry(
  kind: EkEntryKind,
  width: number,
  { nvals, isNull, bytes }: EkEntryBytes,
): { nvals: number; isNull: boolean; values: (string | number)[] } {
  if (
    !Number.isSafeInteger(nvals) ||
    nvals < 1 ||
    typeof isNull !== "boolean" ||
    !(bytes instanceof Uint8Array) ||
    width < 1 ||
    nvals > maxBytes / width ||
    bytes.length !== (isNull ? 0 : nvals * width)
  )
    throw new RangeError("Inconsistent EK result storage");
  if (isNull) return { nvals, isNull, values: [] };
  if (kind === "character") {
    const values: string[] = [];
    for (let i = 0; i < nvals; i++) {
      const row = bytes.subarray(i * width, (i + 1) * width),
        end = row.indexOf(0);
      if (end < 0) throw new RangeError("Unterminated EK result string");
      values.push(entryDecoder.decode(row.subarray(0, end)));
    }
    return { nvals, isNull, values };
  }
  const owned = bytes.slice();
  const view =
    kind === "integer"
      ? new Int32Array(owned.buffer)
      : new Float64Array(owned.buffer);
  return { nvals, isNull, values: Array.from(view) };
}
