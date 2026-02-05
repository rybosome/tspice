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

  /** Enables Milky Way / skydome background effects. */
  animatedSky: boolean

  /** Enables background sky twinkle. */
  skyTwinkle: boolean

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

  // Sun surface tuning (granulation/filaments).
  sunSeed: number
  sunGranulationScale: number
  sunGranulationSpeed: number
  sunGranulationIntensity: number
  sunFilamentScale: number
  sunFilamentSpeed: number
  sunFilamentIntensity: number
  sunFilamentThreshold: number
  sunFilamentLatitudeBias: number
  sunLimbStrength: number
  sunDifferentialRotationStrength: number
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

const parseBoolean = (searchParams: URLSearchParams, key: string) => {
  const raw = searchParams.get(key)
  if (raw == null) return null
  if (raw === '') return true

  const v = raw.toLowerCase()

  if (v === '1' || v === 'true') return true
  if (v === '0' || v === 'false') return false

  return null
}

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

  // Sky effects.
  // Default ON for interactive runs; can be overridden via `?milkyWay=...`.
  // Disabled by default for e2e tests to keep snapshots deterministic.
  const animatedSky = (() => {
    if (isE2e) return false

    const fromUrl = parseBoolean(searchParams, 'milkyWay') ?? parseBoolean(searchParams, 'animatedSky')
    return fromUrl ?? true
  })()

  // Star twinkle is separate from the Milky Way toggle.
  // Default OFF unless explicitly enabled via `?twinkle=...`.
  const skyTwinkle = (() => {
    if (isE2e) return false

    const fromUrl = parseBoolean(searchParams, 'twinkle')
    return fromUrl ?? false
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

  // ---------------------------------------------------------------------------
  // Sun surface tuning (shader uniforms)
  // ---------------------------------------------------------------------------

  const sunSeed = (() => {
    const fromUrl = parseNumber(searchParams, 'sunSeed')
    if (fromUrl != null && Number.isFinite(fromUrl)) return Math.floor(fromUrl)
    // Default: reuse the app-wide stable seed so sky + Sun move together.
    return starSeed
  })()

  // Keep defaults subtle to avoid fighting bloom/tonemap.
  const sunGranulationScale = clamp(parseNumber(searchParams, 'sunGranScale') ?? 45.0, 1, 200)
  const sunGranulationSpeed = clamp(parseNumber(searchParams, 'sunGranSpeed') ?? 0.08, 0, 2)
  const sunGranulationIntensity = clamp(parseNumber(searchParams, 'sunGranIntensity') ?? 0.25, 0, 1)

  const sunFilamentScale = clamp(parseNumber(searchParams, 'sunFilScale') ?? 6.0, 0.1, 80)
  const sunFilamentSpeed = clamp(parseNumber(searchParams, 'sunFilSpeed') ?? 0.06, 0, 2)
  const sunFilamentIntensity = clamp(parseNumber(searchParams, 'sunFilIntensity') ?? 0.18, 0, 1)
  const sunFilamentThreshold = clamp(parseNumber(searchParams, 'sunFilThreshold') ?? 0.62, 0, 1)
  const sunFilamentLatitudeBias = clamp(parseNumber(searchParams, 'sunFilLatBias') ?? 0.35, 0, 1)

  const sunLimbStrength = clamp(parseNumber(searchParams, 'sunLimbStrength') ?? 0.35, 0, 1)
  const sunDifferentialRotationStrength = clamp(parseNumber(searchParams, 'sunDiffRot') ?? 0.0, 0, 1)

  return {
    searchParams,
    isE2e,
    enableLogDepth,
    debug,
    starSeed,
    animatedSky,
    skyTwinkle,
    initialUtc,
    initialEt,
    sunPostprocessMode,
    sunExposure,
    sunToneMap,
    sunBloomThreshold,
    sunBloomStrength,
    sunBloomRadius,
    sunBloomResolutionScale,

    sunSeed,
    sunGranulationScale,
    sunGranulationSpeed,
    sunGranulationIntensity,
    sunFilamentScale,
    sunFilamentSpeed,
    sunFilamentIntensity,
    sunFilamentThreshold,
    sunFilamentLatitudeBias,
    sunLimbStrength,
    sunDifferentialRotationStrength,
  }
}
