import { beforeEach, describe, expect, it } from 'vitest'

import {
  DEFAULT_RESUME_RATE_DAY_SEC_PER_SEC,
  DEFAULT_RESUME_RATE_HOUR_SEC_PER_SEC,
  DEFAULT_RESUME_RATE_WEEK_SEC_PER_SEC,
} from './defaultPlaybackRate.js'
import { timeStore } from './timeStore.js'

describe('timeStore default resume rate', () => {
  beforeEach(() => {
    // Reset to a predictable state between tests.
    timeStore.pause()
  })

  it('falls back to 1d/s when no default is provided', () => {
    timeStore.togglePlay(undefined)
    expect(timeStore.getState().rateSecPerSec).toBe(DEFAULT_RESUME_RATE_DAY_SEC_PER_SEC)
  })

  it('treats <= 0 (and non-finite) as invalid and falls back to 1d/s', () => {
    timeStore.togglePlay(0)
    expect(timeStore.getState().rateSecPerSec).toBe(DEFAULT_RESUME_RATE_DAY_SEC_PER_SEC)

    timeStore.pause()
    timeStore.togglePlay(-1)
    expect(timeStore.getState().rateSecPerSec).toBe(DEFAULT_RESUME_RATE_DAY_SEC_PER_SEC)

    timeStore.pause()
    timeStore.togglePlay(Number.POSITIVE_INFINITY)
    expect(timeStore.getState().rateSecPerSec).toBe(DEFAULT_RESUME_RATE_DAY_SEC_PER_SEC)
  })

  it('clamps tiny positive values up to 1h/s', () => {
    timeStore.togglePlay(1)
    expect(timeStore.getState().rateSecPerSec).toBe(DEFAULT_RESUME_RATE_HOUR_SEC_PER_SEC)
  })

  it('clamps absurdly large values down to 1w/s', () => {
    timeStore.togglePlay(DEFAULT_RESUME_RATE_WEEK_SEC_PER_SEC * 100)
    expect(timeStore.getState().rateSecPerSec).toBe(DEFAULT_RESUME_RATE_WEEK_SEC_PER_SEC)
  })

  it('reverse uses the resolved default rate with a negative sign', () => {
    timeStore.reverse(1)
    expect(timeStore.getState().rateSecPerSec).toBe(-DEFAULT_RESUME_RATE_HOUR_SEC_PER_SEC)
  })
})
