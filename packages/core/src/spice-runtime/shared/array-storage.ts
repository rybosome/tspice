import { assertSpiceInt32, SPICE_INT32_MAX } from "./spice-int.js";

type StorageKind = "byte" | "int" | "double";

/** Capture the length once and check element and transport limits before copying storage. */
export function spiceStorageLength(
  value: unknown,
  label: string,
  maximum = SPICE_INT32_MAX,
): number {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  const length = value.length;
  assertSpiceInt32(length, `${label}.length`, { min: 0, max: maximum });
  return length;
}

/** Snapshot exactly the checked number of entries, validating each entry as it is read. */
export function copySpiceStorage(
  value: readonly unknown[],
  length: number,
  kind: StorageKind,
  label: string,
): number[] {
  const result: number[] = [];
  for (let i = 0; i < length; i++) {
    const entry = value[i];
    if (typeof entry !== "number")
      throw new TypeError(`${label}[${i}] must be a number`);
    if (
      kind === "byte" &&
      (!Number.isInteger(entry) || entry < 0 || entry > 255)
    ) {
      throw new RangeError(`${label}[${i}] must be a byte`);
    }
    if (kind === "int") assertSpiceInt32(entry, `${label}[${i}]`);
    result.push(entry);
  }
  return result;
}

/** Check a count against the physical destination, allowing clear/fill no-write counts. */
export function assertSpiceStorageFits(
  ndim: number,
  length: number,
  label: string,
  width = 1,
): void {
  if (ndim > 0 && width > 0 && ndim > Math.floor(length / width)) {
    throw new RangeError(`${label} count does not fit the supplied storage`);
  }
}
