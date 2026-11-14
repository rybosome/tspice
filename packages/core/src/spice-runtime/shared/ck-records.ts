import type { SpiceMatrix6x6 } from "./types.js";
/** Copy the ten defined words of an N0067 CK type 2 record into public fields. */
export function ckType2Record(data: readonly number[]) {
  if (data.length !== 10) throw new TypeError("Expected ten CK type 2 words");
  const [start, stop, rate, q0, q1, q2, q3, x, y, z] = data;
  if (
    typeof start !== "number" ||
    typeof stop !== "number" ||
    typeof rate !== "number" ||
    typeof q0 !== "number" ||
    typeof q1 !== "number" ||
    typeof q2 !== "number" ||
    typeof q3 !== "number" ||
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof z !== "number"
  )
    throw new TypeError("Invalid CK type 2 record");
  const quaternion: [number, number, number, number] = [q0, q1, q2, q3],
    av: [number, number, number] = [x, y, z];
  return { start, stop, rate, quaternion, av };
}

/** Copy the five or eight defined words of an N0067 CK type 3 record. */
export function ckType3Record(data: readonly number[]) {
  if (data.length !== 5 && data.length !== 8)
    throw new TypeError("Expected five or eight CK type 3 words");
  const [sclkdp, q0, q1, q2, q3, x, y, z] = data;
  if (
    typeof sclkdp !== "number" ||
    typeof q0 !== "number" ||
    typeof q1 !== "number" ||
    typeof q2 !== "number" ||
    typeof q3 !== "number"
  )
    throw new TypeError("Invalid CK type 3 record");
  const quaternion: [number, number, number, number] = [q0, q1, q2, q3];
  let av: [number, number, number] | null = null;
  if (data.length === 8) {
    if (typeof x !== "number" || typeof y !== "number" || typeof z !== "number")
      throw new TypeError("Invalid CK type 3 angular velocity");
    av = [x, y, z];
  }
  return { sclkdp, quaternion, av };
}

function isStateMatrix(data: number[]): data is SpiceMatrix6x6 {
  return data.length === 36;
}

/** Copy each numeric CK state-transform component, preserving IEEE results of the toolkit's derivative arithmetic. */
export function ckStateResult(data: readonly number[]): SpiceMatrix6x6 {
  if (data.length !== 36)
    throw new TypeError("Expected 36 CK state matrix words");
  const copy: number[] = [];
  for (let i = 0; i < 36; i++) {
    const value = data[i];
    if (typeof value !== "number")
      throw new TypeError("Invalid CK state matrix word");
    copy.push(value);
  }
  if (!isStateMatrix(copy)) throw new Error("Incomplete CK state matrix");
  return copy;
}
