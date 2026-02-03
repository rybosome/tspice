import type { BodyRef, FrameId } from '../spice/SpiceClient.js'

export type BodyTextureKind = 'earth' | 'moon' | 'sun'

export interface BodySurfaceTextureStyle {
  /**
   * Optional texture URL/path.
   *
   * If relative, it's resolved against Vite's `BASE_URL` at runtime.
   */
  url?: string

  /** Optional, lightweight procedural texture (no binary assets). */
  kind?: BodyTextureKind

  /**
   * Optional material color multiplier to apply when a texture is present.
   *
   * Note: `MeshStandardMaterial.color` multiplies the texture (`map`). Most
   * full-color albedo textures should use `"#ffffff"` here to avoid tinting.
   */
  color?: string
}

export interface BodySurfaceStyle {
  /** Renderer color hint (e.g. `"#ffffff"`, `"skyblue"`). */
  color: string

  /** Optional surface texture settings. */
  texture?: BodySurfaceTextureStyle

  /** Optional material roughness (0=mirror, 1=matte). */
  roughness?: number

  /** Optional night-side albedo suppression to avoid ambient washout. */
  nightSide?: BodyNightSideStyle
}

export interface BodyNightSideStyle {
  /**
   * Base albedo multiplier on the night side.
   *
   * Keep this small but non-zero so the body is not totally invisible in shadow.
   */
  albedo?: number

  /** Smoothstep band around terminator for night-side suppression, in N·L space. */
  twilight?: number
}

export interface EarthAppearanceLayerStyle {
  kind: 'earth'
  earth: EarthAppearanceStyle
}

export interface AtmosphereAppearanceLayerStyle {
  kind: 'atmosphere'
  atmosphere: AtmosphereAppearanceStyle
}

export interface UnknownBodyLayerStyle {
  kind: string
  /**
   * Payload for unrecognized layer kinds.
   *
   * This avoids allowing arbitrary top-level keys on layers, making registry
   * mistakes easier to catch.
   */
  data: Record<string, unknown>
}

// Extensible: new layer kinds (atmosphere, clouds, decals, etc.) can be added later.
// Keep this intentionally open, but structurally explicit.
export type BodyLayerStyle = EarthAppearanceLayerStyle | AtmosphereAppearanceLayerStyle | UnknownBodyLayerStyle

export function isEarthAppearanceLayer(layer: BodyLayerStyle): layer is EarthAppearanceLayerStyle {
  if (typeof layer !== 'object' || layer === null) return false

  const maybeKind = (layer as { kind?: unknown }).kind
  if (maybeKind !== 'earth') return false

  // Validate payload shape beyond `kind === 'earth'`.
  const earth = (layer as { earth?: unknown }).earth
  return typeof earth === 'object' && earth !== null
}

export function isAtmosphereAppearanceLayer(layer: BodyLayerStyle): layer is AtmosphereAppearanceLayerStyle {
  if (typeof layer !== 'object' || layer === null) return false

  const maybeKind = (layer as { kind?: unknown }).kind
  if (maybeKind !== 'atmosphere') return false

  const atmosphere = (layer as { atmosphere?: unknown }).atmosphere
  return typeof atmosphere === 'object' && atmosphere !== null
}


export interface BodyAppearanceStyle {
  surface: BodySurfaceStyle

  /** Optional rings style (rendered as a child mesh). */
  rings?: SceneRingsStyle

  /** Optional additional layers (clouds, atmosphere, etc). */
  layers?: BodyLayerStyle[]
}

export interface EarthAppearanceStyle {
  /** Optional night lights (emissive) texture; should be equirectangular 2:1. */
  nightLightsTextureUrl?: string
  /** Optional clouds texture; used as an alpha map (bright=opaque). */
  cloudsTextureUrl?: string
  /** Optional water mask (1=water, 0=land); enables better specular/glint control. */
  waterMaskTextureUrl?: string

  nightLightsIntensity?: number
  /** Smoothstep band around terminator for night lights, in N·L space (0..1-ish). */
  nightLightsTwilight?: number

  cloudsRadiusRatio?: number
  cloudsOpacity?: number
  cloudsAlphaTest?: number
  /** Additional clouds rotation around local +Z (north), in rad/sec of ET. */
  cloudsDriftRadPerSec?: number

  atmosphereRadiusRatio?: number
  atmosphereColor?: string
  atmosphereIntensity?: number
  atmosphereRimPower?: number
  /** 0 = symmetric rim, 1 = fully sun-biased rim. */
  atmosphereSunBias?: number

  oceanRoughness?: number
  oceanSpecularIntensity?: number
}

export interface AtmosphereAppearanceStyle {
  /**
   * Rim glow sphere radius ratio relative to the parent body radius.
   *
   * Typical values: ~1.01..1.05.
   */
  radiusRatio?: number
  color?: string
  intensity?: number
  rimPower?: number
  /** 0 = symmetric rim, 1 = fully sun-biased rim. */
  sunBias?: number

  /** Optional very subtle high-altitude haze layer (transparent shell). */
  haze?: AtmosphereHazeStyle
}

export interface AtmosphereHazeStyle {
  radiusRatio?: number
  color?: string
  opacity?: number
  alphaTest?: number

  /** Optional alpha map to add structure to the haze. */
  alphaTextureUrl?: string

  /** Additional haze rotation around local +Z (north), in rad/sec of ET. */
  driftRadPerSec?: number
}


export interface SceneRingsStyle {
  /** Inner radius relative to the parent body's radius. */
  innerRadiusRatio: number
  /** Outer radius relative to the parent body's radius. */
  outerRadiusRatio: number
  /** Ring texture URL/path (typically RGBA PNG). */
  textureUrl: string
  /** Optional material tint color. */
  color?: string

  /** Optional baseline opacity applied across the whole annulus (0..1). */
  baseOpacity?: number
}

/**
 * Renderer-facing scene description (types only).
 *
 * The intent is to describe *what to render* separately from *how to fetch
 * SPICE state*.
 */

export interface SceneBodyStyle {
  /** Body radius in km. */
  radiusKm: number

  /** Generalized appearance model (surface + optional rings + extensible layers). */
  appearance: BodyAppearanceStyle

  /** Optional label to show in UI. */
  label?: string

  // NOTE: layers like Earth night-lights/clouds/atmosphere now live under
  // `appearance.layers` (see `EarthAppearanceLayerStyle`).
}

export interface SceneBody {
  /** NAIF ID or body name; fed into `SpiceClient.getBodyState`. */
  body: BodyRef

  /** Optional body-fixed frame for debug axes (e.g. `"IAU_EARTH"`). */
  bodyFixedFrame?: FrameId

  style: SceneBodyStyle
}

export interface SceneModel {
  /** Frame the scene is rendered in (default should be `"J2000"`). */
  frame: FrameId

  /** The observer/origin body for relative positions (e.g. `"SUN"`). */
  observer: BodyRef

  bodies: readonly SceneBody[]
}
