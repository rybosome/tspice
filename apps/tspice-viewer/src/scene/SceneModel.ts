import type { BodyRef, FrameId } from "../spice/SpiceClient.js";

export type BodyTextureKind = "earth" | "moon" | "sun";

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
  radiusKm: number;

  /** Renderer color hint (e.g. `"#ffffff"`, `"skyblue"`). */
  color: string;

  /**
   * Optional material color multiplier to apply when a texture is present.
   *
   * Note: `MeshStandardMaterial.color` multiplies the texture (`map`). Most
   * full-color albedo textures should use `"#ffffff"` here (the default) to
   * avoid unintended tinting or darkening.
   */
  textureColor?: string;

  /**
   * Optional texture URL/path.
   *
   * If relative, it's resolved against Vite's `BASE_URL` at runtime.
   */
  textureUrl?: string;

  /** Optional, lightweight procedural texture (no binary assets). */
  textureKind?: BodyTextureKind;

  /** Optional label to show in UI. */
  label?: string;

  /** Optional rings style (rendered as a child mesh). */
  rings?: SceneRingsStyle

  /** Optional higher-fidelity Earth-only appearance upgrades. */
  earthAppearance?: EarthAppearanceStyle
}

export interface SceneBody {
  /** NAIF ID or body name; fed into `SpiceClient.getBodyState`. */
  body: BodyRef;

  /** Optional body-fixed frame for debug axes (e.g. `"IAU_EARTH"`). */
  bodyFixedFrame?: FrameId;

  style: SceneBodyStyle;
}

export interface SceneModel {
  /** Frame the scene is rendered in (default should be `"J2000"`). */
  frame: FrameId;

  /** The observer/origin body for relative positions (e.g. `"SUN"`). */
  observer: BodyRef;

  bodies: readonly SceneBody[];
}
