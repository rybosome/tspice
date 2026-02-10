import type { FrameName, Mat3ColMajor, Vec3 } from '@rybosome/tspice'
import { J2000 } from '@rybosome/tspice'

/** Seconds past the J2000 epoch (SPICE ET). */
export type EtSeconds = number

/**
* NAIF ID or a SPICE-recognized body name (e.g. `399` or `"EARTH"`).
*/
export type BodyRef = number | string

/** A SPICE reference frame name, e.g. `"J2000"`. */
export type FrameId = FrameName

/** Viewer convention: treat J2000 as the default inertial frame. */
export const J2000_FRAME = J2000 as FrameId

/** 3-vector (km). */
export type Vec3Km = Vec3

/** 3x3 rotation matrix in **column-major** order (Three.js compatible). */
export type Mat3 = Mat3ColMajor

/**
* Placeholder for viewer-specific optional kernel packs (moons, spacecraft, etc).
*
* (Kernel loading is currently handled via shared `publicKernels` helpers.)
*/
export type KernelPackId = string
