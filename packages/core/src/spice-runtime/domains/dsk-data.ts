import { assertSpiceInt32 } from "../shared/spice-int.js";

type Descriptor = {
  bwdptr: number;
  fwdptr: number;
  ibase: number;
  isize: number;
  dbase: number;
  dsize: number;
  cbase: number;
  csize: number;
};

/** Read each field once before sizing or looking up a segment on either backend. */
export function snapshotDskDataDescriptor(value: Descriptor): Descriptor {
  if (!value || typeof value !== "object")
    throw new TypeError("Expected DLA descriptor");
  function read(key: keyof Descriptor): number {
    const n = value[key];
    assertSpiceInt32(n, key, {
      min: key === "bwdptr" || key === "fwdptr" ? -1 : 0,
    });
    return n;
  }
  return {
    bwdptr: read("bwdptr"),
    fwdptr: read("fwdptr"),
    ibase: read("ibase"),
    isize: read("isize"),
    dbase: read("dbase"),
    dsize: read("dsize"),
    cbase: read("cbase"),
    csize: read("csize"),
  };
}

/** Retain at least one writable element on canonical error paths. */
export function dskPageStorage(
  componentSize: number,
  room: number,
  stride: 1 | 3,
  width: 4 | 8,
  maxBytes: number,
): number {
  const words = Math.max(
    1,
    Math.min(
      Math.max(1, room),
      Math.max(1, Math.floor(componentSize / stride)),
    ) * stride,
  );
  if (words > Math.floor(maxBytes / width))
    throw new RangeError("DSK page exceeds backend byte limit");
  return words;
}

/** Copy a packed plate or vertex page into owned triples in file order. */
export function dskDataRows(
  flat: readonly number[],
): [number, number, number][] {
  if (flat.length % 3 !== 0) throw new RangeError("Incomplete DSK triple");
  const rows: [number, number, number][] = [];
  for (let i = 0; i < flat.length; i += 3)
    rows.push([flat[i]!, flat[i + 1]!, flat[i + 2]!]);
  return rows;
}
