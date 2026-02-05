export type SunPostprocessMode = 'off' | 'wholeFrame' | 'sunIsolated'

export type SunToneMap = 'none' | 'filmic' | 'acesLike'

export type SceneCanvasRuntimeConfig = {
  searchParams: URLSearchParams
  isE2e: boolean
  enableLogDepth: boolean

  /** Enables additional debug UI/knobs. */
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

  // Sun postprocessing mode.
  // Default behavior:
  // - E2E (`?e2e=1`): disable postprocessing for snapshot stability.
  // - Interactive: enable whole-frame postprocessing by default.
  //
  // In both modes, allow explicit overrides via `?sunPostprocessMode=...`.
  const sunPostprocessModeDefault: SunPostprocessMode = isE2e ? 'off' : 'wholeFrame'
  const sunPostprocessMode =
    parseEnum(searchParams, 'sunPostprocessMode', ['off', 'wholeFrame', 'sunIsolated'] as const) ??
    sunPostprocessModeDefault

  const sunExposure = clamp(parseNumber(searchParams, 'sunExposure') ?? 1.5, 0, 100)

  // Default to a perceptual tone map (postprocess-dependent in practice).
  // Note: when `sunPostprocessMode` is `off`, this has no visual effect.
  const sunToneMapDefault: SunToneMap = 'acesLike'
  const sunToneMap = parseEnum(searchParams, 'sunToneMap', ['none', 'filmic', 'acesLike'] as const) ?? sunToneMapDefault

  // Bloom defaults tuned for Sun appearance.
  const sunBloomThresholdDefault = 1.5
  const sunBloomStrengthDefault = 0.15
  const sunBloomRadiusDefault = 0.05
  const sunBloomResolutionScaleDefault = 1

  // Allow thresholds > 1: with HDR inputs this can be useful for controlling bloom pre-tonemap.
  const sunBloomThreshold = clamp(parseNumber(searchParams, 'sunBloomThreshold') ?? sunBloomThresholdDefault, 0, 10)
  const sunBloomStrength = clamp(parseNumber(searchParams, 'sunBloomStrength') ?? sunBloomStrengthDefault, 0, 20)
  const sunBloomRadius = clamp(parseNumber(searchParams, 'sunBloomRadius') ?? sunBloomRadiusDefault, 0, 1)
  const sunBloomResolutionScale = clamp(
    parseNumber(searchParams, 'sunBloomResolutionScale') ?? sunBloomResolutionScaleDefault,
    0.1,
    1,
  )

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
