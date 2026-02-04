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

  // TEMP DEBUG (PR-280): force whole-frame postprocessing while tuning Sun appearance.
  // Keep E2E snapshots stable by still disabling postprocessing in `?e2e` mode.
  let sunPostprocessMode: SunPostprocessMode = isE2e ? 'off' : 'wholeFrame'

  const sunExposure = clamp(parseNumber(searchParams, 'sunExposure') ?? 1, 0, 100)

  // TEMP DEBUG (PR-280): with forced `wholeFrame`, default to a perceptual tone map.
  // Users can still override via query params while tuning.
  const sunToneMapDefault = sunPostprocessMode === 'wholeFrame' ? 'filmic' : 'none'
  const sunToneMap = parseEnum(searchParams, 'sunToneMap', ['none', 'filmic', 'acesLike'] as const) ?? sunToneMapDefault

  // TEMP DEBUG (PR-280): we're forcing `wholeFrame`, so default bloom presets
  // can be simplified while we tune luminance.
  const sunBloomThresholdDefault = sunPostprocessMode === 'wholeFrame' ? 0.92 : 0.95
  const sunBloomStrengthDefault = sunPostprocessMode === 'wholeFrame' ? 0.7 : 0.6
  const sunBloomRadiusDefault = sunPostprocessMode === 'wholeFrame' ? 0.17 : 0.15

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
