/**
 * Zoom-dependent default playback rate.
 *
 * The zoom UI is a log-scale curve mapped onto a slider in [0..100].
 * The first third of that curve should default to 1 hour/s,
 * the next third to 1 day/s, and the final third to 1 week/s.
 */

export const DEFAULT_RESUME_RATE_HOUR_SEC_PER_SEC = 60 * 60
export const DEFAULT_RESUME_RATE_DAY_SEC_PER_SEC = 24 * 60 * 60
export const DEFAULT_RESUME_RATE_WEEK_SEC_PER_SEC = 7 * DEFAULT_RESUME_RATE_DAY_SEC_PER_SEC

const ZOOM_SLIDER_ONE_THIRD = 100 / 3
const ZOOM_SLIDER_TWO_THIRDS = (100 * 2) / 3

/**
 * Compute the default resume/playback rate for a given zoom slider position.
 *
 * Note: `zoomSlider` is treated as the zoom curve value in [0..100].
 */
export function computeDefaultResumeRateSecPerSecForZoomSlider(zoomSlider: number): number {
  const z = Math.max(0, Math.min(100, zoomSlider))

  // Inclusivity:
  //   [0 .. 100/3)       => 1 hour/s
  //   [100/3 .. 2*100/3) => 1 day/s
  //   [2*100/3 .. 100]   => 1 week/s
  if (z < ZOOM_SLIDER_ONE_THIRD) return DEFAULT_RESUME_RATE_HOUR_SEC_PER_SEC
  if (z < ZOOM_SLIDER_TWO_THIRDS) return DEFAULT_RESUME_RATE_DAY_SEC_PER_SEC
  return DEFAULT_RESUME_RATE_WEEK_SEC_PER_SEC
}
