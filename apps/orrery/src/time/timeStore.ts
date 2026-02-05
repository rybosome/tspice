import { useSyncExternalStore } from 'react'
import { quantizeEt } from './quantizeEt.js'

/**
 * Default scrub window: 10 years from J2000 epoch (0 to ~10 years in seconds).
 * ET = 0 corresponds to 2000-01-01T12:00:00 TDB.
 */
const SECONDS_PER_YEAR = 365.25 * 24 * 60 * 60
export const DEFAULT_SCRUB_MIN_ET_SEC = 0
export const DEFAULT_SCRUB_MAX_ET_SEC = 10 * SECONDS_PER_YEAR // ~315,576,000 seconds

/** Default quantum for ET quantization (0.1 seconds = 100ms). */
export const DEFAULT_QUANTUM_SEC = 0.1

/** Default step size for step forward/back (60 seconds). */
export const DEFAULT_STEP_SEC = 60

/**
 * Rate ladder (simulation seconds per wall-clock second).
 * Includes both forward and reverse rates for easy cycling.
 * Values are sorted from slowest reverse to fastest forward.
 */
export const RATE_LADDER = [
  -86400 * 365, // -1 year/s (reverse)
  -86400 * 30, // -1 month/s (reverse)
  -86400 * 7, // -1 week/s (reverse)
  -86400, // -1 day/s (reverse)
  -3600, // -1 hour/s (reverse)
  -60, // -1 minute/s (reverse)
  -1, // -1x (reverse real-time)
  0, // Paused
  1, // 1x (real-time)
  60, // 1 minute/s
  3600, // 1 hour/s
  86400, // 1 day/s
  86400 * 7, // 1 week/s
  86400 * 30, // 1 month/s
  86400 * 365, // 1 year/s
] as const

export interface TimeState {
  /** Current ephemeris time in seconds past J2000 (quantized). */
  etSec: number
  /** Simulation rate: sim-seconds per wall-clock-second. Negative = reverse playback. */
  rateSecPerSec: number
  /** Time quantum for quantization (seconds). */
  quantumSec: number
  /** Step size for step forward/back (seconds). */
  stepSec: number
  /** Minimum ET for scrub slider. */
  scrubMinEtSec: number
  /** Maximum ET for scrub slider. */
  scrubMaxEtSec: number
}

type Listener = () => void

