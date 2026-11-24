import { assertSpiceInt32 } from "../shared/spice-int.js";

type Words = readonly number[] | Float64Array;

function boundedLength(data: Words, label: string): number {
  if (!Array.isArray(data) && !(data instanceof Float64Array))
    throw new TypeError("Expected a flat SPK " + label + " array");
  const length = data.length;
  if (!Number.isSafeInteger(length) || length < 0 || length > 33554432)
    throw new RangeError("SPK " + label + " exceeds 256 MiB");
  return length;
}
function copy(data: Words, length: number): Float64Array {
  const result = new Float64Array(length);
  for (let i = 0; i < length; i++) {
    const word = data[i];
    if (typeof word !== "number" || !Number.isFinite(word))
      throw new RangeError("SPK samples and epochs must be finite");
    result[i] = word;
  }
  return result;
}

/** Capture both physical lengths before accessing either caller buffer, then copy complete records. */
export function snapshotSpkInterpolation(
  type: 9 | 12 | 13 | 18,
  subtype: number,
  degree: number,
  samples: Words,
  epochs?: Words,
) {
  assertSpiceInt32(subtype, "subtype");
  assertSpiceInt32(degree, "degree");
  if (type !== 12 && epochs === undefined)
    throw new TypeError("Expected an SPK epoch array");
  const words = boundedLength(samples, "samples"),
    epochCount = epochs === undefined ? 0 : boundedLength(epochs, "epochs");
  if (type === 18 && subtype !== 0 && subtype !== 1) {
    // SPKW18 rejects an unknown subtype before inspecting interpolation data.
    return { n: 0, samples: new Float64Array(0), epochs: new Float64Array(0) };
  }
  if (type !== 9 && degree === 2147483647)
    throw new RangeError("Degree exceeds defined N0067 window arithmetic");
  const width = type === 18 && subtype === 0 ? 12 : 6,
    n = words / width;
  if (!Number.isInteger(n) || (type !== 12 && n !== epochCount))
    throw new RangeError("Incomplete SPK state, packet or epoch array");
  return {
    n,
    samples: copy(samples, words),
    epochs:
      epochs === undefined ? new Float64Array(0) : copy(epochs, epochCount),
  };
}
