import { describe, expect, it } from 'vitest'

import {
  computeViewerScrubRangeEt,
  VIEWER_SCRUB_UTC_HARD_MAX,
  VIEWER_SCRUB_UTC_HARD_MIN,
} from './viewerTimeBounds.js'

describe('viewerTimeBounds', () => {
  it('uses hard endpoints when validation succeeds', () => {
    const utcToEt = (utc: string) => {
      if (utc === VIEWER_SCRUB_UTC_HARD_MIN) return 0
      if (utc === VIEWER_SCRUB_UTC_HARD_MAX) return 100
      throw new Error(`unexpected utc: ${utc}`)
    }

    const range = computeViewerScrubRangeEt({
      utcToEt,
      validateEt: () => true,
    })

    expect(range.minEtSec).toBe(0)
    expect(range.maxEtSec).toBe(100)
    expect(range.clampedToKernelCoverage).toBe(false)
  })

  it('clamps max inward when endpoint is outside kernel coverage', () => {
    const utcToEt = (utc: string) => {
      if (utc === VIEWER_SCRUB_UTC_HARD_MIN) return 0
      if (utc === VIEWER_SCRUB_UTC_HARD_MAX) return 100
      throw new Error(`unexpected utc: ${utc}`)
    }

    // Valid for et <= 80, invalid afterwards.
    const validateEt = (et: number) => et <= 80

    const range = computeViewerScrubRangeEt({
      utcToEt,
      validateEt,
    })

    expect(range.minEtSec).toBe(0)
    expect(range.maxEtSec).toBeGreaterThanOrEqual(79)
    expect(range.maxEtSec).toBeLessThanOrEqual(80)
    expect(range.clampedToKernelCoverage).toBe(true)
  })

  it('clamps min inward when endpoint is outside kernel coverage', () => {
    const utcToEt = (utc: string) => {
      if (utc === VIEWER_SCRUB_UTC_HARD_MIN) return 0
      if (utc === VIEWER_SCRUB_UTC_HARD_MAX) return 100
      throw new Error(`unexpected utc: ${utc}`)
    }

    // Invalid for et < 20, valid afterwards.
    const validateEt = (et: number) => et >= 20

    const range = computeViewerScrubRangeEt({
      utcToEt,
      validateEt,
    })

    expect(range.minEtSec).toBeGreaterThanOrEqual(20)
    expect(range.minEtSec).toBeLessThanOrEqual(21)
    expect(range.maxEtSec).toBe(100)
    expect(range.clampedToKernelCoverage).toBe(true)
  })
})
