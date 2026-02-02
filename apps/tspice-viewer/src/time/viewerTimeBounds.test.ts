import { describe, expect, it } from 'vitest'

import { computeViewerScrubRangeEt, VIEWER_SCRUB_UTC_HARD_MAX, VIEWER_SCRUB_UTC_HARD_MIN } from './viewerTimeBounds.js'

describe('viewerTimeBounds', () => {
  it('converts the hard UTC endpoints to ET and returns them', () => {
    const utcToEt = (utc: string) => {
      if (utc === VIEWER_SCRUB_UTC_HARD_MIN) return 0
      if (utc === VIEWER_SCRUB_UTC_HARD_MAX) return 100
      throw new Error(`unexpected utc: ${utc}`)
    }

    const range = computeViewerScrubRangeEt({ utcToEt })
    expect(range).not.toBeNull()
    expect(range?.minEtSec).toBe(0)
    expect(range?.maxEtSec).toBe(100)
  })

  it('returns null if utcToEt throws', () => {
    const utcToEt = () => {
      throw new Error('boom')
    }

    expect(computeViewerScrubRangeEt({ utcToEt })).toBeNull()
  })

  it('returns null if utcToEt produces an invalid range', () => {
    const utcToEt = (utc: string) => {
      if (utc === VIEWER_SCRUB_UTC_HARD_MIN) return 100
      if (utc === VIEWER_SCRUB_UTC_HARD_MAX) return 100
      throw new Error(`unexpected utc: ${utc}`)
    }

    expect(computeViewerScrubRangeEt({ utcToEt })).toBeNull()
  })
})
