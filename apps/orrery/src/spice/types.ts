import type { BodyRef as SpiceBodyRef, FrameName, Mat3ColMajor, SpiceTime, Vec3 } from '@rybosome/tspice'
import { J2000 } from '@rybosome/tspice'

/** Seconds past the J2000 epoch (SPICE ET). */
export type EtSeconds = SpiceTime

/**
 * NAIF ID or a SPICE-recognized body name (e.g. `399` or `"EARTH"`).
 */
export type BodyRef = SpiceBodyRef

/** A SPICE reference frame name, e.g. `"J2000"`. */
export type FrameId = FrameName

/**
 * Viewer convention: treat J2000 as the default inertial frame.
 *
 * Centralized so "what frame do we render in?" remains a single decision point.
 */
export const J2000_FRAME: FrameId = J2000

/** 3-vector (km). */
export type Vec3Km = Vec3

/** 3x3 rotation matrix in **column-major** order (Three.js compatible). */
export type Mat3 = Mat3ColMajor

/**
 * Placeholder for viewer-specific optional kernel packs (moons, spacecraft, etc).
 *
 * (Kernel loading is currently handled via shared `kernels.naif` helpers.)
 */
export type KernelPackId = string
