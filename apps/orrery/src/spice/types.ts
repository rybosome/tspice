import type { FrameName } from '@rybosome/tspice'
import { J2000 } from '@rybosome/tspice'

/** Seconds past the J2000 epoch (SPICE ET). */
export type EtSeconds = number

/**
 * NAIF ID or a SPICE-recognized body name (e.g. `399` or `"EARTH"`).
 */
export type BodyRef = number | string

/**
* Viewer convention: treat J2000 as the default inertial frame.
*
* Centralized so "what frame do we render in?" remains a single decision point.
*/
export const J2000_FRAME: FrameName = J2000

/**
 * Placeholder for viewer-specific optional kernel packs (moons, spacecraft, etc).
 *
 * (Kernel loading is currently handled via shared `publicKernels` helpers.)
 */
export type KernelPackId = string
