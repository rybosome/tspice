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
export type NumericRange = { min: number; max: number; step: number }

// Keep clamping aligned with the UI slider ranges.
//
// Note: Sun *postprocess* params are intentionally supported via query params
// for quick sharing/debugging. Sun *surface tuning* (granulation/filaments)
// is intentionally NOT supported via query params — those are driven only by
// the sliders in the Advanced pane.
export const SUN_EXPOSURE_RANGE: NumericRange = { min: 0, max: 10, step: 0.01 }
export const SUN_BLOOM_THRESHOLD_RANGE: NumericRange = { min: 0, max: 5, step: 0.01 }
export const SUN_BLOOM_STRENGTH_RANGE: NumericRange = { min: 0, max: 2, step: 0.01 }
export const SUN_BLOOM_RADIUS_RANGE: NumericRange = { min: 0, max: 1, step: 0.01 }
export const SUN_BLOOM_RESOLUTION_SCALE_RANGE: NumericRange = { min: 0.1, max: 1, step: 0.05 }

export const SUN_GRANULATION_SCALE_RANGE: NumericRange = { min: 1, max: 120, step: 1 }
export const SUN_GRANULATION_SPEED_RANGE: NumericRange = { min: 0, max: 0.25, step: 0.005 }
export const SUN_GRANULATION_INTENSITY_RANGE: NumericRange = { min: 0, max: 1, step: 0.01 }

export const SUN_FILAMENT_SCALE_RANGE: NumericRange = { min: 0.2, max: 30, step: 0.1 }
export const SUN_FILAMENT_SPEED_RANGE: NumericRange = { min: 0, max: 0.25, step: 0.005 }
export const SUN_FILAMENT_INTENSITY_RANGE: NumericRange = { min: 0, max: 1, step: 0.01 }
export const SUN_FILAMENT_THRESHOLD_RANGE: NumericRange = { min: 0, max: 1, step: 0.01 }
export const SUN_FILAMENT_LATITUDE_BIAS_RANGE: NumericRange = { min: 0, max: 1, step: 0.01 }

export const SUN_LIMB_STRENGTH_RANGE: NumericRange = { min: 0, max: 1, step: 0.01 }
export const SUN_DIFF_ROTATION_STRENGTH_RANGE: NumericRange = { min: 0, max: 1, step: 0.01 }

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

  const sunExposure = clamp(
    parseNumber(searchParams, 'sunExposure') ?? 1.5,
    SUN_EXPOSURE_RANGE.min,
    SUN_EXPOSURE_RANGE.max,
  )

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
  const sunBloomThreshold = clamp(
    parseNumber(searchParams, 'sunBloomThreshold') ?? sunBloomThresholdDefault,
    SUN_BLOOM_THRESHOLD_RANGE.min,
    SUN_BLOOM_THRESHOLD_RANGE.max,
  )
  const sunBloomStrength = clamp(
    parseNumber(searchParams, 'sunBloomStrength') ?? sunBloomStrengthDefault,
    SUN_BLOOM_STRENGTH_RANGE.min,
    SUN_BLOOM_STRENGTH_RANGE.max,
  )
  const sunBloomRadius = clamp(
    parseNumber(searchParams, 'sunBloomRadius') ?? sunBloomRadiusDefault,
    SUN_BLOOM_RADIUS_RANGE.min,
    SUN_BLOOM_RADIUS_RANGE.max,
  )
  const sunBloomResolutionScale = clamp(
    parseNumber(searchParams, 'sunBloomResolutionScale') ?? sunBloomResolutionScaleDefault,
    SUN_BLOOM_RESOLUTION_SCALE_RANGE.min,
    SUN_BLOOM_RESOLUTION_SCALE_RANGE.max,
  )

  // ---------------------------------------------------------------------------
  // Sun surface tuning (shader uniforms)
  // ---------------------------------------------------------------------------
  // Intentionally NOT query-param driven (see note above).

  // Default: reuse the app-wide stable seed so sky + Sun move together.
  const sunSeed = starSeed

  // Keep defaults subtle to avoid fighting bloom/tonemap.
  const sunGranulationScale = clamp(45.0, SUN_GRANULATION_SCALE_RANGE.min, SUN_GRANULATION_SCALE_RANGE.max)
  const sunGranulationSpeed = clamp(0.08, SUN_GRANULATION_SPEED_RANGE.min, SUN_GRANULATION_SPEED_RANGE.max)
  const sunGranulationIntensity = clamp(0.25, SUN_GRANULATION_INTENSITY_RANGE.min, SUN_GRANULATION_INTENSITY_RANGE.max)

  const sunFilamentScale = clamp(6.0, SUN_FILAMENT_SCALE_RANGE.min, SUN_FILAMENT_SCALE_RANGE.max)
  const sunFilamentSpeed = clamp(0.06, SUN_FILAMENT_SPEED_RANGE.min, SUN_FILAMENT_SPEED_RANGE.max)
  const sunFilamentIntensity = clamp(0.28, SUN_FILAMENT_INTENSITY_RANGE.min, SUN_FILAMENT_INTENSITY_RANGE.max)
  const sunFilamentThreshold = clamp(0.5, SUN_FILAMENT_THRESHOLD_RANGE.min, SUN_FILAMENT_THRESHOLD_RANGE.max)
  const sunFilamentLatitudeBias = clamp(0.35, SUN_FILAMENT_LATITUDE_BIAS_RANGE.min, SUN_FILAMENT_LATITUDE_BIAS_RANGE.max)

  const sunLimbStrength = clamp(0.35, SUN_LIMB_STRENGTH_RANGE.min, SUN_LIMB_STRENGTH_RANGE.max)
  const sunDifferentialRotationStrength = clamp(
    0.0,
    SUN_DIFF_ROTATION_STRENGTH_RANGE.min,
    SUN_DIFF_ROTATION_STRENGTH_RANGE.max,
  )

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
