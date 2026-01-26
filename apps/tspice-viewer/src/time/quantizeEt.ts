/**
 * Quantize an ET value (seconds past J2000) to the nearest quantum.
 *
 * This is used for:
 * - Deterministic fixed-step simulation (avoids floating-point accumulation drift)
 * - Cache key normalization (ensures nearby ET values share the same cache entry)
 *
 * @param etSec - Ephemeris time in seconds past J2000
 * @param quantumSec - The time quantum in seconds (e.g., 0.1 for 100ms steps)
 * @returns Quantized ET value, rounded to the nearest quantum
 */
export function quantizeEt(etSec: number, quantumSec: number): number {
  if (quantumSec <= 0) {
    return etSec;
  }
  return Math.round(etSec / quantumSec) * quantumSec;
}
