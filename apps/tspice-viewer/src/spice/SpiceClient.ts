/**
 * Minimal SPICE-facing interface for rendering.
 *
 * This intentionally covers only what the viewer needs:
 * - relative body state vectors (position/velocity)
 * - frame rotation transforms between reference frames
 * - time conversion (ET to UTC)
 */

export const J2000_FRAME = 'J2000' as const
export type J2000Frame = typeof J2000_FRAME

/** Seconds past the J2000 epoch (SPICE ET). */
export type EtSeconds = number

/**
 * NAIF ID or a SPICE-recognized body name (e.g. `399` or `"EARTH"`).
 *
 * For the initial viewer demo we only need Sun/Earth/Moon, but the interface
 * is generic.
 */
export type BodyRef = number | string

/** A SPICE reference frame name, e.g. `"J2000"`. */
export type FrameId = string

/** Aberration correction flag (SPICE `abcorr`). */
export type Abcorr = 'NONE' | 'LT' | 'LT+S' | 'CN' | 'CN+S'

export type Vec3 = readonly [number, number, number]
export type Vec3Km = Vec3
export type Vec3KmPerSec = Vec3

/**
 * 3x3 rotation matrix in **column-major** order (Three.js compatible).
 *
 * Indexing:
 * `[
 *   m00, m10, m20,
 *   m01, m11, m21,
 *   m02, m12, m22
 * ]`
 */
export type Mat3 = readonly [number, number, number, number, number, number, number, number, number]

export interface BodyState {
  positionKm: Vec3Km
  velocityKmPerSec: Vec3KmPerSec
}

export interface GetBodyStateInput {
  target: BodyRef
  observer: BodyRef

  /** Reference frame for output vectors. Prefer `"J2000"` for world space. */
  frame: FrameId

  /** Aberration corrections, if supported by the implementation. */
  abcorr?: Abcorr

  /** Ephemeris time in seconds past J2000. */
  et: EtSeconds
}

export interface GetFrameTransformInput {
  from: FrameId
  to: FrameId

  /** Ephemeris time in seconds past J2000. */
  et: EtSeconds
}

export interface BodyMeta {
  id: number
  name: string

  /** Mean radius (km). Optional because some bodies may not have a known radius. */
  radiusKm?: number
}

export interface SpiceClient {
  /**
   * Returns the state of `target` relative to `observer`.
   *
   * Output units:
   * - position: km
   * - velocity: km/s
   */
  getBodyState(input: GetBodyStateInput): BodyState

  /**
   * Rotation matrix from frame `from` into frame `to` at time `et`.
   *
   * The returned matrix is column-major (`Mat3`), matching Three.js `Matrix3`.
   */
  getFrameTransform(input: GetFrameTransformInput): Mat3

  /**
   * Convert ephemeris time (seconds past J2000) to a UTC string.
   *
   * @param et - Ephemeris time in seconds past J2000
   * @returns UTC string (format may vary by implementation, typically ISO-8601)
   */
  etToUtc(et: EtSeconds): string

  /** Optional: enumerate supported bodies (if known). */
  listBodies?(): readonly BodyMeta[]

  /** Optional: get metadata for a single body (if known). */
  getBodyMeta?(body: BodyRef): BodyMeta | undefined
}
