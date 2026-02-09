import { Fragment, useEffect, useMemo, useState } from 'react'
import type { BodyRef, SpiceClient, FrameId } from '../spice/SpiceClient.js'
import { resolveBodyRegistryEntry, type BodyRegistryEntry } from '../scene/BodyRegistry.js'
import { getApproxOrbitalPeriodSec } from '../scene/orbits/orbitalPeriods.js'
import { getNaifExtras, type NaifExtras } from '../data/naifExtras.js'
import { useTimeStoreSelector } from '../time/timeStore.js'

interface SelectionInspectorProps {
  selectedBody: BodyRef
  focusBody: BodyRef
  spiceClient: SpiceClient
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

/** Format a radius in km with appropriate units. */
function formatRadius(km: number): string {
  if (km < 1000) {
    return `${km.toFixed(1)} km`
  }
  return `${(km / 1000).toFixed(1)} × 10³ km`
}

/** Format orbital period in appropriate units. */
function formatOrbitalPeriod(seconds: number): string {
  const days = seconds / 86_400
  if (days < 1) {
    const hours = seconds / 3600
    return `${hours.toFixed(1)} hours`
  }
  if (days < 365) {
    return `${days.toFixed(1)} days`
  }
  const years = days / 365.256
  return `${years.toFixed(2)} years`
}

/** Compute magnitude of a 3D vector. */
function magnitude(v: readonly [number, number, number]): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
}

const SUPERSCRIPT_MAP: Readonly<Record<string, string>> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '-': '⁻',
}

function toSuperscript(n: number): string {
  return String(n)
    .split('')
    .map((c) => SUPERSCRIPT_MAP[c] ?? c)
    .join('')
}

function formatScientific(n: number, digits = 3): string {
  const [mantissa, exponentRaw] = n.toExponential(digits).split('e')
  const exponent = Number(exponentRaw)
  return `${mantissa} × 10${toSuperscript(exponent)}`
}

type ExtrasRow = { label: string; value: string }
type ExtrasGroup = { title: string; rows: ExtrasRow[] }

function buildExtrasGroups(
  extras: NaifExtras,
  opts?: {
    orbitalPeriodSec?: number | null
    fallbackRadiusKm?: number | null
  },
): ExtrasGroup[] {
  const groups: ExtrasGroup[] = []

  const physicalRows: ExtrasRow[] = []
  if (extras.meanRadiusKm != null) {
    physicalRows.push({ label: 'Mean radius', value: formatRadius(extras.meanRadiusKm) })
  } else if (opts?.fallbackRadiusKm != null) {
    physicalRows.push({ label: 'Radius', value: formatRadius(opts.fallbackRadiusKm) })
  }
  if (extras.massKg != null) {
    physicalRows.push({ label: 'Mass', value: `${formatScientific(extras.massKg)} kg` })
  }
  if (extras.densityGcm3 != null) {
    physicalRows.push({ label: 'Density', value: `${extras.densityGcm3.toFixed(2)} g/cm³` })
  }
  if (physicalRows.length > 0) {
    groups.push({ title: 'Physical properties', rows: physicalRows })
  }

  const dynamicsRows: ExtrasRow[] = []
  if (extras.surfaceGravityMs2 != null) {
    dynamicsRows.push({ label: 'Gravity', value: `${extras.surfaceGravityMs2.toFixed(2)} m/s²` })
  }
  if (extras.escapeVelocityKms != null) {
    dynamicsRows.push({ label: 'Escape v', value: `${extras.escapeVelocityKms.toFixed(2)} km/s` })
  }
  if (opts?.orbitalPeriodSec != null) {
    dynamicsRows.push({ label: 'Orbital period', value: formatOrbitalPeriod(opts.orbitalPeriodSec) })
  }
  if (dynamicsRows.length > 0) {
    groups.push({ title: 'Dynamics', rows: dynamicsRows })
  }

  const reflectivityRows: ExtrasRow[] = []
  if (extras.meanTemperatureK != null) {
    reflectivityRows.push({ label: 'Mean temp', value: `${extras.meanTemperatureK.toFixed(0)} K` })
  }
  if (extras.bondAlbedo != null) {
    reflectivityRows.push({ label: 'Bond albedo', value: extras.bondAlbedo.toFixed(3) })
  }
  if (extras.geometricAlbedo != null) {
    reflectivityRows.push({ label: 'Geom. albedo', value: extras.geometricAlbedo.toFixed(3) })
  }
  if (extras.atmosphereSummary) {
    reflectivityRows.push({ label: 'Atmosphere', value: extras.atmosphereSummary })
  }
  if (reflectivityRows.length > 0) {
    groups.push({ title: 'Reflectivity / thermal', rows: reflectivityRows })
  }

  return groups
}

