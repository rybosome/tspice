import type { BodyRef, FrameId } from "../spice/SpiceClient.js";

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

  /** Optional label to show in UI. */
  label?: string;
}

export interface SceneBody {
  /** NAIF ID or body name; fed into `SpiceClient.getBodyState`. */
  body: BodyRef;

  style: SceneBodyStyle;
}

export interface SceneModel {
  /** Frame the scene is rendered in (default should be `"J2000"`). */
  frame: FrameId;

  /** The observer/origin body for relative positions (e.g. `"SUN"`). */
  observer: BodyRef;

  bodies: readonly SceneBody[];
}
