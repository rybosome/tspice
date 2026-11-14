import { assertSpiceInt32 } from "../shared/spice-int.js";

type Triple = [number, number, number];

function count(value: readonly unknown[], cap: number, label: string) {
  if (!Array.isArray(value)) throw new TypeError(`Expected ${label} array`);
  const n = value.length;
  if (!Number.isSafeInteger(n) || n < 0 || n > cap)
    throw new RangeError(`${label} exceeds its buffer bound`);
  return n;
}

/** Snapshot one finite three-component ray input. */
export function dskRay(v: readonly number[]): Float64Array {
  if (count(v, 3, "ray") !== 3)
    throw new TypeError("Expected three ray components");
  const a = new Float64Array(3);
  for (let i = 0; i < 3; i++) {
    const x = v[i];
    if (typeof x !== "number" || !Number.isFinite(x))
      throw new TypeError("Expected finite ray components");
    a[i] = x;
  }
  return a;
}

/** Marshal paired ray rows once within the 256 MiB per-buffer bound. */
export function dskRayBatch(
  vertices: readonly (readonly number[])[],
  dirs: readonly (readonly number[])[],
) {
  const n = count(vertices, 11184810, "vertices");
  if (count(dirs, 11184810, "directions") !== n)
    throw new RangeError("DSK ray counts must match");
  const v = new Float64Array(n * 3),
    d = new Float64Array(n * 3);
  for (let i = 0; i < n; i++) {
    v.set(dskRay(vertices[i]!), i * 3);
    d.set(dskRay(dirs[i]!), i * 3);
  }
  return { v, d, n };
}

/** Validate the loaded-kernel ray selector and snapshot signed surface IDs. */
export function dskRaySelection(
  pri: boolean,
  target: string,
  ids: readonly number[],
  et: number,
  fixref: string,
) {
  if (typeof pri !== "boolean" || !Number.isFinite(et))
    throw new TypeError("Expected DSK boolean priority and finite ET");
  // Bound UTF-8 before allocating encoder output. Ill-formed UTF-16 and
  // embedded NUL cannot faithfully represent a C string.
  for (const s of [target, fixref]) {
    if (typeof s !== "string" || s.length > 268435455)
      throw new TypeError("Expected bounded NUL-free DSK text");
    let bytes = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c === 0) throw new TypeError("Expected NUL-free DSK text");
      if (c < 128) bytes++;
      else if (c < 2048) bytes += 2;
      else if (c >= 0xd800 && c <= 0xdfff) {
        const low = s.charCodeAt(++i);
        if (c > 0xdbff || !(low >= 0xdc00 && low <= 0xdfff))
          throw new TypeError("Invalid UTF-16 DSK text");
        bytes += 4;
      } else bytes += 3;
      if (bytes > 268435455)
        throw new RangeError("DSK text exceeds the UTF-8 buffer bound");
    }
  }
  const n = count(ids, 67108864, "surface list"),
    out = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const x = ids[i];
    if (typeof x !== "number") throw new TypeError("Missing DSK surface ID");
    assertSpiceInt32(x, "surface ID");
    out[i] = x;
  }
  return out;
}

/** Read the three defined numeric components of an intercept. */
export function dskPoint(value: readonly number[]): Triple {
  const [x, y, z] = value;
  if (
    value.length !== 3 ||
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof z !== "number"
  )
    throw new TypeError("Invalid DSK intercept");
  return [x, y, z];
}

/** Unpack only the type-2 source fields actually defined by a found DSKXSI hit. */
export function dskRaySource(
  handle: number,
  plate: number,
  dla: readonly number[],
  words: readonly number[],
) {
  assertSpiceInt32(handle, "source handle");
  assertSpiceInt32(plate, "plate ID");
  if (dla.length !== 8 || words.length !== 27)
    throw new TypeError("Invalid DSK source descriptor length");
  const field = (i: number) => {
    const x = dla[i];
    if (typeof x !== "number") throw new TypeError("Missing DLA field");
    assertSpiceInt32(x, "DLA field");
    return x;
  };
  const w = (i: number) => {
    const x = words[i];
    if (typeof x !== "number") throw new TypeError("Invalid DSK source word");
    return x;
  };
  const code = (i: number) => {
    const x = w(i);
    assertSpiceInt32(x, "DSK descriptor code");
    return x;
  };
  const xpt: Triple = [w(0), w(1), w(2)];
  return {
    found: true as const,
    xpt,
    handle,
    dladsc: {
      bwdptr: field(0),
      fwdptr: field(1),
      ibase: field(2),
      isize: field(3),
      dbase: field(4),
      dsize: field(5),
      cbase: field(6),
      csize: field(7),
    },
    dskdsc: {
      surfce: code(3),
      center: code(4),
      dclass: code(5),
      dtype: code(6),
      frmcde: code(7),
      corsys: code(8),
      corpar: Array.from({ length: 10 }, (_, i) => w(9 + i)),
      co1min: w(19),
      co1max: w(20),
      co2min: w(21),
      co2max: w(22),
      co3min: w(23),
      co3max: w(24),
      start: w(25),
      stop: w(26),
    },
    dc: [],
    ic: [plate],
  };
}