/** Look up body registry entry by BodyRef. */
function findBodyRegistryEntry(bodyRef: BodyRef): BodyRegistryEntry | undefined {
  return resolveBodyRegistryEntry(String(bodyRef))
}

const INTEGER_BODY_REF_RE = /^[+-]?\d+$/

function tryNormalizeNumericBodyRef(raw: string): number | null {
  // We only normalize when the string is an unambiguous base-10 integer.
  //
  // IMPORTANT: this intentionally does NOT accept decimals / exponent notation
  // so it stays aligned with the registry resolver policy.
  const s = raw.trim()
  if (!s) return null
  if (!INTEGER_BODY_REF_RE.test(s)) return null

  const n = Number(s)
  if (!Number.isSafeInteger(n)) return null
  return n
}

function resolveBodyRefForSpice(bodyRef: BodyRef, registryEntry: BodyRegistryEntry | undefined): BodyRef | null {
  if (typeof bodyRef !== 'string') {
    return Number.isSafeInteger(bodyRef) ? bodyRef : null
  }

  const trimmed = bodyRef.trim()
  if (!trimmed) return null

  // If the caller passed a BodyRegistry `id` (e.g. "MARS"), use the registry's
  // preferred SPICE lookup key (often the barycenter numeric ID for de432s).
  //
  // This avoids passing arbitrary strings into SPICE.
  if (registryEntry && trimmed.toUpperCase() === registryEntry.id) {
    return registryEntry.body
  }

  // If we're carrying around numeric IDs as strings (e.g. from <select />),
  // normalize them back to numbers for `SpiceClient.getBodyState`.
  const numeric = tryNormalizeNumericBodyRef(trimmed)
  if (numeric != null) return numeric

  // If we resolved via the registry (e.g. from URL params / mesh.userData),
  // use the registry's preferred SPICE key.
  if (registryEntry) return registryEntry.body

  // Refuse to pass unknown strings into SPICE.
  return null
}

/** Format body kind for display. */
function formatBodyKind(kind: string): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1)
}

