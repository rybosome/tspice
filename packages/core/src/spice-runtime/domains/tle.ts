type Six = [number, number, number, number, number, number];
type TleTuples = {
  6: Six;
  8: [...Six, number, number];
  10: [...Six, number, number, number, number];
};

function hasTleExtent<N extends keyof TleTuples>(
  words: number[],
  n: N,
): words is TleTuples[N] {
  return words.length === n;
}

/** Take one snapshot of each input; copy independent numerical CSPICE results including IEEE values. */
export function copyTleTuple<N extends keyof TleTuples>(
  value: unknown,
  n: N,
  label: string,
  finite: boolean,
): TleTuples[N] {
  if (
    !(Array.isArray(value) || value instanceof Float64Array) ||
    value.length !== n
  )
    throw new TypeError(`${label} must have exactly ${n} entries`);
  const words: number[] = [];
  for (let i = 0; i < n; i++) {
    const word: unknown = value[i];
    if (typeof word !== "number" || (finite && !Number.isFinite(word)))
      throw new TypeError(
        `${label}[${i}] must be ${finite ? "finite" : "numeric"}`,
      );
    words.push(word);
  }
  if (!hasTleExtent(words, n)) throw new TypeError("Invalid tuple extent");
  return words;
}

/** Own both ASCII rows before delegating to the native caller or sizing linear memory. */
export function copyTleLines(value: unknown): [string, string] {
  if (!Array.isArray(value) || value.length !== 2)
    throw new TypeError("Expected two TLE records");
  const check = (s: unknown) => {
    if (typeof s !== "string" || s.length >= 134217728)
      throw new RangeError("TLE row must fit the 256 MiB table");
    for (let i = 0; i < s.length; i++)
      if (s.charCodeAt(i) === 0 || s.charCodeAt(i) > 127)
        throw new TypeError("TLE records must be NUL-free ASCII");
    return s;
  };
  return [check(value[0]), check(value[1])];
}
