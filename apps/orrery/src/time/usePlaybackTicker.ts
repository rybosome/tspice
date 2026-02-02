import { useEffect, useRef } from 'react'
import { timeStore, useTimeStoreSelector } from './timeStore.js'

/**
 * Fixed timestep for simulation ticks (seconds).
 * ~60 ticks per second for smooth animation.
 */
const TICK_SEC = 1 / 60

/**
 * Maximum number of ticks to process per frame.
 * Prevents runaway accumulation if the tab was backgrounded.
 */
const MAX_TICKS_PER_FRAME = 10

/**
 * Hook that runs a deterministic fixed-step ticker for time playback.
 *
 * Uses a wallclock accumulator pattern:
 * - requestAnimationFrame provides wallclock delta
 * - Accumulator tracks "unspent" wallclock time
 * - Fixed ticks are processed at TICK_SEC intervals
 * - Each tick advances ET by `rateSecPerSec * TICK_SEC`
 *
 * This ensures deterministic time progression regardless of frame rate.
 */
export function usePlaybackTicker(): void {
  const rate = useTimeStoreSelector((s) => s.rateSecPerSec)
  const accumulatorRef = useRef(0)
  const lastTimeRef = useRef<number | null>(null)

  useEffect(() => {
    // Only run the ticker when we have a non-zero rate
    if (rate === 0) {
      lastTimeRef.current = null
      accumulatorRef.current = 0
      return
    }

    // If the playback rate changes while playing, reset the wallclock reference to
    // avoid a large first delta due to effect restart.
    lastTimeRef.current = null

    let frameId: number | null = null

    const tick = (now: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = now
        frameId = requestAnimationFrame(tick)
        return
      }

      const wallDeltaSec = Math.max(0, (now - lastTimeRef.current) / 1000)
      lastTimeRef.current = now

      // Add wall-clock delta to accumulator
      accumulatorRef.current += wallDeltaSec

      // Process fixed-step ticks (capped to avoid runaway)
      let ticksProcessed = 0
      while (accumulatorRef.current >= TICK_SEC && ticksProcessed < MAX_TICKS_PER_FRAME) {
        // Use the current rate from the store (in case it changed)
        const currentRate = timeStore.getState().rateSecPerSec
        if (currentRate === 0) {
          // Rate became zero during processing, stop
          accumulatorRef.current = 0
          break
        }

        const etDelta = currentRate * TICK_SEC
        timeStore.advanceTime(etDelta)

        accumulatorRef.current -= TICK_SEC
        ticksProcessed++
      }

      // Cap accumulator to prevent unbounded growth
      if (accumulatorRef.current > TICK_SEC * MAX_TICKS_PER_FRAME) {
        accumulatorRef.current = TICK_SEC * MAX_TICKS_PER_FRAME
      }

      frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)

    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId)
      }
    }
  }, [rate])
}
