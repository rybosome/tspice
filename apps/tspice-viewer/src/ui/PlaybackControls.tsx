import { useState, useCallback, useMemo } from 'react';
import { timeStore, useTimeStore, RATE_LADDER } from '../time/timeStore.js';
import type { SpiceClient } from '../spice/SpiceClient.js';

interface PlaybackControlsProps {
  spiceClient: SpiceClient;
}

/**
 * Format a rate value as a human-readable speed label.
 * E.g., 86400 => "1 day/s", -3600 => "-1 hour/s"
 */
function formatRateLabel(rate: number): string {
  if (rate === 0) return 'Paused';

  const absRate = Math.abs(rate);
  const sign = rate < 0 ? '-' : '';

  if (absRate >= 86400 * 365) {
    const years = absRate / (86400 * 365);
    return `${sign}${years.toFixed(years % 1 === 0 ? 0 : 1)} year/s`;
  }
  if (absRate >= 86400 * 30) {
    const months = absRate / (86400 * 30);
    return `${sign}${months.toFixed(months % 1 === 0 ? 0 : 1)} month/s`;
  }
  if (absRate >= 86400 * 7) {
    const weeks = absRate / (86400 * 7);
    return `${sign}${weeks.toFixed(weeks % 1 === 0 ? 0 : 1)} week/s`;
  }
  if (absRate >= 86400) {
    const days = absRate / 86400;
    return `${sign}${days.toFixed(days % 1 === 0 ? 0 : 1)} day/s`;
  }
  if (absRate >= 3600) {
    const hours = absRate / 3600;
    return `${sign}${hours.toFixed(hours % 1 === 0 ? 0 : 1)} hour/s`;
  }
  if (absRate >= 60) {
    const minutes = absRate / 60;
    return `${sign}${minutes.toFixed(minutes % 1 === 0 ? 0 : 1)} min/s`;
  }
  return `${sign}${absRate}×`;
}

/**
 * Format ET as days since J2000.
 */
function formatEtDays(etSec: number): string {
  const days = etSec / 86400;
  return days.toFixed(2);
}

export function PlaybackControls({ spiceClient }: PlaybackControlsProps) {
  const state = useTimeStore();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const utcString = useMemo(() => {
    try {
      return spiceClient.etToUtc(state.etSec);
    } catch {
      return 'N/A';
    }
  }, [spiceClient, state.etSec]);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    timeStore.setEtSec(Number(e.target.value));
  }, []);

  const handleQuantumChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    if (value > 0) {
      timeStore.setQuantumSec(value);
    }
  }, []);

  const isPlaying = state.rateSecPerSec !== 0;
  const isReverse = state.rateSecPerSec < 0;

  return (
    <div className="playbackControls">
      {/* Time Display */}
      <div className="playbackRow playbackTimeDisplay">
        <span className="playbackLabel">UTC:</span>
        <span className="playbackValue playbackUtc">{utcString}</span>
      </div>

      <div className="playbackRow playbackTimeDisplay">
        <span className="playbackLabel">ET:</span>
        <span className="playbackValue">
          {state.etSec.toFixed(1)}s ({formatEtDays(state.etSec)} days)
        </span>
      </div>

      {/* Scrub Slider */}
      <div className="playbackRow">
        <label className="playbackSliderLabel">
          <input
            type="range"
            className="playbackSlider"
            min={state.scrubMinEtSec}
            max={state.scrubMaxEtSec}
            step={state.quantumSec}
            value={state.etSec}
            onChange={handleSliderChange}
          />
        </label>
      </div>

      {/* Playback Controls */}
      <div className="playbackRow playbackButtons">
        <button
          className="playbackButton"
          onClick={() => timeStore.reverse()}
          title="Reverse direction"
        >
          {isReverse ? '⏪' : '◀'}
        </button>

        <button
          className="playbackButton"
          onClick={() => timeStore.stepBackward()}
          title={`Step back ${state.stepSec}s`}
        >
          ⏮
        </button>

        <button
          className="playbackButton playbackButtonMain"
          onClick={() => timeStore.togglePlay()}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <button
          className="playbackButton"
          onClick={() => timeStore.stepForward()}
          title={`Step forward ${state.stepSec}s`}
        >
          ⏭
        </button>

        <button
          className="playbackButton"
          onClick={() => timeStore.forward()}
          title="Forward direction"
        >
          {!isReverse || state.rateSecPerSec === 0 ? '▶' : '⏩'}
        </button>
      </div>

      {/* Speed Controls */}
      <div className="playbackRow playbackSpeedRow">
        <button
          className="playbackButton playbackSpeedButton"
          onClick={() => timeStore.slower()}
          title="Slower"
        >
          −
        </button>

        <span className="playbackSpeedLabel">
          {formatRateLabel(state.rateSecPerSec)}
        </span>

        <button
          className="playbackButton playbackSpeedButton"
          onClick={() => timeStore.faster()}
          title="Faster"
        >
          +
        </button>
      </div>

      {/* Rate Preset Buttons */}
      <div className="playbackRow playbackPresets">
        {RATE_LADDER.filter((r) => r > 0).slice(0, 5).map((rate) => (
          <button
            key={rate}
            className={`playbackPreset ${state.rateSecPerSec === rate ? 'playbackPresetActive' : ''}`}
            onClick={() => timeStore.setRate(rate)}
          >
            {formatRateLabel(rate).replace('/s', '')}
          </button>
        ))}
      </div>

      {/* Advanced Section */}
      <div className="playbackRow">
        <button
          className="playbackAdvancedToggle"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? '▼ Advanced' : '▶ Advanced'}
        </button>
      </div>

      {showAdvanced && (
        <div className="playbackAdvanced">
          <div className="playbackRow">
            <label className="playbackAdvancedLabel">
              Quantum (s):
              <input
                type="number"
                className="playbackAdvancedInput"
                min={0.001}
                step={0.01}
                value={state.quantumSec}
                onChange={handleQuantumChange}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
