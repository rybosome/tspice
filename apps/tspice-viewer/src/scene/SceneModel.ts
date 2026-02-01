import type { BodyRef, FrameId } from "../spice/SpiceClient.js";

export type BodyTextureKind = "earth" | "moon" | "sun";

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
