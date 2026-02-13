/**
 * Hard UTC bounds enforced by the viewer.
 *
 * Notes:
 * - These are interpreted via SPICE `str2et` (via `spice.kit.utcToEt`).
 * - We expect our demo kernel pack to support this range.
 */
export const VIEWER_SCRUB_UTC_HARD_MIN = '1950-01-01T00:00:00Z'

// de432s.bsp coverage ends around 2050-01-02 (per kernel comments), so we use
// that as the viewer's maximum allowed UTC.
export const VIEWER_SCRUB_UTC_HARD_MAX = '2050-01-02T00:00:00Z'

type UtcToEtSpice = {
  kit: {
    utcToEt: (utc: string) => Promise<number>
  }
}

export type ViewerScrubRange = {
  minEtSec: number
  maxEtSec: number

  /** UTC endpoints used for conversion (for logging/debugging). */
  hardMinUtc: string
  hardMaxUtc: string

  hardMinEtSec: number
  hardMaxEtSec: number
}

/**
 * Compute scrub min/max ET seconds.
 *
 * Call this only after loading the required kernels (at least the LSK), so
 * `spice.kit.utcToEt` can do a correct `str2et` conversion.
 *
 * This intentionally does *not* attempt to discover kernel coverage. We run a
 * known demo kernel pack and just want a stable viewer scrub window.
 */
export async function computeViewerScrubRangeEt(input: { spice: UtcToEtSpice }): Promise<ViewerScrubRange | null> {
  const hardMinUtc = VIEWER_SCRUB_UTC_HARD_MIN
  const hardMaxUtc = VIEWER_SCRUB_UTC_HARD_MAX

  try {
    const hardMinEtSec = await input.spice.kit.utcToEt(hardMinUtc)
    const hardMaxEtSec = await input.spice.kit.utcToEt(hardMaxUtc)

    if (!Number.isFinite(hardMinEtSec) || !Number.isFinite(hardMaxEtSec)) return null
    if (!(hardMinEtSec < hardMaxEtSec)) return null

    return {
      minEtSec: hardMinEtSec,
      maxEtSec: hardMaxEtSec,
      hardMinUtc,
      hardMaxUtc,
      hardMinEtSec,
      hardMaxEtSec,
    }
  } catch {
    return null
  }
}
