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