function createTimeStore() {
  let state: TimeState = {
    etSec: 0,
    rateSecPerSec: 0, // Paused by default
    quantumSec: DEFAULT_QUANTUM_SEC,
    stepSec: DEFAULT_STEP_SEC,
    scrubMinEtSec: DEFAULT_SCRUB_MIN_ET_SEC,
    scrubMaxEtSec: DEFAULT_SCRUB_MAX_ET_SEC,
  }

  const listeners = new Set<Listener>()

  const notify = () => {
    for (const listener of listeners) {
      listener()
    }
  }

  const setState = (next: Partial<TimeState>) => {
    state = { ...state, ...next }
    notify()
  }

  const getState = (): TimeState => state
  const getSnapshot = () => state
  const getServerSnapshot = () => state

  const subscribe = (listener: Listener): (() => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  // Actions
  const setEtSec = (etSec: number) => {
    const clamped = Math.max(state.scrubMinEtSec, Math.min(state.scrubMaxEtSec, etSec))
    const quantized = quantizeEt(clamped, state.quantumSec)
    if (quantized !== state.etSec) {
      setState({ etSec: quantized })
    }
  }

  const setRate = (rate: number) => {
    if (rate !== state.rateSecPerSec) {
      setState({ rateSecPerSec: rate })
    }
  }

  const setQuantumSec = (quantumSec: number) => {
    if (quantumSec > 0 && quantumSec !== state.quantumSec) {
      const quantized = quantizeEt(state.etSec, quantumSec)
      setState({ quantumSec, etSec: quantized })
    }
  }

  const setStepSec = (stepSec: number) => {
    if (stepSec > 0 && stepSec !== state.stepSec) {
      setState({ stepSec })
    }
  }

  const setScrubRange = (min: number, max: number) => {
    if (min < max) {
      const clampedEt = Math.max(min, Math.min(max, state.etSec))
      setState({
        scrubMinEtSec: min,
        scrubMaxEtSec: max,
        etSec: quantizeEt(clampedEt, state.quantumSec),
      })
    }
  }

  const DEFAULT_RESUME_RATE_SEC_PER_SEC = 86400

  const resolveDefaultResumeRateSecPerSec = (defaultResumeRateSecPerSec: number | undefined): number => {
    if (defaultResumeRateSecPerSec == null) return DEFAULT_RESUME_RATE_SEC_PER_SEC
    if (!Number.isFinite(defaultResumeRateSecPerSec) || defaultResumeRateSecPerSec == 0) return DEFAULT_RESUME_RATE_SEC_PER_SEC
    return Math.abs(defaultResumeRateSecPerSec)
  }

  const play = (defaultResumeRateSecPerSec?: number) => {
    if (state.rateSecPerSec === 0) {
      setState({ rateSecPerSec: resolveDefaultResumeRateSecPerSec(defaultResumeRateSecPerSec) })
    }
  }

  const pause = () => {
    setState({ rateSecPerSec: 0 })
  }

  const togglePlay = (defaultResumeRateSecPerSec?: number) => {
    if (state.rateSecPerSec === 0) {
      play(defaultResumeRateSecPerSec)
    } else {
      pause()
    }
  }

  const stepBy = (deltaSec: number) => {
    setEtSec(state.etSec + deltaSec)
  }

  const stepForward = () => stepBy(state.stepSec)
  const stepBackward = () => stepBy(-state.stepSec)

  /**
   * Move to the next faster rate in the ladder.
   * If at the fastest forward rate, stays there.
   */
  const faster = () => {
    const currentIdx = findClosestRateIndex(state.rateSecPerSec)
    const nextIdx = Math.min(currentIdx + 1, RATE_LADDER.length - 1)
    setRate(RATE_LADDER[nextIdx])
  }

  /**
   * Move to the next slower rate in the ladder.
   * If at the slowest (most negative) rate, stays there.
   */
  const slower = () => {
    const currentIdx = findClosestRateIndex(state.rateSecPerSec)
    const nextIdx = Math.max(currentIdx - 1, 0)
    setRate(RATE_LADDER[nextIdx])
  }

  /**
   * Toggle playback direction while maintaining approximate speed.
   * If paused, starts reverse using the provided default (fallback: -1 day/s).
   */
  const reverse = (defaultResumeRateSecPerSec?: number) => {
    if (state.rateSecPerSec === 0) {
      setState({ rateSecPerSec: -resolveDefaultResumeRateSecPerSec(defaultResumeRateSecPerSec) })
    } else {
      setState({ rateSecPerSec: -state.rateSecPerSec })
    }
  }

  /**
   * Set direction to forward if currently going backward.
   * If paused, starts forward using the provided default (fallback: 1 day/s).
   */
  const forward = (defaultResumeRateSecPerSec?: number) => {
    if (state.rateSecPerSec === 0) {
      setState({ rateSecPerSec: resolveDefaultResumeRateSecPerSec(defaultResumeRateSecPerSec) })
    } else if (state.rateSecPerSec < 0) {
      setState({ rateSecPerSec: -state.rateSecPerSec })
    }
  }

  /**
   * Advance time by a delta (used by the ticker).
   * This method quantizes the result.
   */
  const advanceTime = (deltaSec: number) => {
    const nextEt = state.etSec + deltaSec
    const clamped = Math.max(state.scrubMinEtSec, Math.min(state.scrubMaxEtSec, nextEt))
    const quantized = quantizeEt(clamped, state.quantumSec)
    if (quantized !== state.etSec) {
      setState({ etSec: quantized })
    }
  }

  return {
    getState,
    getSnapshot,
    getServerSnapshot,
    subscribe,

    // Actions
    setEtSec,
    setRate,
    setQuantumSec,
    setStepSec,
    setScrubRange,
    play,
    pause,
    togglePlay,
    stepBy,
    stepForward,
    stepBackward,
    faster,
    slower,
    reverse,
    forward,
    advanceTime,
  }
}

/**
 * Find the index of the closest rate in the ladder.
 */
function findClosestRateIndex(rate: number): number {
  let closestIdx = 0
  let closestDist = Math.abs(rate - RATE_LADDER[0])

  for (let i = 1; i < RATE_LADDER.length; i++) {
    const dist = Math.abs(rate - RATE_LADDER[i])
    if (dist < closestDist) {
      closestDist = dist
      closestIdx = i
    }
  }
  return closestIdx
}

// Singleton store instance
export const timeStore = createTimeStore()

/**
 * React hook to use the time store.
 * Re-renders when any state changes.
 */
export function useTimeStore(): TimeState {
  return useSyncExternalStore(timeStore.subscribe, timeStore.getSnapshot, timeStore.getServerSnapshot)
}

/**
 * React hook to subscribe to a specific slice of the time store.
 * Only re-renders when the selected value changes.
 */
export function useTimeStoreSelector<T>(selector: (state: TimeState) => T): T {
  return useSyncExternalStore(
    timeStore.subscribe,
    () => selector(timeStore.getSnapshot()),
    () => selector(timeStore.getServerSnapshot()),
  )
}
