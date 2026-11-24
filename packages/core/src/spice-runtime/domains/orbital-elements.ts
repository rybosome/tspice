type Six = [number, number, number, number, number, number];
type Eight = [...Six, number, number];
type Nine = [...Eight, number];
type OrbitalTuples = {
  6: Six;
  8: Eight;
  9: Nine;
  11: [...Nine, number, number];
};

function hasOrbitalShape<L extends keyof OrbitalTuples>(
  words: number[],
  length: L,
): words is OrbitalTuples[L] {
  return words.length === length;
}

/** Copy a fixed orbital input or result once. Result words may contain IEEE infinities or NaN. */
export function copyOrbitalTuple<L extends keyof OrbitalTuples>(
  value: unknown,
  length: L,
  label: string,
  finite: boolean,
): OrbitalTuples[L] {
  // The WASM adapter takes its result directly from the current f64 heap.
  if (
    !(Array.isArray(value) || (!finite && value instanceof Float64Array)) ||
    value.length !== length
  )
    throw new TypeError(`${label} must have exactly ${length} entries`);
  const words: number[] = [];
  for (let i = 0; i < length; i++) {
    const word: unknown = value[i];
    if (typeof word !== "number" || (finite && !Number.isFinite(word)))
      throw new TypeError(
        `${label}[${i}] must be ${finite ? "a finite number" : "numeric"}`,
      );
    words.push(word);
  }
  if (!hasOrbitalShape(words, length))
    throw new TypeError(`Invalid ${label} tuple`);
  return words;
}
