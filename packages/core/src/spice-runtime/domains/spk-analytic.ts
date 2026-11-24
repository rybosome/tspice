type Words = readonly number[] | Float64Array;

type RecordPart = { values: Words; length: number };

function part(values: Words, label: string, expected?: number): RecordPart {
  if (!Array.isArray(values) && !(values instanceof Float64Array))
    throw new TypeError("Expected a flat " + label + " array");
  const length = values.length;
  if (
    !Number.isSafeInteger(length) ||
    length < 0 ||
    length > 33554432 ||
    (expected !== undefined && length !== expected)
  )
    throw new RangeError("Invalid " + label + " length");
  return { values, length };
}

/** Snapshot complete fields, including views with nonzero offsets, before entering CSPICE. */
function pack(parts: RecordPart[]): Float64Array {
  const length = parts.reduce((sum, p) => sum + p.length, 0);
  if (length > 33554432)
    throw new RangeError("Analytic SPK data exceeds 256 MiB");
  const result = new Float64Array(length);
  let offset = 0;
  for (const { values, length } of parts)
    for (let j = 0; j < length; j++) {
      const value = values[j];
      if (typeof value !== "number" || !Number.isFinite(value))
        throw new RangeError("Expected finite analytic SPK words");
      result[offset++] = value;
    }
  return result;
}
function scalars(...values: number[]): RecordPart {
  return { values, length: values.length };
}

/** Pack complete Cartesian states followed by their TDB epochs. */
export function packSpk05(gm: number, states: Words, epochs: Words) {
  const times = part(epochs, "epochs"),
    rows = part(states, "states", times.length * 6);
  return { n: times.length, data: pack([scalars(gm), rows, times]) };
}

/** Snapshot the eight geophysical constants and complete ten-word TLE rows. */
export function packSpk10(consts: Words, elems: Words, epochs: Words) {
  const times = part(epochs, "epochs"),
    constants = part(consts, "geophysical constants", 8),
    rows = part(elems, "TLE elements", 10 * times.length);
  const data = pack([constants, rows, times]);
  // SGWFPK detects this after SGBWFS starts a persistent generic segment.
  // Check first so the same open writer can be used following invalid input.
  for (let j = 8 + rows.length + 1; j < data.length; j++)
    if (data[j - 1]! >= data[j]!)
      throw new RangeError(
        "Type 10 epochs must increase before opening a generic segment",
      );
  return { n: times.length, data };
}

/** The three directions need not be normalized; CSPICE selects their unit directions. */
export function packSpk15(
  epoch: number,
  tp: Words,
  pa: Words,
  p: number,
  ecc: number,
  j2flg: number,
  pv: Words,
  gm: number,
  j2: number,
  radius: number,
) {
  if (Math.trunc(j2flg) < -2147483648 || Math.trunc(j2flg) > 2147483647)
    throw new RangeError("Type 15 J2 flag exceeds signed evaluation range");
  return {
    n: 1,
    data: pack([
      scalars(epoch),
      part(tp, "trajectory pole", 3),
      part(pa, "periapsis direction", 3),
      scalars(p, ecc, j2flg),
      part(pv, "central pole", 3),
      scalars(gm, j2, radius),
    ]),
  };
}

/** Pack equinoctial elements, reference epoch and central pole coordinates in radians. */
export function packSpk17(
  epoch: number,
  eqel: Words,
  rapol: number,
  decpol: number,
) {
  return {
    n: 1,
    data: pack([
      scalars(epoch),
      part(eqel, "equinoctial elements", 9),
      scalars(rapol, decpol),
    ]),
  };
}
