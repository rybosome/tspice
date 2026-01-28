import { useMemo } from 'react'
import type { BodyRef, SpiceClient, EtSeconds, FrameId } from '../spice/SpiceClient.js'

interface SelectionInspectorProps {
  selectedBody: BodyRef
  focusBody: BodyRef
  spiceClient: SpiceClient
  etSec: EtSeconds
  observer: BodyRef
  frame: FrameId
}

/** Format a distance in km with appropriate units. */
function formatDistance(km: number): string {
  const absKm = Math.abs(km)
  if (absKm < 1) {
    return `${(km * 1000).toFixed(1)} m`
  }
  if (absKm < 1000) {
    return `${km.toFixed(1)} km`
  }
  if (absKm < 1_000_000) {
    return `${(km / 1000).toFixed(2)} × 10³ km`
  }
  if (absKm < 1_000_000_000) {
    return `${(km / 1_000_000).toFixed(2)} × 10⁶ km`
  }
  return `${(km / 1_000_000_000).toFixed(3)} × 10⁹ km`
}

/** Format a velocity in km/s with appropriate units. */
function formatVelocity(kmPerSec: number): string {
  const absV = Math.abs(kmPerSec)
  if (absV < 0.001) {
    return `${(kmPerSec * 1000).toFixed(2)} m/s`
  }
  if (absV < 1) {
    return `${(kmPerSec * 1000).toFixed(1)} m/s`
  }
  return `${kmPerSec.toFixed(2)} km/s`
}

/** Compute magnitude of a 3D vector. */
function magnitude(v: readonly [number, number, number]): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
}

export function SelectionInspector({
  selectedBody,
  focusBody,
  spiceClient,
  etSec,
  observer,
  frame,
}: SelectionInspectorProps) {
  const bodyInfo = useMemo(() => {
    try {
      // Get selected body's state relative to scene observer
      const selectedState = spiceClient.getBodyState({
        target: selectedBody,
        observer,
        frame,
        et: etSec,
      })

      // Position relative to scene origin (usually Sun)
      const positionKm = selectedState.positionKm
      const positionMagnitude = magnitude(positionKm)

      // If focus != selected, compute distance from focus to selected
      let distanceToFocusKm: number | null = null
      let velocityRelToFocusKmPerSec: number | null = null

      if (String(selectedBody) !== String(focusBody)) {
        const relState = spiceClient.getBodyState({
          target: selectedBody,
          observer: focusBody,
          frame,
          et: etSec,
        })
        distanceToFocusKm = magnitude(relState.positionKm)
        velocityRelToFocusKmPerSec = magnitude(relState.velocityKmPerSec)
      }

      return {
        positionKm,
        positionMagnitude,
        distanceToFocusKm,
        velocityRelToFocusKmPerSec,
      }
    } catch (err) {
      console.warn('SelectionInspector: error computing body state', err)
      return null
    }
  }, [selectedBody, focusBody, spiceClient, etSec, observer, frame])

  if (!bodyInfo) {
    return null
  }

  const bodyLabel = typeof selectedBody === 'string' 
    ? selectedBody.charAt(0).toUpperCase() + selectedBody.slice(1).toLowerCase()
    : `Body ${selectedBody}`

  const focusLabel = typeof focusBody === 'string'
    ? focusBody.charAt(0).toUpperCase() + focusBody.slice(1).toLowerCase()
    : `Body ${focusBody}`

  return (
    <div className="selectionInspector">
      <div className="selectionInspectorHeader">
        <span className="selectionInspectorTitle">{bodyLabel}</span>
      </div>
      <div className="selectionInspectorBody">
        <div className="selectionInspectorRow">
          <span className="selectionInspectorLabel">Position:</span>
          <span className="selectionInspectorValue">
            {formatDistance(bodyInfo.positionMagnitude)}
          </span>
        </div>
        {bodyInfo.distanceToFocusKm !== null && (
          <div className="selectionInspectorRow">
            <span className="selectionInspectorLabel">Distance to {focusLabel}:</span>
            <span className="selectionInspectorValue">
              {formatDistance(bodyInfo.distanceToFocusKm)}
            </span>
          </div>
        )}
        {bodyInfo.velocityRelToFocusKmPerSec !== null && (
          <div className="selectionInspectorRow">
            <span className="selectionInspectorLabel">Rel. velocity:</span>
            <span className="selectionInspectorValue">
              {formatVelocity(bodyInfo.velocityRelToFocusKmPerSec)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
