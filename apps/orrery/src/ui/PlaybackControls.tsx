import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SpiceAsync } from '@rybosome/tspice'
import { timeStore, useTimeStore } from '../time/timeStore.js'

interface PlaybackControlsProps {
  spice: SpiceAsync
  /**
   * Provides a zoom-dependent default rate (sim seconds per wall-clock second)
   * to use when resuming from pause.
   */
  getDefaultResumeRateSecPerSec?: () => number
}

/**
 * Format a rate as short display label for the RATE row
 */
function formatRateShort(rate: number): string {
  if (rate === 0) return '0×'

  const absRate = Math.abs(rate)
  const sign = rate < 0 ? '-' : ''

  if (absRate >= 86400 * 365) {
    const years = absRate / (86400 * 365)
    return `${sign}${years.toFixed(years % 1 === 0 ? 0 : 1)}y/s`
  }
  if (absRate >= 86400 * 30) {
    const months = absRate / (86400 * 30)
    return `${sign}${months.toFixed(months % 1 === 0 ? 0 : 1)}mo/s`
  }
  if (absRate >= 86400 * 7) {
    const weeks = absRate / (86400 * 7)
    return `${sign}${weeks.toFixed(weeks % 1 === 0 ? 0 : 1)}w/s`
  }
  if (absRate >= 86400) {
    const days = absRate / 86400
    return `${sign}${days.toFixed(days % 1 === 0 ? 0 : 1)}d/s`
  }
  if (absRate >= 3600) {
    const hours = absRate / 3600
    return `${sign}${hours.toFixed(hours % 1 === 0 ? 0 : 1)}h/s`
  }
  if (absRate >= 60) {
    const minutes = absRate / 60
    return `${sign}${minutes.toFixed(minutes % 1 === 0 ? 0 : 1)}m/s`
  }
  return `${sign}${absRate}×`
}

const PAUSE_ICON = '⏸\uFE0E'

/** Time playback and scrub controls (UTC/ET display + rate controls). */
export function PlaybackControls({ spice, getDefaultResumeRateSecPerSec }: PlaybackControlsProps) {
  const state = useTimeStore()

  const [utcString, setUtcString] = useState<string>('…')

  useEffect(() => {
    let cancelled = false

    void spice.kit
      .etToUtc(state.etSec, 'ISOC', 0)
      .then((s) => {
        if (!cancelled) setUtcString(s)
      })
      .catch(() => {
        if (!cancelled) setUtcString('N/A')
      })

    return () => {
      cancelled = true
    }
  }, [spice, state.etSec])

  const etString = useMemo(() => {
    return `${state.etSec.toFixed(1)}s`
  }, [state.etSec])

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    timeStore.setEtSec(Number(e.target.value))
  }, [])

  const isPlaying = state.rateSecPerSec !== 0
  const isReverse = state.rateSecPerSec < 0

  return (
    <div className="playbackControls">
      {/* Time Display - stacked UTC and ET */}
      <div className="playbackTimeRow">
        <span className="playbackTimeLabel">UTC:</span>
        <span className="playbackTimeValue playbackTimeMono">{utcString}</span>
      </div>

      <div className="playbackTimeRow">
        <span className="playbackTimeLabel">ET:</span>
        <span className="playbackTimeValue">{etString}</span>
      </div>

      {/* Scrub Slider */}
      <div className="playbackSliderRow">
        <input
          type="range"
          className="playbackSlider"
          min={state.scrubMinEtSec}
          max={state.scrubMaxEtSec}
          step={state.quantumSec}
          value={state.etSec}
          onChange={handleSliderChange}
        />
      </div>

      {/* Playback Buttons Row: [◀◀] [◀] [▶] [▶▶] */}
      <div className="playbackButtonsRow">
        <button
          className={`asciiBtn ${isReverse ? 'asciiBtnActive' : ''}`}
          onClick={() => timeStore.reverse(getDefaultResumeRateSecPerSec?.())}
          title="Reverse direction"
        >
          <span className="asciiBtnBracket">[</span>
          <span className="asciiBtnContent">◀◀</span>
          <span className="asciiBtnBracket">]</span>
        </button>

        <button className="asciiBtn" onClick={() => timeStore.stepBackward()} title={`Step back ${state.stepSec}s`}>
          <span className="asciiBtnBracket">[</span>
          <span className="asciiBtnContent">◀</span>
          <span className="asciiBtnBracket">]</span>
        </button>

        <button
          className={`asciiBtn asciiBtnMain ${isPlaying ? 'asciiBtnActive' : ''}`}
          onClick={() => timeStore.togglePlay(getDefaultResumeRateSecPerSec?.())}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          <span className="asciiBtnBracket">[</span>
          <span className="asciiBtnContent">{isPlaying ? PAUSE_ICON : '▶'}</span>
          <span className="asciiBtnBracket">]</span>
        </button>

        <button className="asciiBtn" onClick={() => timeStore.stepForward()} title={`Step forward ${state.stepSec}s`}>
          <span className="asciiBtnBracket">[</span>
          <span className="asciiBtnContent">▶</span>
          <span className="asciiBtnBracket">]</span>
        </button>

        <button
          className={`asciiBtn ${!isReverse && state.rateSecPerSec !== 0 ? 'asciiBtnActive' : ''}`}
          onClick={() => timeStore.forward(getDefaultResumeRateSecPerSec?.())}
          title="Forward direction"
        >
          <span className="asciiBtnBracket">[</span>
          <span className="asciiBtnContent">▶▶</span>
          <span className="asciiBtnBracket">]</span>
        </button>
      </div>

      {/* RATE row: RATE: [-] 1d/s [+] */}
      <div className="playbackRateRow">
        <span className="playbackRateLabel">RATE:</span>
        <button className="asciiBtn asciiBtnSmall" onClick={() => timeStore.slower()} title="Slower">
          <span className="asciiBtnBracket">[</span>
          <span className="asciiBtnContent">−</span>
          <span className="asciiBtnBracket">]</span>
        </button>
        <span className="playbackRateValue">{formatRateShort(state.rateSecPerSec)}</span>
        <button className="asciiBtn asciiBtnSmall" onClick={() => timeStore.faster()} title="Faster">
          <span className="asciiBtnBracket">[</span>
          <span className="asciiBtnContent">+</span>
          <span className="asciiBtnBracket">]</span>
        </button>
      </div>
    </div>
  )
}
