import { describe, expect, it } from 'vitest'

import { __testing, type ElementAnim } from './SelectionOverlay.js'

describe('SelectionOverlay track scheduling', () => {
  const makeAnim = (value = 0): ElementAnim => ({
    value,
    startValue: value,
    targetValue: value,
    startMs: 0,
    durationMs: 1,
  })

  it('treats 0ms duration with a future start as delayed until startMs', () => {
    const anim = makeAnim(0)

    // schedule()'s second argument is the track start time.
    __testing.schedule(anim, 1050, 1, 0)

    expect(__testing.getTrackPhaseKind(anim, 1000)).toBe('delayed')

    // While delayed, evalAnim should preserve the current value.
    __testing.evalAnim(anim, 1000)
    expect(anim.value).toBe(0)

    // Once startMs arrives, a 0ms duration should snap to the target.
    __testing.evalAnim(anim, 1050)
    expect(anim.value).toBe(1)
    expect(__testing.getTrackPhaseKind(anim, 1050)).toBe('inactive')
  })

  it('snaps immediately for 0ms duration with startMs <= now', () => {
    const anim = makeAnim(0.25)

    __testing.schedule(anim, 1000, 0.9, 0)
    __testing.evalAnim(anim, 1000)

    expect(anim.value).toBe(0.9)
    expect(__testing.getTrackPhaseKind(anim, 1000)).toBe('inactive')
  })
})
