export type SunPostprocessMode = 'off' | 'wholeFrame' | 'sunIsolated'

export type SunToneMap = 'none' | 'filmic' | 'acesLike'

export type SceneCanvasRuntimeConfig = {
  searchParams: URLSearchParams
  isE2e: boolean
  enableLogDepth: boolean

  /** Enables debug-only UI/knobs. */
  debug: boolean

  /** Stable seed used for starfield + skydome noise. */
  starSeed: number

  /** Optional UTC timestamp for initial time (higher precedence than `initialEt`). */
  initialUtc: string | null

  /** Optional ET seconds for initial time. */
  initialEt: number | null

  // Sun postprocessing (query params)
  sunPostprocessMode: SunPostprocessMode
  sunExposure: number
  sunToneMap: SunToneMap
  sunBloomThreshold: number
  sunBloomStrength: number
  sunBloomRadius: number
  sunBloomResolutionScale: number
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

const parseNumber = (searchParams: URLSearchParams, key: string) => {
  const raw = searchParams.get(key)
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

const parseEnum = <T extends string>(searchParams: URLSearchParams, key: string, allowed: readonly T[]): T | null => {
  const raw = searchParams.get(key)
  if (!raw) return null
  const normalized = raw.trim()
  return (allowed as readonly string[]).includes(normalized) ? (normalized as T) : null
}

export function parseSceneCanvasRuntimeConfigFromLocationSearch(locationSearch: string): SceneCanvasRuntimeConfig {
  const searchParams = new URLSearchParams(locationSearch)

  const isE2e = searchParams.has('e2e')
  const enableLogDepth = searchParams.has('logDepth')

  const debug = (() => {
    const raw = searchParams.get('debug')
    if (raw == null) return false
    if (raw === '') return true
    const v = raw.toLowerCase()
    return v === '1' || v === 'true'
  })()

  const starSeed = (() => {
    const fromUrl = searchParams.get('starSeed') ?? searchParams.get('seed')
    if (fromUrl) {
      const parsed = Number(fromUrl)
      if (Number.isFinite(parsed)) return Math.floor(parsed)
    }

    // E2E snapshots must be stable regardless of Math.random overrides.
    return isE2e ? 1 : 1337
  })()

  const initialUtc = searchParams.get('utc')

  const initialEt = (() => {
    const etParam = searchParams.get('et')
    if (!etParam) return null
    const parsed = Number(etParam)
    return Number.isFinite(parsed) ? parsed : null
  })()

  const sunPostprocessMode =
    parseEnum(searchParams, 'sunPostprocessMode', ['off', 'wholeFrame', 'sunIsolated'] as const) ??
    // Default to the more representative preset when no query params are provided.
    // Preserve stable E2E snapshots by disabling postprocessing unless explicitly enabled.
    (isE2e ? 'off' : 'sunIsolated')

  const sunExposure = clamp(parseNumber(searchParams, 'sunExposure') ?? 1, 0, 100)

  // In `sunIsolated` mode, we want a subtle, safe default that doesn't globally
  // remap the scene brightness/contrast. Users can opt into tonemapping via the
  // query params.
  const sunToneMapDefault = sunPostprocessMode === 'wholeFrame' ? 'filmic' : 'none'
  const sunToneMap = parseEnum(searchParams, 'sunToneMap', ['none', 'filmic', 'acesLike'] as const) ?? sunToneMapDefault

  // For `sunIsolated`, keep bloom conservative: the Sun can be extremely bright
  // at typical zoom levels and a low threshold/strong bloom can wash out most
  // of the frame.
  const sunBloomThresholdDefault = sunPostprocessMode === 'sunIsolated' ? 0.85 : 0.95
  const sunBloomStrengthDefault = sunPostprocessMode === 'sunIsolated' ? 0.4 : 0.6
  const sunBloomRadiusDefault = sunPostprocessMode === 'sunIsolated' ? 0.12 : 0.15

  // Allow thresholds > 1: with HDR inputs this can be useful for controlling bloom pre-tonemap.
  const sunBloomThreshold = clamp(parseNumber(searchParams, 'sunBloomThreshold') ?? sunBloomThresholdDefault, 0, 10)
  const sunBloomStrength = clamp(parseNumber(searchParams, 'sunBloomStrength') ?? sunBloomStrengthDefault, 0, 20)
  const sunBloomRadius = clamp(parseNumber(searchParams, 'sunBloomRadius') ?? sunBloomRadiusDefault, 0, 1)
  const sunBloomResolutionScale = clamp(parseNumber(searchParams, 'sunBloomResolutionScale') ?? 0.5, 0.1, 1)

  return {
    searchParams,
    isE2e,
    enableLogDepth,
    debug,
    starSeed,
    initialUtc,
    initialEt,
    sunPostprocessMode,
    sunExposure,
    sunToneMap,
    sunBloomThreshold,
    sunBloomStrength,
    sunBloomRadius,
    sunBloomResolutionScale,
  }
}
