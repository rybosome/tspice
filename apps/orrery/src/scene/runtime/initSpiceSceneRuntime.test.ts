import { describe, expect, test } from 'vitest'

import { computeFocusAutoZoomTransition } from './initSpiceSceneRuntime.js'

describe('computeFocusAutoZoomTransition', () => {
  test('suppresses auto-zoom for a focus change but still advances lastFocusBody', () => {
    // Start focused on Earth.
    const a = computeFocusAutoZoomTransition({
      isE2e: false,
      lastFocusBody: 'EARTH',
      nextFocusBody: 'SUN',
      focusAutoZoomOnChange: false,
    })

    expect(a.focusChanged).toBe(true)
    expect(a.shouldAutoZoom).toBe(false)
    expect(a.nextLastFocusBody).toBe('SUN')

    // After suppression, subsequent updates for the same focus body should not
    // be treated as a fresh focus change (even if autoZoomOnChange flips back on).
    const b = computeFocusAutoZoomTransition({
      isE2e: false,
      lastFocusBody: a.nextLastFocusBody,
      nextFocusBody: 'SUN',
      focusAutoZoomOnChange: true,
    })

    expect(b.focusChanged).toBe(false)
    expect(b.shouldAutoZoom).toBe(false)
    expect(b.nextLastFocusBody).toBe('SUN')
  })

  test('auto-zooms on a new focus body by default', () => {
    const r = computeFocusAutoZoomTransition({
      isE2e: false,
      lastFocusBody: 'EARTH',
      nextFocusBody: 'MARS',
      focusAutoZoomOnChange: true,
    })

    expect(r.focusChanged).toBe(true)
    expect(r.shouldAutoZoom).toBe(true)
    expect(r.nextLastFocusBody).toBe('MARS')
  })
})
