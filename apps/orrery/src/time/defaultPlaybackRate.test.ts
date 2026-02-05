import { describe, expect, it } from 'vitest'

import {
  computeDefaultResumeRateSecPerSecForZoomSlider,
  DEFAULT_RESUME_RATE_DAY_SEC_PER_SEC,
  DEFAULT_RESUME_RATE_HOUR_SEC_PER_SEC,
  DEFAULT_RESUME_RATE_WEEK_SEC_PER_SEC,
} from './defaultPlaybackRate.js'

describe('defaultPlaybackRate', () => {
  it('returns 1h/s for the first third of the zoom curve', () => {
    expect(computeDefaultResumeRateSecPerSecForZoomSlider(0)).toBe(DEFAULT_RESUME_RATE_HOUR_SEC_PER_SEC)
    expect(computeDefaultResumeRateSecPerSecForZoomSlider(33)).toBe(DEFAULT_RESUME_RATE_HOUR_SEC_PER_SEC)
  })

  it('returns 1d/s for the middle third of the zoom curve', () => {
    expect(computeDefaultResumeRateSecPerSecForZoomSlider(33.5)).toBe(DEFAULT_RESUME_RATE_DAY_SEC_PER_SEC)
    expect(computeDefaultResumeRateSecPerSecForZoomSlider(66.5)).toBe(DEFAULT_RESUME_RATE_DAY_SEC_PER_SEC)
  })

  it('returns 1w/s for the final third of the zoom curve', () => {
    expect(computeDefaultResumeRateSecPerSecForZoomSlider(67)).toBe(DEFAULT_RESUME_RATE_WEEK_SEC_PER_SEC)
    expect(computeDefaultResumeRateSecPerSecForZoomSlider(100)).toBe(DEFAULT_RESUME_RATE_WEEK_SEC_PER_SEC)
  })

  it('clamps zoom outside [0..100]', () => {
    expect(computeDefaultResumeRateSecPerSecForZoomSlider(-100)).toBe(DEFAULT_RESUME_RATE_HOUR_SEC_PER_SEC)
    expect(computeDefaultResumeRateSecPerSecForZoomSlider(1000)).toBe(DEFAULT_RESUME_RATE_WEEK_SEC_PER_SEC)
  })
})
