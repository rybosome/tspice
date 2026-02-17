import type { Mat3ColMajor } from '@rybosome/tspice-backend-contract'

/** Seconds past the J2000 epoch (SPICE ET). */
export type EtSeconds = number

/**
* NAIF ID or a SPICE-recognized body name (e.g. `399` or `"EARTH"`).
*/
export type BodyRef = string | number

/** A SPICE reference frame name, e.g. `"J2000"`. */
export type FrameId = string

/**
* Viewer convention: treat J2000 as the default inertial frame.
*
* Centralized so "what frame do we render in?" remains a single decision point.
*/
export const J2000_FRAME: FrameId = 'J2000'

/** 3-vector (km). */
export type Vec3Km = readonly [number, number, number]

/** 3x3 rotation matrix in **column-major** order (Three.js compatible). */
export type Mat3 = Mat3ColMajor

/**
* Placeholder for viewer-specific optional kernel packs (moons, spacecraft, etc).
*/
export type KernelPackId = string
