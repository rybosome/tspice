import { describe, expect, test } from 'vitest'

import { shouldAutoZoomOnFocusChange } from './focusAutoZoom.js'

describe('focusAutoZoom', () => {
  test('does not auto-zoom in e2e mode', () => {
    expect(
      shouldAutoZoomOnFocusChange({
        isE2e: true,
        nextFocusBody: 'SUN',
        lastAutoZoomFocusBody: 'EARTH',
        skipAutoZoomForFocusBody: null,
      }),
    ).toBe(false)
  })

  test('does not auto-zoom when focus body did not change', () => {
    expect(
      shouldAutoZoomOnFocusChange({
        isE2e: false,
        nextFocusBody: 'SUN',
        lastAutoZoomFocusBody: 'SUN',
        skipAutoZoomForFocusBody: null,
      }),
    ).toBe(false)
  })

  test('does not auto-zoom when a skip token matches the next focus body', () => {
    expect(
      shouldAutoZoomOnFocusChange({
        isE2e: false,
        nextFocusBody: 'SUN',
        lastAutoZoomFocusBody: 'EARTH',
        skipAutoZoomForFocusBody: 'SUN',
      }),
    ).toBe(false)
  })

  test('auto-zooms when focus body changes and no skip token is present', () => {
    expect(
      shouldAutoZoomOnFocusChange({
        isE2e: false,
        nextFocusBody: 'SUN',
        lastAutoZoomFocusBody: 'EARTH',
        skipAutoZoomForFocusBody: null,
      }),
    ).toBe(true)
  })
})
