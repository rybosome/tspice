import type { BodyRef } from '../../spice/types.js'

/**
 * Determines whether `updateScene` should run its focus-change auto-zoom logic.
 *
 * Some UI flows (e.g. scale presets) intentionally set a specific camera radius
 * while also changing `focusBody`. In those cases we want to skip the runtime's
 * body-size-based auto-zoom for exactly one focus change.
 */
export function shouldAutoZoomOnFocusChange(args: {
  isE2e: boolean
  nextFocusBody: BodyRef
  lastAutoZoomFocusBody: BodyRef | undefined
  skipAutoZoomForFocusBody: BodyRef | null
}): boolean {
  const { isE2e, nextFocusBody, lastAutoZoomFocusBody, skipAutoZoomForFocusBody } = args

  if (isE2e) return false
  if (String(nextFocusBody) === String(lastAutoZoomFocusBody)) return false
  if (skipAutoZoomForFocusBody != null && String(skipAutoZoomForFocusBody) === String(nextFocusBody)) return false
  return true
}
