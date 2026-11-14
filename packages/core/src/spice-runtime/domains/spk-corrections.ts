type Position = [number, number, number];
type State = [...Position, ...Position];

/** Validate a C string while leaving correction and frame parsing to CSPICE. */
export function validateCorrectionString(value: unknown, label: string): void {
  if (typeof value !== "string" || value.includes("\0"))
    throw new TypeError(`${label} must be a string without embedded NUL`);
}

/** Snapshot finite caller components before acquiring any backend memory. */
export function copyCorrectionInput(
  value: unknown,
  width: 3 | 6,
  label: string,
): number[] {
  if (!Array.isArray(value) || value.length !== width)
    throw new TypeError(`${label} requires ${width} components`);
  const copy: number[] = [];
  for (let i = 0; i < width; i++) {
    const word: unknown = value[i];
    if (typeof word !== "number" || !Number.isFinite(word))
      throw new TypeError(`${label}[${i}] must be finite`);
    copy.push(word);
  }
  return copy;
}

export function decodeCorrectionResult(
  value: unknown,
  width: 2,
): { ettarg: number; elapsd: number };
export function decodeCorrectionResult(value: unknown, width: 3): Position;
export function decodeCorrectionResult(
  value: unknown,
  width: 4,
): { pos: Position; lt: number };
export function decodeCorrectionResult(
  value: unknown,
  width: 7,
): { state: State; lt: number };
export function decodeCorrectionResult(
  value: unknown,
  width: 8,
): { state: State; lt: number; dlt: number };
/** Read packed native output or a WASM heap slice into the owned public result. */
export function decodeCorrectionResult(
  value: unknown,
  width: 2 | 3 | 4 | 7 | 8,
) {
  if (
    !(Array.isArray(value) || value instanceof Float64Array) ||
    value.length !== width
  )
    throw new TypeError(`Expected ${width} correction output components`);
  function word(i: number): number {
    const v: unknown = words[i];
    if (typeof v !== "number")
      throw new TypeError(`Invalid correction output component ${i}`);
    return v;
  }
  const words = value;
  if (width === 2) return { ettarg: word(0), elapsd: word(1) };
  const pos: Position = [word(0), word(1), word(2)];
  if (width === 3) return pos;
  if (width === 4) return { pos, lt: word(3) };
  const state: State = [...pos, word(3), word(4), word(5)];
  return width === 7
    ? { state, lt: word(6) }
    : { state, lt: word(6), dlt: word(7) };
}