export function SelectionInspector({ selectedBody, focusBody, spiceClient, observer, frame }: SelectionInspectorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  type BodyInfo = {
    positionKm: readonly [number, number, number]
    positionMagnitude: number
    velocityKmPerSec: readonly [number, number, number]
    velocityMagnitude: number
    distanceToFocusKm: number | null
    velocityRelToFocusKmPerSec: number | null
    velocityRelToFocusVector: readonly [number, number, number] | null
    orbitalPeriodSec: number | null
  }

  const [bodyInfo, setBodyInfo] = useState<BodyInfo | null>(null)

  // IMPORTANT:
  // This component is the only place that needs live ET updates for the inspector.
  // Keeping the subscription here prevents the entire <SceneCanvas> tree from
  // re-rendering every animation frame when playback is running (which can feel
  // like taps/gestures are being "eaten" on mobile).
  const etSec = useTimeStoreSelector((s) => s.etSec)

  const registryEntry = useMemo(() => findBodyRegistryEntry(selectedBody), [selectedBody])
  const focusRegistryEntry = useMemo(() => findBodyRegistryEntry(focusBody), [focusBody])

  const selectedBodyForSpice = useMemo(
    () => resolveBodyRefForSpice(selectedBody, registryEntry),
    [selectedBody, registryEntry],
  )
  const focusBodyForSpice = useMemo(
    () => resolveBodyRefForSpice(focusBody, focusRegistryEntry),
    [focusBody, focusRegistryEntry],
  )
  const observerRegistryEntry = useMemo(() => findBodyRegistryEntry(observer), [observer])
  const observerForSpice = useMemo(
    () => resolveBodyRefForSpice(observer, observerRegistryEntry),
    [observer, observerRegistryEntry],
  )

  const unavailableReason = useMemo(() => {
    const selectedJson = JSON.stringify(selectedBody)

    if (selectedBodyForSpice == null) {
      return `Unsupported target: selectedBody=${selectedJson}`
    }

    if (observerForSpice == null) {
      return `Unsupported observer: observer=${JSON.stringify(observer)} (selectedBody=${selectedJson})`
    }

    if (focusBodyForSpice == null) {
      return `Unsupported focus: focusBody=${JSON.stringify(focusBody)} (selectedBody=${selectedJson})`
    }

    return null
  }, [selectedBodyForSpice, observerForSpice, focusBodyForSpice, selectedBody, observer, focusBody])

  const orbitalPeriodSec = useMemo(
    () => (selectedBodyForSpice != null ? getApproxOrbitalPeriodSec(selectedBodyForSpice) : null),
    [selectedBodyForSpice],
  )

  useEffect(() => {
    let cancelled = false

    if (selectedBodyForSpice == null || observerForSpice == null || focusBodyForSpice == null) {
      setBodyInfo(null)
      return
    }

    void (async () => {
      try {
        // Get selected body's state relative to scene observer
        const selectedState = await spiceClient.getBodyState({
          target: selectedBodyForSpice,
          observer: observerForSpice,
          frame,
          et: etSec,
        })

        // Position relative to scene origin (usually Sun)
        const positionKm = selectedState.positionKm
        const positionMagnitude = magnitude(positionKm)
        const velocityKmPerSec = selectedState.velocityKmPerSec
        const velocityMagnitude = magnitude(velocityKmPerSec)

        // If focus != selected, compute distance from focus to selected
        let distanceToFocusKm: number | null = null
        let velocityRelToFocusKmPerSec: number | null = null
        let velocityRelToFocusVector: readonly [number, number, number] | null = null

        if (String(selectedBodyForSpice) !== String(focusBodyForSpice)) {
          const relState = await spiceClient.getBodyState({
            target: selectedBodyForSpice,
            observer: focusBodyForSpice,
            frame,
            et: etSec,
          })
          distanceToFocusKm = magnitude(relState.positionKm)
          velocityRelToFocusKmPerSec = magnitude(relState.velocityKmPerSec)
          velocityRelToFocusVector = relState.velocityKmPerSec
        }

        const nextInfo: BodyInfo = {
          positionKm,
          positionMagnitude,
          velocityKmPerSec,
          velocityMagnitude,
          distanceToFocusKm,
          velocityRelToFocusKmPerSec,
          velocityRelToFocusVector,
          orbitalPeriodSec: orbitalPeriodSec ?? null,
        }

        if (!cancelled) setBodyInfo(nextInfo)
      } catch (err) {
        console.warn('SelectionInspector: error computing body state', err)
        if (!cancelled) setBodyInfo(null)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [selectedBodyForSpice, focusBodyForSpice, spiceClient, etSec, observerForSpice, frame, orbitalPeriodSec])

  const bodyLabel =
    registryEntry?.style.label ??
    (typeof selectedBody === 'string'
      ? selectedBody.charAt(0).toUpperCase() + selectedBody.slice(1).toLowerCase()
      : `Body ${selectedBody}`)

  const focusLabel =
    focusRegistryEntry?.style.label ??
    (typeof focusBody === 'string'
      ? focusBody.charAt(0).toUpperCase() + focusBody.slice(1).toLowerCase()
      : `Body ${focusBody}`)

  const isFocused = useMemo(() => {
    // Match UI semantics: compare by stable registry ids when possible.
    if (registryEntry && focusRegistryEntry) {
      return registryEntry.id === focusRegistryEntry.id
    }

    // Fall back to comparing normalized numeric refs, then raw string forms.
    const selectedNorm = typeof selectedBody === 'string' ? tryNormalizeNumericBodyRef(selectedBody) : selectedBody
    const focusNorm = typeof focusBody === 'string' ? tryNormalizeNumericBodyRef(focusBody) : focusBody
    if (selectedNorm != null && focusNorm != null) {
      return String(selectedNorm) === String(focusNorm)
    }
    return String(selectedBody) === String(focusBody)
  }, [registryEntry, focusRegistryEntry, selectedBody, focusBody])

  const naifId = registryEntry?.naifIds?.body
  const extras = useMemo(() => getNaifExtras(naifId), [naifId])
  const extrasGroups = useMemo(
    () =>
      buildExtrasGroups(extras ?? {}, {
        orbitalPeriodSec: orbitalPeriodSec ?? null,
        fallbackRadiusKm: registryEntry?.style.radiusKm ?? null,
      }),
    [extras, orbitalPeriodSec, registryEntry?.style.radiusKm],
  )

  const typeValue = extras?.classification
    ? formatBodyKind(extras.classification)
    : registryEntry
      ? formatBodyKind(registryEntry.kind)
      : null

  return (
    <div className="selectionInspector">
      <div className="selectionInspectorHeader">
        <span className="selectionInspectorTitle">{bodyLabel}</span>
        <button
          className={`selectionInspectorToggle ${showAdvanced ? 'selectionInspectorToggleActive' : ''}`}
          onClick={() => setShowAdvanced((v) => !v)}
          type="button"
          aria-pressed={showAdvanced}
          title={showAdvanced ? 'Show basic info' : 'Show advanced info'}
        >
          {showAdvanced ? '−' : '+'}
        </button>
      </div>

      <div className="selectionInspectorBody">
        {!bodyInfo && (
          <div className="selectionInspectorRow">
            <span className="selectionInspectorLabel">State:</span>
            <span className="selectionInspectorValue">{unavailableReason ?? 'Unavailable (missing kernels?)'}</span>
          </div>
        )}

        {/* Basic fields */}
        {/*
          The registry-driven `kind` is a coarse classification. When the NAIF extras dataset
          provides a more specific/authoritative classification, prefer that.
        */}
        {typeValue && (
          <div className="selectionInspectorRow">
            <span className="selectionInspectorLabel">Type:</span>
            <span className="selectionInspectorValue">{typeValue}</span>
          </div>
        )}

        {bodyInfo && bodyInfo.distanceToFocusKm != null && (
          <div className="selectionInspectorRow">
            <span className="selectionInspectorLabel">Distance to {focusLabel}:</span>
            <span className="selectionInspectorValue">{formatDistance(bodyInfo.distanceToFocusKm)}</span>
          </div>
        )}

        {bodyInfo && isFocused && (
          <div className="selectionInspectorRow">
            <span className="selectionInspectorLabel">Distance from Sun:</span>
            <span className="selectionInspectorValue">{formatDistance(bodyInfo.positionMagnitude)}</span>
          </div>
        )}

        {bodyInfo && bodyInfo.velocityRelToFocusKmPerSec != null && (
          <div className="selectionInspectorRow">
            <span className="selectionInspectorLabel">Velocity:</span>
            <span className="selectionInspectorValue">{formatVelocity(bodyInfo.velocityRelToFocusKmPerSec)}</span>
          </div>
        )}

        {bodyInfo && isFocused && (
          <div className="selectionInspectorRow">
            <span className="selectionInspectorLabel">Orbital velocity:</span>
            <span className="selectionInspectorValue">{formatVelocity(bodyInfo.velocityMagnitude)}</span>
          </div>
        )}

        {/* Advanced fields */}
        {showAdvanced && (
          <>
            {extrasGroups.length > 0 ? (
              <>
                <div className="selectionInspectorDivider" />
                {extrasGroups.map((group, groupIndex) => (
                  <Fragment key={group.title}>
                    {groupIndex > 0 && <div className="selectionInspectorDivider" />}
                    {group.rows.map(({ label, value }) => (
                      <div key={`${group.title}-${label}`} className="selectionInspectorRow">
                        <span className="selectionInspectorLabel">{label}:</span>
                        <span className="selectionInspectorValue">{value}</span>
                      </div>
                    ))}
                  </Fragment>
                ))}
              </>
            ) : (
              <>
                {(registryEntry?.style.radiusKm || orbitalPeriodSec) && <div className="selectionInspectorDivider" />}

                {registryEntry?.style.radiusKm && (
                  <div className="selectionInspectorRow">
                    <span className="selectionInspectorLabel">Radius:</span>
                    <span className="selectionInspectorValue">{formatRadius(registryEntry.style.radiusKm)}</span>
                  </div>
                )}

                {orbitalPeriodSec && (
                  <div className="selectionInspectorRow">
                    <span className="selectionInspectorLabel">Orbital period:</span>
                    <span className="selectionInspectorValue">{formatOrbitalPeriod(orbitalPeriodSec)}</span>
                  </div>
                )}
              </>
            )}

            {bodyInfo && (
              <>
                <div className="selectionInspectorDivider" />

                <div className="selectionInspectorRow">
                  <span className="selectionInspectorLabel">Position (X):</span>
                  <span className="selectionInspectorValue">{formatDistance(bodyInfo.positionKm[0])}</span>
                </div>
                <div className="selectionInspectorRow">
                  <span className="selectionInspectorLabel">Position (Y):</span>
                  <span className="selectionInspectorValue">{formatDistance(bodyInfo.positionKm[1])}</span>
                </div>
                <div className="selectionInspectorRow">
                  <span className="selectionInspectorLabel">Position (Z):</span>
                  <span className="selectionInspectorValue">{formatDistance(bodyInfo.positionKm[2])}</span>
                </div>

                {bodyInfo.velocityRelToFocusVector && (
                  <>
                    <div className="selectionInspectorDivider" />
                    <div className="selectionInspectorRow">
                      <span className="selectionInspectorLabel">Velocity (X):</span>
                      <span className="selectionInspectorValue">
                        {formatVelocity(bodyInfo.velocityRelToFocusVector[0])}
                      </span>
                    </div>
                    <div className="selectionInspectorRow">
                      <span className="selectionInspectorLabel">Velocity (Y):</span>
                      <span className="selectionInspectorValue">
                        {formatVelocity(bodyInfo.velocityRelToFocusVector[1])}
                      </span>
                    </div>
                    <div className="selectionInspectorRow">
                      <span className="selectionInspectorLabel">Velocity (Z):</span>
                      <span className="selectionInspectorValue">
                        {formatVelocity(bodyInfo.velocityRelToFocusVector[2])}
                      </span>
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
